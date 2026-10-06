const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {localPage}=require('../src/local-page.cjs');
test('local page persists document data and freezes adapter across reloads and source updates',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'artifacts-page-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'中文.md'),'# 标题\n</script><script>bad()</script>');
 const result=localPage(root,'中文.md');
 assert.deepEqual(result.openTarget,{type:'browser',url:result.url});
 assert.match(result.openingInstructions,/Do not open previewPath in a source editor/);
 const html=fs.readFileSync(result.previewPath,'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.length,2);assert.ok(!html.includes('src="'+new URL('app.js',result.url).href+'"'));
 for(let reload=0;reload<2;reload++){
  const window={};vm.runInNewContext(scripts[0],{window});
  assert.equal(window.ARTIFACTS_LOCAL_PAGE.documents[0].current.content,'# 标题\n</script><script>bad()</script>');
  const start=scripts[1].indexOf(' async function request('),end=scripts[1].indexOf(' const originalTheme=',start);
  const bridge=vm.runInNewContext(`const localPage=payload;${scripts[1].slice(start,end)};({request,resource})`,{payload:window.ARTIFACTS_LOCAL_PAGE,Error,URL,location:{href:result.url},fetch:()=>{throw Error('Local reading must not fetch HTTP');}});
  assert.equal((await bridge.request('get',{id:result.artifactId})).current.content,window.ARTIFACTS_LOCAL_PAGE.documents[0].current.content);
  assert.equal((await bridge.request('list')).length,1);assert.match(bridge.resource('中文.md'),/^file:/);
 }
 assert.ok(scripts[1].includes('if(localPage)'));assert.ok(scripts[1].includes('localPage?null:setInterval'));
 fs.writeFileSync(path.join(root,'中文.md'),'# 修改后的标题');
 const updated=localPage(root,'中文.md');assert.equal(updated.url,result.url);assert.match(fs.readFileSync(updated.previewPath,'utf8'),/修改后的标题/);
 assert.throws(()=>localPage(root,path.resolve(__dirname,'../README.md')),/工作区/);
 const moved=fs.mkdtempSync(path.join(os.tmpdir(),'artifacts-moved-'));t.after(()=>fs.rmSync(moved,{recursive:true,force:true}));fs.cpSync(root,moved,{recursive:true});
 const {pathToFileURL,fileURLToPath}=require('node:url');
 const movedPage=path.join(moved,path.relative(root,result.previewPath)),movedUrl=pathToFileURL(movedPage).href;
 assert.ok(!html.includes(root.replace(/\\/g,'/')));
 for(const match of html.matchAll(/(?:src|href)="([^":]+\.(?:js|css))"/g))assert.ok(fs.existsSync(fileURLToPath(new URL(match[1],movedUrl))));
});
