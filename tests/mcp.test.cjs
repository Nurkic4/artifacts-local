const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
test('normal plugin exposes one local presentation tool and ignores remote configuration',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'artifacts-default-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'plan.md'),'# Local only');fs.writeFileSync(path.join(root,'old-remote.json'),'invalid remote config');
 const client=new Client({name:'discovery',version:'1.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[process.env.ARTIFACTS_MCP_ENTRY||path.resolve(__dirname,'../src/mcp.cjs')],env:{...process.env,ARTIFACTS_LEGACY_TOOLS:'0',ARTIFACTS_CONFIG:path.join(root,'old-remote.json')},stderr:'pipe'}));
 try{assert.deepEqual((await client.listTools()).tools.map(tool=>tool.name),['artifacts_present']);const result=await client.callTool({name:'artifacts_present',arguments:{workspace:root,path:'plan.md'}});assert.ok(!result.isError,result.content[0].text);const page=JSON.parse(result.content[0].text);assert.equal(page.interface,'local-file');assert.match(page.url,/^file:/);assert.ok(fs.existsSync(page.previewPath));}finally{await client.close();}
});
test('MCP round trip: submit, human feedback, restart persistence and no approval tool',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'artifacts-mcp-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'plan.md'),'# Review\nOriginal renderer\n');
 const entry=process.env.ARTIFACTS_MCP_ENTRY||path.resolve(__dirname,'../src/mcp.cjs');
 const testEnv={...process.env,ARTIFACTS_LEGACY_TOOLS:'1',ARTIFACTS_CONFIG:path.join(root,'no-remote-config.json')};
 const client=new Client({name:'test',version:'1.0'}),transport=new StdioClientTransport({command:process.execPath,args:[entry],env:testEnv,stderr:'pipe'});
 let stderr='';transport.stderr.on('data',b=>stderr+=b);await client.connect(transport);t.after(()=>client.close());
 const tools=await client.listTools();assert.equal(tools.tools.length,11);assert.ok(tools.tools.every(t=>!t.name.includes('approv')&&!t.name.includes('decide')));
 async function call(name,args={}){const result=await client.callTool({name,arguments:{workspace:root,...args}});assert.ok(!result.isError,result.content[0].text);return JSON.parse(result.content[0].text);}
 const artifact=await call('artifacts_register',{path:'plan.md'}),before=await call('artifacts_get',{id:artifact.id});
 const presented=await call('artifacts_present',{path:'plan.md'});assert.equal(presented.interface,'local-file');assert.ok(fs.existsSync(presented.previewPath));
 const submitted=await call('artifacts_submit',{id:artifact.id,expectedHash:before.current.hash});assert.equal(submitted.status,'pending');
 const page=await call('artifacts_open',{id:artifact.id}),url=new URL(page.url),token=new URLSearchParams(url.hash.slice(1)).get('token');
 const html=await fetch(url.origin);assert.equal(html.status,200);assert.match(await html.text(),/artifacts-app/);
 const denied=await fetch(url.origin+'/api',{method:'POST',body:'{}'});assert.equal(denied.status,400);
 const crossOrigin=await fetch(url.origin+'/api',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer '+token},body:'{}'});assert.equal(crossOrigin.status,400);
 const response=await fetch(url.origin+'/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({operation:'addComment',args:{id:artifact.id,version:submitted.latestVersion,text:'Please explain',selection:{quote:'Original renderer',before:'',after:''}}})});
 assert.equal(response.status,200);const feedback=await call('artifacts_get',{id:artifact.id});assert.equal(feedback.comments[0].text,'Please explain');
 await call('artifacts_reply',{id:artifact.id,commentId:feedback.comments[0].id,text:'Added detail'});
 const published=await fetch(url.origin+'/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({operation:'publishFeedback',args:{id:artifact.id,version:submitted.latestVersion,note:'Ready for revision'}})});assert.equal(published.status,200);
 const rounds=await call('artifacts_feedback',{id:artifact.id});assert.equal(rounds[0].note,'Ready for revision');assert.equal(rounds[0].comments[0].text,'Please explain');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII=';
 const cropResponse=await fetch(url.origin+'/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({operation:'addComment',args:{id:artifact.id,version:submitted.latestVersion,text:'Review this region',selection:{quote:'',before:'',after:'',kind:'image',box:{x:0,y:0,width:1,height:1},imageDataUrl:'data:image/png;base64,'+png}}})});
 assert.equal(cropResponse.status,200);
 const withCrop=await call('artifacts_get',{id:artifact.id});
 const crop=await client.callTool({name:'artifacts_comment_image',arguments:{workspace:root,id:artifact.id,commentId:withCrop.comments.at(-1).id}});
 assert.ok(!crop.isError);const image=crop.content.find(item=>item.type==='image');assert.equal(image.mimeType,'image/png');assert.equal(image.data,png);
 const events=await call('artifacts_events');assert.ok(events.some(e=>e.operation==='add-comment'));
 const bad=await client.callTool({name:'artifacts_submit',arguments:{workspace:root,id:artifact.id,expectedHash:'0'.repeat(64)}});assert.equal(bad.isError,true);
 await client.close();assert.match(stderr,/STALE_CONTENT|文档已改变/);
 const second=new Client({name:'restart',version:'1.0'});await second.connect(new StdioClientTransport({command:process.execPath,args:[entry],env:testEnv,stderr:'pipe'}));
 const restored=await second.callTool({name:'artifacts_get',arguments:{workspace:root,id:artifact.id}});assert.equal(JSON.parse(restored.content[0].text).comments[0].replies[0].text,'Added detail');await second.close();
});
