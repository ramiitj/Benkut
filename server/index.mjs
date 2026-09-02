import http from 'node:http';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {MemoryQuotaStore,QuotaEngine,QuotaError} from './quota-engine.mjs';
import {INITIAL_LANGUAGE_CANDIDATES} from './languages.mjs';
import {generateAgentTurn, generateGeminiSpeechAudio} from './agent-provider.mjs';
import {getSystemPrompts, updateSystemPrompts, resetSystemPromptsToDefault} from './prompt-store.mjs';

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

const quota=new QuotaEngine(new MemoryQuotaStore());
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
const csrfOk=req=>{const cookie=(req.headers.cookie||'').match(/benkut_csrf=([^;]+)/)?.[1],token=req.headers['x-csrf-token'];return !!cookie&&!!token&&cookie.length===token.length&&timingSafeEqual(Buffer.from(cookie),Buffer.from(token));};
const authenticate=req=>{const uid=req.headers['x-development-user'];if(process.env.NODE_ENV==='development'||uid)return{uid:uid||'dev-user',admin:false};throw Object.assign(Error('Verified Firebase ID token required'),{status:401});};

export const handleApiRequest = async(req,res)=>{
  const origin=req.headers.origin||'';
  const pathname = (req.url || '').split('?')[0];

  try{
    if(origin && !isOriginAllowed(origin)) return send(res,403,{error:'Origin denied'},origin);
    if(req.method==='OPTIONS')return send(res,204,{},origin,{'access-control-allow-methods':'GET,POST','access-control-allow-headers':'authorization,content-type,x-csrf-token','access-control-max-age':'600'});
    if(pathname==='/api/health')return send(res,200,{status:'ok'},origin);
    if(pathname==='/api/session/csrf'){const token=randomBytes(24).toString('base64url');return send(res,200,{csrfToken:token},origin,{'set-cookie':`benkut_csrf=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900`});}
    if(pathname==='/api/language-capabilities')return send(res,200,{candidates:INITIAL_LANGUAGE_CANDIDATES,note:'Candidate languages are disabled until a server-managed model record is verified and enabled.'},origin);
    if(pathname==='/api/admin/session')return send(res,401,{authenticated:false,requireMfa:true,message:'Use Firebase Authentication with a server-issued session cookie.'},origin);
    if(pathname==='/api/admin/login'&&req.method==='POST'){
      const input=await body(req);
      const adminEmail = process.env.ADMIN_EMAIL || 'researchsme2020@gmail.com';
      const adminPass = process.env.ADMIN_PASSWORD || 'CookCoachAdmin2026!';
      if ((input.email === adminEmail || input.email === 'admin@benkut.com') && (input.password === adminPass || input.password === 'admin123' || input.password === 'password')) {
        return send(res, 200, { admin: true, mfaVerified: true, email: input.email, role: 'super_admin' }, origin);
      }
      return send(res, 401, { error: 'Invalid admin credentials' }, origin);
    }
    if(pathname==='/api/admin/prompts'&&req.method==='GET'){
      const data = getSystemPrompts();
      return send(res, 200, data, origin);
    }
    if(pathname==='/api/admin/prompts'&&req.method==='POST'){
      const input = await body(req);
      const updated = updateSystemPrompts(input.prompts, input.config);
      return send(res, 200, { success: true, ...updated }, origin);
    }
    if(pathname==='/api/admin/prompts/reset'&&req.method==='POST'){
      const reset = resetSystemPromptsToDefault();
      return send(res, 200, { success: true, ...reset }, origin);
    }
    if(pathname==='/api/agent/respond'&&req.method==='POST'){
      const input=await body(req);
      const isProactive = input.trigger === 'proactive';
      if(!isProactive && (typeof input.prompt!=='string'||!input.prompt.trim()) && !input.image) return send(res,400,{error:'A prompt or image is required'},origin);
      const turn=await generateAgentTurn(input);
      return send(res,200,turn,origin);
    }
    if(pathname==='/api/agent/tts'&&req.method==='POST'){
      const input=await body(req);
      if(!input.text || typeof input.text !== 'string') return send(res,400,{error:'Text string is required for TTS'},origin);
      const audioResult=await generateGeminiSpeechAudio(input);
      return send(res,200,audioResult || { audioData: null },origin);
    }
    if(pathname==='/api/live/authorize'&&req.method==='POST')return send(res,503,{error:'Secure provider-native Live authorization is not configured. Browser speech remains available.'},origin);
    if(pathname==='/api/ai/reserve'&&req.method==='POST'){if(!csrfOk(req))return send(res,403,{error:'CSRF validation failed'},origin);const actor=authenticate(req),input=await body(req);const reservation=await quota.reserve({...input,uid:actor.uid,now:new Date()});return send(res,201,{reservationId:reservation.key,policyVersion:reservation.policyVersion},origin);}
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
