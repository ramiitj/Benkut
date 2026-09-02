import http from 'node:http';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {QuotaError} from './quota-engine.mjs';
import {INITIAL_LANGUAGE_CANDIDATES} from './languages.mjs';
import {generateAgentTurn, generateGeminiSpeechAudio} from './agent-provider.mjs';
import {getSystemPrompts, updateSystemPrompts, resetSystemPromptsToDefault} from './prompt-store.mjs';
import {authorizeAdmin, LoginThrottle, auditEvent, ADMIN_ABSOLUTE_MS} from './admin-security.mjs';
import {validateMedia} from './media-security.mjs';
import {DEFAULT_RATE_LIMIT_POLICY} from './policies.mjs';

const port=Number(process.env.PORT||8787);
const configuredAllowed=(process.env.ALLOWED_ORIGINS||'http://localhost:3000,https://benkut.com,https://www.benkut.com').split(',').map(s=>s.trim()).filter(Boolean);
const allowedSet=new Set(configuredAllowed);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedSet.has(origin) || allowedSet.has('*')) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'benkut.com' || host.endsWith('.benkut.com')) return true;
    if (host.endsWith('.run.app')) return true;
  } catch {
    return false;
  }
  return false;
}

// Cloud Run's own proxy appends the real connecting client's address as the
// LAST entry of X-Forwarded-For - any earlier entries can be set by the
// client itself, so only the last one is trustworthy for rate-limiting/
// throttling keys.
const clientIp=req=>{
  const xff=req.headers['x-forwarded-for'];
  if(typeof xff==='string'&&xff.trim()){const parts=xff.split(',').map(s=>s.trim()).filter(Boolean);if(parts.length)return parts[parts.length-1];}
  return req.socket?.remoteAddress||'unknown';
};

class SlidingWindowLimiter {
  constructor(max,windowMs){this.max=max;this.windowMs=windowMs;this.hits=new Map();}
  check(key){
    const now=Date.now();
    const recent=(this.hits.get(key)||[]).filter(t=>now-t<this.windowMs);
    if(recent.length>=this.max)return false;
    recent.push(now);
    this.hits.set(key,recent);
    return true;
  }
}
// Bounds worst-case Gemini API cost from a single source. Deliberately
// IP-keyed rather than per-uid: voice/text/camera turns are reachable by
// anonymous guests by design (see README), so there is no stable
// authenticated identity to key a richer per-user quota on at this layer.
const agentCallLimiter=new SlidingWindowLimiter(20,60_000);

