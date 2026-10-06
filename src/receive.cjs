const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Store,confined,log}=require('./core.cjs');
function receive(config,payload){
 if(!/^[a-f0-9]{24}$/.test(payload.namespace)||!Array.isArray(payload.files)||!payload.files.length)throw Error('无效的文档发送数据');
 const root=fs.realpathSync(config.root),prefix=`projects/${payload.namespace}`;
 // Validate the complete batch before writing any file.
 const files=payload.files.map(file=>{
  if(typeof file.path!=='string'||file.path.includes('\\')||file.path.split('/').some(part=>!part||part==='.'||part==='..'||part==='.artifacts')||path.isAbsolute(file.path))throw Error('无效的文档相对路径：'+file.path);
  if(!/\.(md|markdown|resolved|png|jpe?g|gif|webp|svg|pdf|woff2?)$/i.test(file.path))throw Error('不支持的文档资源：'+file.path);
  return {...file,full:path.join(root,prefix,file.path),bytes:Buffer.from(file.data,'base64')};
 });
 if(!files.some(file=>file.path===payload.entry)||! /\.(md|markdown|resolved)$/i.test(payload.entry))throw Error('缺少 Markdown 主文档');
 for(const file of files){
  const relative=path.relative(root,path.dirname(file.full));let directory=root;
  for(const component of relative.split(path.sep)){directory=path.join(directory,component);if(!fs.existsSync(directory))fs.mkdirSync(directory);confined(root,directory);}
  if(fs.existsSync(file.full))confined(root,file.full);
  const temp=file.full+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,file.bytes,{flag:'wx',mode:0o600});fs.renameSync(temp,file.full);
 }
 const store=new Store(root);
 for(const file of files)if(file.path!==payload.entry&&/\.(md|markdown|resolved)$/i.test(file.path))store.register({path:prefix+'/'+file.path});
 const artifact=store.register({path:prefix+'/'+payload.entry});
 const token=fs.readFileSync(config.tokenFile,'utf8').trim();
 return {url:`http://${config.host}:${config.port}/#token=${token}&artifact=${artifact.id}`,artifactId:artifact.id,path:payload.entry,interface:'persistent-server'};
}
module.exports={receive};
if(require.main===module)(async()=>{
 const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));let body='';
 for await(const chunk of process.stdin){body+=chunk;if(Buffer.byteLength(body)>20*1024*1024)throw Error('发送内容超过 20 MB');}
 console.log(JSON.stringify(receive(config,JSON.parse(body))));
})().catch(error=>{log('error','receive-document',{config:process.argv[2]},error);process.exitCode=1;});
