import {strict} from './gateway.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function jsonBody(req,maxBytes=65536){if(!req.headers['content-type']?.startsWith('application/json'))throw fail('JSON body required.',415);return new Promise((resolve,reject)=>{let bytes=0,body='',large=false;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){large=true;req.destroy();reject(fail(`Payload exceeds ${Math.round(maxBytes/1024)}KB.`,413));}else body+=chunk;});req.on('error',reject);req.on('end',()=>{if(large)return;try{resolve(JSON.parse(body||'{}'));}catch{reject(fail('Invalid JSON.'));}});});}
export function localOrigin(req,configured=''){const origin=configured||`http://${req.headers.host}`;let expected;try{expected=new URL(origin);}catch{throw fail('Invalid configured public origin.',500);}const host=req.headers.host||'';if(configured?host!==expected.host:! /^(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(host))throw fail('Unexpected application host.',403);if(req.headers.origin&&req.headers.origin!==origin)throw fail('Cross-origin request refused.',403);return origin;}
export function gatewayHandler(g,{publicOrigin=process.env.PHISHNET_PUBLIC_ORIGIN||''}={}){let windowStart=Date.now();const buckets=new Map();const mcpRuntimeTokens=new Map();
 const mcpTools=[
  {name:'wallet_balance',description:'Read current Arc Testnet native USDC balance for the connected wallet.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'wallet_transactions',description:'Read observed on-chain transfers (including faucet deposits) and payment proposals for the connected wallet.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'chat_read',description:'Read pending/active chat messages and conversation context.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'plan_report',description:'Record an agent-reported explanation step for an active chat turn.',inputSchema:{type:'object',properties:{chatId:{type:'string'},text:{type:'string'},sourceEventIds:{type:'array',items:{type:'string'}}},required:['chatId','text'],additionalProperties:false}},
  {name:'payment_propose',description:'Create an unsigned Arc Testnet USDC payment proposal requiring human review and external wallet signature. Cannot sign or execute.',inputSchema:{type:'object',properties:{chatId:{type:'string'},to:{type:'string'},amount:{type:'string'},purpose:{type:'string'}},required:['to','amount'],additionalProperties:false}},
  {name:'chat_respond',description:'Send an assistant reply and optional comparison cards back to the user.',inputSchema:{type:'object',properties:{chatId:{type:'string'},replyId:{type:'string'},text:{type:'string'},items:{type:'array'}},required:['chatId','replyId'],additionalProperties:false}}
 ];
 const mcpToolMap={wallet_balance:'wallet.balance',wallet_transactions:'wallet.transactions',chat_read:'chat.read',plan_report:'plan.report',payment_propose:'payment.propose',chat_respond:'chat.respond'};
 const resolveMcpAgent=req=>{
  const bearer=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if(bearer){try{return g.agent(bearer);}catch{throw fail('MCP agent capability invalid or revoked.',403);}}
  const raw=req.headers.cookie?.match(/(?:^|;\s*)phishnet_session=([A-Za-z0-9_-]+)/)?.[1];
  let wallet;try{wallet=g.session(raw,req.headers['x-phishnet-wallet']);}catch{throw fail('Authenticate via Bearer agent token or signed-in wallet session to use MCP.',401);}
  const cached=mcpRuntimeTokens.get(wallet);
  if(cached){try{return g.agent(cached);}catch{mcpRuntimeTokens.delete(wallet);}}
  const issued=g.issueAgent(wallet);mcpRuntimeTokens.set(wallet,issued.token);
  return g.agent(issued.token);
 };
 return async(req,res)=>{
 if(!req.url?.startsWith('/v1/gateway/')&&!req.url?.startsWith('/v1/agent/')&&req.url!=='/v1/mcp'&&!req.url?.startsWith('/v1/mcp?')&&!req.url?.startsWith('/v1/mcp/'))return false;
 const reply=(code,body,headers={})=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));return true;};
 try{
  const origin=localOrigin(req,publicOrigin);const now=Date.now();if(now-windowStart>60000){windowStart=now;buckets.clear();}const key=String(req.headers['x-phishnet-wallet']||req.headers.authorization?.slice(0,24)||req.socket?.remoteAddress||'local').toLowerCase();if(!buckets.has(key)&&buckets.size>=1000)buckets.delete(buckets.keys().next().value);const count=(buckets.get(key)||0)+1;buckets.set(key,count);if(count>600)throw fail('Gateway request limit reached; wait one minute.',429);const url=new URL(req.url,origin),route=url.pathname;
  if(route==='/v1/mcp'){
   const agent=resolveMcpAgent(req);
   if(req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const write=chunk=>{try{if(!res.writableEnded&&!res.destroyed)res.write(chunk);}catch{cleanup();}};
    let off=()=>{},ping=null;const cleanup=()=>{clearInterval(ping);off();};
    req.on('close',cleanup);res.on('close',cleanup);res.on('error',cleanup);
    write(`event: endpoint\ndata: /v1/mcp\n\n`);
    off=g.subscribe(agent.wallet,payload=>write(`event: ${payload?.type==='agent_status'?'agent_status':'journal'}\ndata: ${JSON.stringify(payload)}\n\n`));
    ping=setInterval(()=>write(': ping\n\n'),20000);ping.unref();
    return true;
   }
   if(req.method==='POST'){
    const msg=await jsonBody(req);
    const rpcId=msg.id??null;
    const rpcOk=result=>reply(200,{jsonrpc:'2.0',id:rpcId,result});
    const rpcErr=(code,message)=>reply(200,{jsonrpc:'2.0',id:rpcId,error:{code,message}});
    if(msg.method==='initialize')return rpcOk({protocolVersion:'2024-11-05',capabilities:{tools:{},resources:{}},serverInfo:{name:'phishnet-wallet-mcp',version:'1.0.0'}});
    if(msg.method==='notifications/initialized'||msg.method==='ping')return rpcOk({});
    if(msg.method==='tools/list')return rpcOk({tools:mcpTools});
    if(msg.method==='resources/list')return rpcOk({resources:[{uri:'phishnet://wallet/activity',name:'Wallet balance & observed transactions',mimeType:'application/json'}]});
    if(msg.method==='resources/read'){
     if(msg.params?.uri==='phishnet://wallet/activity')return rpcOk({contents:[{uri:'phishnet://wallet/activity',mimeType:'application/json',text:JSON.stringify(g.walletActivitySummary(agent.wallet),null,2)}]});
     return rpcErr(-32602,'Unknown resource URI.');
    }
    if(msg.method==='tools/call'){
     const internalTool=mcpToolMap[msg.params?.name];
     if(!internalTool)return rpcErr(-32601,'Unknown or forbidden tool. Signing and execution tools do not exist.');
     try{
      const result=await g.tool(agent,{tool:internalTool,arguments:msg.params?.arguments||{}});
      return rpcOk({content:[{type:'text',text:JSON.stringify(result,null,2)}],isError:false});
     }catch(err){return rpcOk({content:[{type:'text',text:err.message}],isError:true});}
    }
    return rpcErr(-32601,'Unsupported MCP method.');
   }
   throw fail('Method not allowed.',405);
  }
  if(route.startsWith('/v1/agent/')){const raw=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];if(!raw)throw fail('Agent capability required.',401);let agent;try{agent=g.agent(raw);}catch{throw fail('Agent capability invalid or revoked.',403);}if(route==='/v1/agent/status'&&req.method==='GET')return reply(200,g.agentConnection(agent));if(route==='/v1/agent/jobs'&&req.method==='GET')return reply(200,g.jobs(agent));if(route==='/v1/agent/tool'&&req.method==='POST')return reply(200,await g.tool(agent,await jsonBody(req)));return reply(404,{error:'No signing, approval or journal-mutation tools exist.'});}
  if(route==='/v1/gateway/auth/challenge'&&req.method==='POST'){const body=await jsonBody(req);strict(body,['wallet'],['wallet']);return reply(200,g.challenge(body.wallet,origin));}
  if(route==='/v1/gateway/auth/login'&&req.method==='POST'){const result=await g.login(await jsonBody(req),origin);return reply(200,{wallet:result.wallet},{'Set-Cookie':`phishnet_session=${result.session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`});}
  const raw=req.headers.cookie?.match(/(?:^|;\s*)phishnet_session=([A-Za-z0-9_-]+)/)?.[1];let wallet;try{wallet=g.session(raw,req.headers['x-phishnet-wallet']);}catch{throw fail('Sign in with the selected wallet to access its private journal.',401);}
  if(route==='/v1/gateway/stream'&&req.method==='GET'){
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
   const write=chunk=>{try{if(!res.writableEnded&&!res.destroyed)res.write(chunk);}catch{cleanup();}};
   let off=()=>{},ping=null;
   const cleanup=()=>{clearInterval(ping);off();};
   req.on('close',cleanup);res.on('close',cleanup);res.on('error',cleanup);
   write(`event: ready\ndata: ${JSON.stringify({wallet})}\n\n`);
   off=g.subscribe(wallet,payload=>write(`event: ${payload?.type==='agent_status'?'agent_status':'journal'}\ndata: ${JSON.stringify(payload)}\n\n`));
   ping=setInterval(()=>write(': ping\n\n'),20000);ping.unref();
   return true;
  }
  if(route==='/v1/gateway/auth/logout'&&req.method==='POST'){g.logout(raw);return reply(200,{signedOut:true},{'Set-Cookie':'phishnet_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
  if(route==='/v1/gateway/consent/enroll'&&req.method==='POST')return reply(200,g.enrollConsent(wallet,await jsonBody(req)));
  if(route==='/v1/gateway/consent/clear'&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(200,g.clearConsent());}
  if(route==='/v1/gateway/session'&&req.method==='GET')return reply(200,{wallet,consent:g.consent.config(),agentBackend:g.backend()});
  if(route==='/v1/gateway/events'&&req.method==='GET')return reply(200,{events:g.events(wallet,{traceId:url.searchParams.get('traceId'),after:Number(url.searchParams.get('after')||0),limit:Number(url.searchParams.get('limit')||1000)})});
  if(route==='/v1/gateway/journal/export'&&req.method==='GET')return reply(200,g.exportJournal(wallet));
  if(route==='/v1/gateway/journal/import'&&req.method==='POST')return reply(200,g.importJournal(wallet,await jsonBody(req,16*1024*1024)));
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
  if(route==='/v1/gateway/chain/sync'&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(200,await g.syncChainTransactions(wallet));}
  if(route==='/v1/gateway/chat'&&req.method==='POST')return reply(201,g.chat(wallet,await jsonBody(req)));
  if(route==='/v1/gateway/agents/connection'&&req.method==='GET')return reply(200,g.localAgentConnection(wallet));
  if(route==='/v1/gateway/agents/backend'&&req.method==='POST'){const body=await jsonBody(req);strict(body,['backend'],['backend']);return reply(200,g.setBackend(wallet,body.backend));}
  if(route==='/v1/gateway/agents'&&req.method==='GET')return reply(200,{agents:g.agentStatus(wallet)});
  if(route==='/v1/gateway/agents'&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(201,g.issueAgent(wallet));}
  const revoke=route.match(/^\/v1\/gateway\/agents\/([a-z0-9-]+)\/revoke$/);if(revoke&&req.method==='POST'){strict(await jsonBody(req),[]);return reply(200,g.revokeAgent(wallet,revoke[1]));}
  if(g.audit&&route.startsWith('/v1/gateway/audit/'))return await g.audit.http(req,res,wallet,url,reply);
  return reply(404,{error:'Gateway route not found.'});
 }catch(error){return reply(error.status||400,{error:error.message||'Gateway request refused.'});}
};}