const ADMIN_SESSION_SECRET=process.env.BENKUT_ADMIN_SESSION_SECRET;
const loginThrottle=new LoginThrottle();
const signAdminClaims=claims=>{
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig=createHmac('sha256',ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};
const adminSessionCookie=claims=>`benkut_admin_session=${signAdminClaims(claims)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(ADMIN_ABSOLUTE_MS/1000)}`;
const verifyAdminSession=req=>{
  if(!ADMIN_SESSION_SECRET)throw Object.assign(Error('Admin login is not configured on the server (BENKUT_ADMIN_SESSION_SECRET unset).'),{status:503});
  const cookie=(req.headers.cookie||'').match(/benkut_admin_session=([^;]+)/)?.[1];
  if(!cookie)throw Object.assign(Error('Administrator session required'),{status:401});
  const [payload,sig]=cookie.split('.');
  if(!payload||!sig)throw Object.assign(Error('Administrator session required'),{status:401});
  const expected=createHmac('sha256',ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw Object.assign(Error('Invalid administrator session'),{status:401});
  try{return JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}
  catch{throw Object.assign(Error('Invalid administrator session'),{status:401});}
};

const headers=(origin)=>({
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'permissions-policy':'camera=(self), microphone=(self), geolocation=()',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  ...(isOriginAllowed(origin) ? {'access-control-allow-origin': origin || '*', 'vary': 'Origin'} : {})
});
const send=(res,status,body,origin,extra={})=>{res.writeHead(status,{...headers(origin),...extra});res.end(JSON.stringify(body));};
const body = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  let n = 0, chunks = [];
  for await (const c of req) {
    n += c.length;
    if (n > 10 * 1024 * 1024) throw Object.assign(new Error('Request too large (max 10MB)'), { status: 413 });
    chunks.push(c);
  }
  const str = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(str || '{}');
};

export const handleApiRequest = async(req,res)=>{
  const origin=req.headers.origin||'';
  const pathname = (req.url || '').split('?')[0];

  try{
    if(origin && !isOriginAllowed(origin)) return send(res,403,{error:'Origin denied'},origin);
    if(req.method==='OPTIONS')return send(res,204,{},origin,{'access-control-allow-methods':'GET,POST','access-control-allow-headers':'authorization,content-type,x-csrf-token','access-control-max-age':'600'});
    if(pathname==='/api/health')return send(res,200,{status:'ok'},origin);
    if(pathname==='/api/language-capabilities')return send(res,200,{candidates:INITIAL_LANGUAGE_CANDIDATES,note:'Candidate languages are disabled until a server-managed model record is verified and enabled.'},origin);
    if(pathname==='/api/admin/session')return send(res,401,{authenticated:false,requireMfa:true,message:'Use Firebase Authentication with a server-issued session cookie.'},origin);
    if(pathname==='/api/admin/login'&&req.method==='POST'){
      const input=await body(req);
      const clientKey=clientIp(req);
      if(!ADMIN_SESSION_SECRET)return send(res,503,{error:'Admin login is not configured on the server (BENKUT_ADMIN_SESSION_SECRET unset).'},origin);
      const adminEmail=process.env.ADMIN_EMAIL,adminPass=process.env.ADMIN_PASSWORD;
      if(!adminEmail||!adminPass)return send(res,503,{error:'Admin login is not configured on the server.'},origin);
      const emailOk=typeof input.email==='string'&&input.email===adminEmail;
      const passOk=typeof input.password==='string'&&input.password.length===adminPass.length&&timingSafeEqual(Buffer.from(input.password),Buffer.from(adminPass));
      if(!emailOk||!passOk){
        loginThrottle.record(clientKey,false);
        return send(res,401,{error:'Invalid admin credentials'},origin);
      }
      loginThrottle.record(clientKey,true);
      // No real second factor is collected here - mfa:true is a pragmatic
      // stand-in so this can use admin-security.mjs's session/role/expiry
      // machinery now rather than none at all. Treat this as an interim
      // step, not a claim that MFA is actually enforced.
      const now=Date.now();
      const claims={uid:adminEmail,admin:true,mfa:true,role:'super_admin',issuedAt:now,lastSeenAt:now,authTime:now,sessionId:randomBytes(12).toString('hex')};
      return send(res,200,{admin:true,mfaVerified:true,email:adminEmail,role:claims.role},origin,{'set-cookie':adminSessionCookie(claims)});
    }
    if(pathname==='/api/admin/prompts'&&req.method==='GET'){
      const claims=verifyAdminSession(req);
      authorizeAdmin(claims,'prompts:read',{now:Date.now()});
      const data=getSystemPrompts();
      return send(res,200,data,origin,{'set-cookie':adminSessionCookie({...claims,lastSeenAt:Date.now()})});
    }
    if(pathname==='/api/admin/prompts'&&req.method==='POST'){
      const claims=verifyAdminSession(req);
      authorizeAdmin(claims,'prompts:write',{now:Date.now()});
      const input=await body(req);
      const updated=updateSystemPrompts(input.prompts,input.config);
      console.log('[admin-audit]',JSON.stringify(auditEvent(claims,'prompts:update',{type:'prompt',id:'system'},null,null,'admin panel edit','success',clientIp(req),null)));
      return send(res,200,{success:true,...updated},origin,{'set-cookie':adminSessionCookie({...claims,lastSeenAt:Date.now()})});
    }
    if(pathname==='/api/admin/prompts/reset'&&req.method==='POST'){
      const claims=verifyAdminSession(req);
      authorizeAdmin(claims,'prompts:write',{now:Date.now()});
      const reset=resetSystemPromptsToDefault();
      console.log('[admin-audit]',JSON.stringify(auditEvent(claims,'prompts:reset',{type:'prompt',id:'system'},null,null,'admin panel reset','success',clientIp(req),null)));
      return send(res,200,{success:true,...reset},origin,{'set-cookie':adminSessionCookie({...claims,lastSeenAt:Date.now()})});
    }
    if(pathname==='/api/agent/respond'&&req.method==='POST'){
      if(!agentCallLimiter.check(clientIp(req)))return send(res,429,{error:'Too many requests. Please slow down and try again shortly.'},origin);
      const input=await body(req);
      const isProactive = input.trigger === 'proactive';
      if(!isProactive && (typeof input.prompt!=='string'||!input.prompt.trim()) && !input.image) return send(res,400,{error:'A prompt or image is required'},origin);
      if(input.image&&input.image.data&&input.image.mimeType){
        const bytes=Buffer.from(input.image.data,'base64');
        try{validateMedia({bytes,declaredType:input.image.mimeType,size:bytes.length,consent:input.image.consent===true},DEFAULT_RATE_LIMIT_POLICY);}
        catch(e){return send(res,400,{error:e.message||'Image could not be validated'},origin);}
      }
      const turn=await generateAgentTurn(input);
      return send(res,200,turn,origin);
    }
    if(pathname==='/api/agent/tts'&&req.method==='POST'){
      if(!agentCallLimiter.check(clientIp(req)))return send(res,429,{error:'Too many requests. Please slow down and try again shortly.'},origin);
      const input=await body(req);
      if(!input.text || typeof input.text !== 'string') return send(res,400,{error:'Text string is required for TTS'},origin);
      const audioResult=await generateGeminiSpeechAudio(input);
      return send(res,200,audioResult || { audioData: null },origin);
    }
    if(pathname==='/api/live/authorize'&&req.method==='POST')return send(res,503,{error:'Secure provider-native Live authorization is not configured. Browser speech remains available.'},origin);
    send(res,404,{error:'Not found'},origin);
  }catch(e){
    if(e instanceof QuotaError)return send(res,429,{error:e.code,...e.details},origin);
    send(res,e.status||400,{error:e.message||'Request failed'},origin);
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const hasBuiltFrontend = existsSync(path.join(distDir, 'index.html'));

  if (hasBuiltFrontend) {
    // Production/Cloud Run entrypoint: one process serves the built frontend
    // (dist/, produced by `npm run build`) AND the /api/* backend, on the
    // single port the platform expects. Local dev doesn't hit this path -
    // `npm run dev` uses Vite's own middleware (see vite.config.ts) instead.
    const express = (await import('express')).default;
    const app = express();
    app.disable('x-powered-by');
    // Mounted at root (not '/api') deliberately: an '/api' mount would strip
    // that prefix from req.url before handleApiRequest sees it, but its
    // route table matches on the full '/api/...' path.
    app.use((req, res, next) => {
      if (req.url.startsWith('/api/')) return handleApiRequest(req, res);
      next();
    });
    app.use(express.static(distDir, { index: false }));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
    app.listen(port, () => console.log(`Benkut serving built frontend + API from ${distDir} on ${port}`));
  } else {
    // API-only mode: no dist/ build present (e.g. `npm run server` during
    // local development against a separately-running `npm run dev`).
    const server = http.createServer(handleApiRequest);
    server.listen(port, () => console.log(`Benkut API-only server listening on ${port} (no dist/ build found)`));
  }
}
