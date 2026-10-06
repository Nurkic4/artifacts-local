const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { diffLines } = require('diff');

class ArtifactError extends Error {
  constructor(code, message, context = {}, cause) { super(message, { cause }); this.code = code; this.context = context; }
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function log(level, operation, context, error) {
  process.stderr.write(JSON.stringify({ time:new Date().toISOString(),level,operation,...context,...(error?{error:{message:error.message,stack:error.stack,cause:error.cause?.stack}}:{}) })+'\n');
}
function required(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new ArtifactError('INVALID_INPUT',`${field} 必须是非空文字`,{field});
  return value;
}
function confined(root, target) {
  const resolved = fs.realpathSync(target), relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)) throw new ArtifactError('OUTSIDE_WORKSPACE','文件不在当前工作区内',{target});
  return resolved;
}
class Store {
  constructor(root,logger=log) {
    this.log=logger;
    this.root=fs.realpathSync(root); this.dir=path.join(this.root,'.artifacts');
    fs.mkdirSync(this.dir,{recursive:true}); confined(this.root,this.dir);
    this.file=path.join(this.dir,'state.json'); this.lock=path.join(this.dir,'write.lock');
  }
  read() {
    let text;
    try { text=fs.readFileSync(this.file,'utf8'); }
    catch(error) { if(error.code==='ENOENT') return {schema:1,revision:0,artifacts:[],events:[]}; throw error; }
    const state=JSON.parse(text);
    if(state.schema!==1) throw new ArtifactError('SCHEMA_VERSION','无法读取此版本的审阅数据',{schema:state.schema});
    return state;
  }
  transact(operation, fn) {
    try { fs.mkdirSync(this.lock); }
    catch(error) { if(error.code==='EEXIST') throw new ArtifactError('BUSY','另一进程正在保存审阅数据；稍后重试。若进程已异常退出，请检查 .artifacts/write.lock。',{operation},error); throw error; }
    const temporary=path.join(this.dir,`state-${crypto.randomUUID()}.tmp`);
    try {
      fs.writeFileSync(path.join(this.lock,'owner.json'),JSON.stringify({pid:process.pid,operation,time:new Date().toISOString()}));
      const state=this.read(), result=fn(state);
      state.revision++;
      state.events.push({sequence:state.revision,operation,artifactId:result?.id,at:new Date().toISOString()});
      const fd=fs.openSync(temporary,'wx');
      try { fs.writeFileSync(fd,JSON.stringify(state,null,2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary,this.file);
      this.log('info',operation,{revision:state.revision,artifactId:result?.id});
      return result;
    } catch(error) { this.log('error',operation,{root:this.root},error); throw error; }
    finally { fs.rmSync(temporary,{force:true}); fs.rmSync(this.lock,{recursive:true}); }
  }
  source(relative) {
    required(relative,'path');
    const absolute=confined(this.root,path.resolve(this.root,relative));
    if(path.relative(this.dir,absolute)==='' || !path.relative(this.dir,absolute).startsWith('..')) throw new ArtifactError('INTERNAL_FILE','不能把审阅数据库登记为产物',{relative});
    return absolute;
  }
  find(state,id) {
    const artifact=state.artifacts.find(item=>item.id===id);
    if(!artifact) throw new ArtifactError('NOT_FOUND','产物不存在',{id});
    return artifact;
  }
  current(artifact) {
    const absolute=this.source(artifact.path), bytes=fs.readFileSync(absolute);
    const textual=/\.(md|markdown|resolved|txt|json|js|mjs|cjs|ts|tsx|jsx|css|py|html|htm|diff|patch|yaml|yml|toml|xml|csv|sql|sh|ps1|go|rs|java|c|cpp|h|log)$/i.test(absolute);
    return {hash:hash(bytes),content:textual?bytes.toString('utf8'):null,size:bytes.length};
  }
  view(artifact) {
    const current=this.current(artifact), latest=artifact.versions.at(-1);
    const decision=latest && artifact.decisions.filter(x=>x.version===latest.id).at(-1);
    return {...artifact,current,status:!latest?'draft':latest.hash!==current.hash?'changed':decision?.decision??'pending',latestVersion:latest?.id};
  }
  list() { return this.read().artifacts.map(a=>{const v=this.view(a);return {id:a.id,path:a.path,title:a.title,type:a.type,status:v.status,latestVersion:v.latestVersion,commentCount:a.comments.length};}); }
  get(id) { return this.view(this.find(this.read(),id)); }
  register({path:relative,title,type='document'}) {
    const absolute=this.source(relative), normalized=path.relative(this.root,absolute).split(path.sep).join('/');
    return this.transact('register',state=>{
      const existing=state.artifacts.find(a=>a.path.toLowerCase()===normalized.toLowerCase());
      if(existing)return existing;
      const artifact={id:crypto.randomUUID(),path:normalized,title:title||path.basename(absolute),type,versions:[],comments:[],decisions:[]};
      state.artifacts.push(artifact);return artifact;
    });
  }
  submit({id,expectedHash}) {
    return this.transact('submit-review',state=>{
      const a=this.find(state,id), current=this.current(a); this.checkHash(current.hash,expectedHash,id);
      if(a.versions.at(-1)?.hash===current.hash)return a;
      if(current.content===null){
        const bytes=fs.readFileSync(this.source(a.path));this.checkHash(hash(bytes),expectedHash,id);
        const blobs=path.join(this.dir,'blobs');fs.mkdirSync(blobs,{recursive:true});confined(this.dir,blobs);
        current.blob=current.hash+path.extname(a.path).toLowerCase();
        const target=path.join(blobs,current.blob);
        if(fs.existsSync(target)){this.checkHash(hash(fs.readFileSync(confined(blobs,target))),expectedHash,id);this.log('debug','reuse-snapshot',{id,blob:current.blob});}
        else fs.writeFileSync(target,bytes,{flag:'wx'});
      }
      a.versions.push({id:crypto.randomUUID(),number:a.versions.length+1,...current,submittedAt:new Date().toISOString()});return a;
    });
  }
  checkHash(actual,expected,id) { if(actual!==expected)throw new ArtifactError('STALE_CONTENT','文档已改变，请刷新后重新操作',{id,expected,actual}); }
  addComment({id,version,text,selection}) {
    required(text,'comment');
    return this.transact('add-comment',state=>{
      const a=this.find(state,id), v=a.versions.find(v=>v.id===version);
      if(!v)throw new ArtifactError('VERSION_NOT_FOUND','先提交此文档进行审阅',{id,version});
      if(!selection || typeof selection.quote!=='string' || typeof selection.before!=='string' || typeof selection.after!=='string')throw new ArtifactError('INVALID_SELECTION','批注缺少选区上下文',{id});
      if(selection.box){
        const {x,y,width,height}=selection.box;
        if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>1.001||y+height>1.001)throw new ArtifactError('INVALID_SELECTION','批注区域超出页面或图片范围',{id,box:selection.box});
      }
      if(selection.page!==undefined&&(!Number.isInteger(selection.page)||selection.page<1))throw new ArtifactError('INVALID_SELECTION','PDF 页码必须是正整数',{id,page:selection.page});
      if(selection.imageDataUrl!==undefined&&!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(selection.imageDataUrl))throw new ArtifactError('INVALID_SELECTION','批注截图必须是 PNG 图像',{id});
      a.comments.push({id:crypto.randomUUID(),version,text,selection,resolved:false,replies:[],createdAt:new Date().toISOString()});return a;
    });
  }
  comment({id,commentId,action,text}) {
    return this.transact('update-comment',state=>{
      const a=this.find(state,id), c=a.comments.find(c=>c.id===commentId);
      if(!c)throw new ArtifactError('COMMENT_NOT_FOUND','批注不存在',{id,commentId});
      if(action==='reply')c.replies.push({id:crypto.randomUUID(),text:required(text,'reply'),at:new Date().toISOString()});
      else if(action==='edit')c.text=required(text,'comment');
      else if(action==='resolve')c.resolved=true;
      else if(action==='reopen')c.resolved=false;
      else if(action==='delete')a.comments=a.comments.filter(c=>c.id!==commentId);
      else throw new ArtifactError('INVALID_ACTION','不支持的批注操作',{action});
      return a;
    });
  }
  decide({id,version,expectedHash,decision,note=''}) {
    if(!['approved','changes_requested'].includes(decision))throw new ArtifactError('INVALID_DECISION','不支持的审批结果',{decision});
    return this.transact('human-decision',state=>{
      const a=this.find(state,id), latest=a.versions.at(-1);
      if(!latest || latest.id!==version)throw new ArtifactError('STALE_VERSION','只能审批最新提交的版本',{id,version});
      this.checkHash(latest.hash,expectedHash,id);this.checkHash(this.current(a).hash,expectedHash,id);
      a.decisions.push({version,decision,note,at:new Date().toISOString(),actor:'human-ui'});return a;
    });
  }
  compare({id,from,to}) {
    const a=this.get(id), first=a.versions.find(v=>v.id===from), second=to==='current'?a.current:a.versions.find(v=>v.id===to);
    if(!first||!second)throw new ArtifactError('VERSION_NOT_FOUND','比较版本不存在',{id,from,to});
    if(first.content===null||second.content===null)return {binary:true,changed:first.hash!==second.hash};
    return {binary:false,parts:diffLines(first.content,second.content)};
  }
  events(after=0) { return this.read().events.filter(e=>e.sequence>after); }
  publishFeedback({id,version,note=''}){
    return this.transact('publish-feedback',state=>{
      const a=this.find(state,id);
      if(!a.versions.some(v=>v.id===version))throw new ArtifactError('VERSION_NOT_FOUND','提交意见的版本不存在',{id,version});
      const comments=a.comments.filter(c=>c.version===version&&!c.resolved);
      if(!comments.length&&!note.trim())throw new ArtifactError('EMPTY_FEEDBACK','没有待提交的批注或补充意见',{id,version});
      a.feedback??=[];
      a.feedback.push({id:crypto.randomUUID(),number:a.feedback.length+1,version,note,comments:structuredClone(comments),submittedAt:new Date().toISOString()});
      return a;
    });
  }
  feedback(id,after=0){return (this.find(this.read(),id).feedback??[]).filter(f=>f.number>after);}
  snapshotMedia(id,version){
    const a=this.find(this.read(),id),v=a.versions.find(v=>v.id===version);
    if(!v?.blob)throw new ArtifactError('NO_MEDIA_SNAPSHOT','该版本没有保存的媒体快照',{id,version});
    return confined(path.join(this.dir,'blobs'),path.join(this.dir,'blobs',v.blob));
  }
}
module.exports={Store,ArtifactError,log,hash,confined};
