const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Store}=require('../src/core.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'artifacts-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'plan.md'),'# 方案\n需要审阅的内容\n');return {root,s:new Store(root)};}
test('approval is invalidated by external edits, old version cannot be approved',t=>{
 const {root,s}=fixture(t);const a=s.register({path:'plan.md'});let v=s.get(a.id);s.submit({id:a.id,expectedHash:v.current.hash});v=s.get(a.id);
 s.decide({id:a.id,version:v.latestVersion,expectedHash:v.current.hash,decision:'approved'});assert.equal(s.get(a.id).status,'approved');
 fs.appendFileSync(path.join(root,'plan.md'),'新要求\n');assert.equal(s.get(a.id).status,'changed');
 assert.throws(()=>s.decide({id:a.id,version:v.latestVersion,expectedHash:v.current.hash,decision:'approved'}),{code:'STALE_CONTENT'});
 s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});assert.equal(s.get(a.id).status,'pending');assert.equal(s.get(a.id).versions.length,2);
 assert.throws(()=>s.decide({id:a.id,version:v.latestVersion,expectedHash:v.current.hash,decision:'approved'}),{code:'STALE_VERSION'});
});
test('comments and decisions survive new store and mutation history is preserved',t=>{
 const {root,s}=fixture(t),a=s.register({path:'plan.md'});s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});const v=s.get(a.id);
 s.addComment({id:a.id,version:v.latestVersion,text:'请说明原因',selection:{quote:'内容',before:'审阅的',after:''}});
 const c=s.get(a.id).comments[0];s.comment({id:a.id,commentId:c.id,action:'reply',text:'已补充'});s.comment({id:a.id,commentId:c.id,action:'resolve'});
 const restored=new Store(root).get(a.id);assert.equal(restored.comments[0].resolved,true);assert.equal(restored.comments[0].replies[0].text,'已补充');assert.equal(restored.status,'pending');
});
test('overlapping writer errors rather than overwriting; corrupt state errors',t=>{
 const {s}=fixture(t);fs.mkdirSync(s.lock);assert.throws(()=>s.register({path:'plan.md'}),{code:'BUSY'});fs.rmdirSync(s.lock);fs.writeFileSync(s.file,'broken');assert.throws(()=>s.list(),SyntaxError);
});
test('confines file access and produces real revision differences',t=>{
 const {root,s}=fixture(t);assert.throws(()=>s.source('../'),{code:'OUTSIDE_WORKSPACE'});
 const a=s.register({path:'plan.md'});s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});const v=s.get(a.id);fs.appendFileSync(path.join(root,'plan.md'),'添加\n');
 assert.ok(s.compare({id:a.id,from:v.latestVersion,to:'current'}).parts.some(p=>p.added&&p.value.includes('添加')));
 assert.throws(()=>s.submit({id:a.id,expectedHash:v.current.hash}),{code:'STALE_CONTENT'});
});
test('binary version preview uses immutable bytes after external edits',t=>{
 const {root,s}=fixture(t);fs.writeFileSync(path.join(root,'picture.png'),Buffer.from([1,2,3]));
 const a=s.register({path:'picture.png'});s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});const version=s.get(a.id).latestVersion;
 fs.writeFileSync(path.join(root,'picture.png'),Buffer.from([4,5,6]));
 assert.deepEqual(fs.readFileSync(s.snapshotMedia(a.id,version)),Buffer.from([1,2,3]));assert.equal(s.get(a.id).status,'changed');
});
test('submitted feedback round preserves original comments after subsequent edits',t=>{
 const {s}=fixture(t),a=s.register({path:'plan.md'});s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});const version=s.get(a.id).latestVersion;
 s.addComment({id:a.id,version,text:'第一轮意见',selection:{quote:'内容',before:'',after:''}});
 s.publishFeedback({id:a.id,version,note:'请修改'});const c=s.get(a.id).comments[0];
 s.comment({id:a.id,commentId:c.id,action:'edit',text:'第二轮意见'});s.comment({id:a.id,commentId:c.id,action:'resolve'});
 assert.equal(s.feedback(a.id)[0].comments[0].text,'第一轮意见');assert.equal(s.feedback(a.id)[0].comments[0].resolved,false);assert.deepEqual(s.feedback(a.id,1),[]);
 assert.throws(()=>s.publishFeedback({id:a.id,version}),{code:'EMPTY_FEEDBACK'});
});
test('image and PDF anchors reject impossible coordinates and persist valid region context',t=>{
 const {s}=fixture(t),a=s.register({path:'plan.md'});s.submit({id:a.id,expectedHash:s.get(a.id).current.hash});const version=s.get(a.id).latestVersion;
 const selection={kind:'pdf-image',quote:'',before:'',after:'',page:2,box:{x:.1,y:.2,width:.3,height:.4}};
 s.addComment({id:a.id,version,text:'调整图表',selection});assert.deepEqual(s.get(a.id).comments[0].selection,selection);
 assert.throws(()=>s.addComment({id:a.id,version,text:'bad',selection:{...selection,box:{...selection.box,x:2}}}),{code:'INVALID_SELECTION'});
 assert.throws(()=>s.addComment({id:a.id,version,text:'bad',selection:{...selection,page:0}}),{code:'INVALID_SELECTION'});
});
