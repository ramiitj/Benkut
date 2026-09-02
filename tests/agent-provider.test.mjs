import test from 'node:test';
import assert from 'node:assert/strict';
import {generateAgentTurn} from '../server/agent-provider.mjs';

test('agent provider fails closed without server configuration',async()=>{
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
  delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
  await assert.rejects(()=>generateAgentTurn({prompt:'hello'}),error=>error.status===503);
  if(key)process.env.GEMINI_API_KEY=key;if(model)process.env.GEMINI_MODEL=model;
});

test('agent provider validates and returns structured provider JSON',async()=>{
  const oldFetch=globalThis.fetch,key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY='test-key';process.env.GEMINI_MODEL='test-model';
  globalThis.fetch=async()=>({ok:true,headers:new Headers(),json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({language:'en',speech:'What did you eat?',intent:'meal',workspace:{title:'Meal',body:'Tell me what you ate.'},action:null,confirmationRequired:false,suggestions:[]})}]}}]})});
  try{const result=await generateAgentTurn({prompt:'I ate lunch'});assert.equal(result.intent,'meal');assert.equal(result.speech,'What did you eat?');}
  finally{globalThis.fetch=oldFetch;if(key)process.env.GEMINI_API_KEY=key;else delete process.env.GEMINI_API_KEY;if(model)process.env.GEMINI_MODEL=model;else delete process.env.GEMINI_MODEL;}
});
