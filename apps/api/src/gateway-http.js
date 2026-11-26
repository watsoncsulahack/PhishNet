import {strict} from './gateway.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw fail('JSON body required.',415);return new Promise((resolve,reject)=>{let bytes=0,body='',large=false;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){large=true;reject(fail('Payload exceeds 64KB.',413));}else body+=chunk;});req.on('error',reject);req.on('end',()=>{if(large)return;try{resolve(JSON.parse(body||'{}'));}catch{reject(fail('Invalid JSON.'));}});});}
export function localOrigin(req,configured=''){const origin=configured||`http://${req.headers.host}`;let expected;try{expected=new URL(origin);}catch{throw fail('Invalid configured public origin.',500);}const host=req.headers.host||'';if(configured?host!==expected.host:! /^(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(host))throw fail('Unexpected application host.',403);if(req.headers.origin&&req.headers.origin!==origin)throw fail('Cross-origin request refused.',403);return origin;}
export function gatewayHandler(g,{publicOrigin=process.env.PHISHNET_PUBLIC_ORIGIN||''}={}){let windowStart=Date.now(),requestCount=0;return async(req,res)=>{
 if(!req.url?.startsWith('/v1/gateway/')&&!req.url?.startsWith('/v1/agent/'))return false;
 const reply=(code,body,headers={})=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));return true;};
 try{
  const origin=localOrigin(req,publicOrigin);if(Date.now()-windowStart>60000){windowStart=Date.now();requestCount=0;}if(++requestCount>600)throw fail('Gateway request limit reached; wait one minute.',429);const url=new URL(req.url,origin),route=url.pathname;
  if(route.startsWith('/v1/agent/')){const raw=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];if(!raw)throw fail('Agent capability required.',401);let agent;try{agent=g.agent(raw);}catch{throw fail('Agent capability invalid or revoked.',403);}if(route==='/v1/agent/status'&&req.method==='GET')return reply(200,g.agentConnection(agent));if(route==='/v1/agent/jobs'&&req.method==='GET')return reply(200,g.jobs(agent));if(route==='/v1/agent/tool'&&req.method==='POST')return reply(200,await g.tool(agent,await jsonBody(req)));return reply(404,{error:'No signing, approval or journal-mutation tools exist.'});}
  if(route==='/v1/gateway/auth/challenge'&&req.method==='POST'){const body=await jsonBody(req);strict(body,['wallet'],['wallet']);return reply(200,g.challenge(body.wallet,origin));}
  if(route==='/v1/gateway/auth/login'&&req.method==='POST'){const result=await g.login(await jsonBody(req),origin);return reply(200,{wallet:result.wallet},{'Set-Cookie':`phishnet_session=${result.session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`});}
  const raw=req.headers.cookie?.match(/(?:^|;\s*)phishnet_session=([A-Za-z0-9_-]+)/)?.[1];let wallet;try{wallet=g.session(raw,req.headers['x-phishnet-wallet']);}catch{throw fail('Sign in with the selected wallet to access its private journal.',401);}
  if(route==='/v1/gateway/auth/logout'&&req.method==='POST'){g.logout(raw);return reply(200,{signedOut:true},{'Set-Cookie':'phishnet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
  if(route==='/v1/gateway/session'&&req.method==='GET')return reply(200,{wallet,consent:g.consent.config()});
  if(route==='/v1/gateway/events'&&req.method==='GET')return reply(200,{events:g.events(wallet,{traceId:url.searchParams.get('traceId'),after:Number(url.searchParams.get('after')||0),limit:Number(url.searchParams.get('limit')||1000)})});
  if(route.startsWith('/v1/gateway/content/')&&req.method==='GET')return reply(200,{text:g.journal.content(wallet,route.slice('/v1/gateway/content/'.length))});
  if(route==='/v1/gateway/proposals'&&req.method==='GET')return reply(200,{proposals:g.list(wallet)});
  if(route==='/v1/gateway/proposals'&&req.method==='POST')return reply(201,g.createProposal(wallet,await jsonBody(req)));
  const match=route.match(/^\/v1\/gateway\/proposals\/([A-Za-z0-9-]+)(?:\/([a-z]+))?$/);
  if(match){const [,proposalId,action]=match;if(!action&&req.method==='GET')return reply(200,g.list(wallet).find(p=>p.id===proposalId)||(()=>{throw fail('Proposal not found.',404);})());if(req.method!=='POST')throw fail('Method not allowed.',405);const body=await jsonBody(req);
   if(['quote','intent','authorize','check'].includes(action))strict(body,[]);
   if(action==='quote')return reply(200,await g.quote(wallet,proposalId));
   if(action==='intent')return reply(200,g.intent(wallet,proposalId));
   if(action==='resolution'){strict(body,['resolution'],['resolution']);return reply(200,g.resolve(wallet,proposalId,body.resolution));}
   if(action==='authorize')return reply(200,await g.authorize(wallet,proposalId));
   if(action==='submission')return reply(200,g.submitted(wallet,proposalId,body));
   if(action==='rejected')return reply(200,g.reject(wallet,proposalId,body));
   if(action==='check')return reply(200,await g.check(wallet,proposalId));
  }
  if(route==='/v1/gateway/history/import'&&req.method==='POST'){const body=await jsonBody(req);strict(body,['records'],['records']);return reply(200,{proposalIds:g.importHistory(wallet,body.records)});}
  if(route==='/v1/gateway/chat'&&req.method==='POST')return reply(201,g.chat(wallet,await jsonBody(req)));
  if(route==='/v1/gateway/agents/connection'&&req.method==='GET')return reply(200,g.localAgentConnection(wallet));
  if(route==='/v1/gateway/agents'&&req.method==='GET')return reply(200,{agents:g.agentStatus(wallet)});
  if(route==='/v1/gateway/agents'&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(201,g.issueAgent(wallet));}
  const revoke=route.match(/^\/v1\/gateway\/agents\/([a-z0-9-]+)\/revoke$/);if(revoke&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(200,g.revokeAgent(wallet,revoke[1]));}
  if(g.audit&&route.startsWith('/v1/gateway/audit/'))return await g.audit.http(req,res,wallet,url,reply);
  return reply(404,{error:'Gateway route not found.'});
 }catch(error){return reply(error.status||400,{error:error.message||'Gateway request refused.'});}
};}
