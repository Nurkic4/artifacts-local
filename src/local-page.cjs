const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {confined,log}=require('./core.cjs');
function copyRuntime(source,target){
 fs.mkdirSync(target,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isDirectory())copyRuntime(from,to);else if(entry.isFile())fs.copyFileSync(from,to);else throw Error('解析资源不支持特殊文件：'+from);
 }
}
function localPage(workspace,file,assets=[],web=path.resolve(__dirname,typeof __ARTIFACTS_WEB_DIR__==='string'?__ARTIFACTS_WEB_DIR__:'../dist/web')){
 const root=fs.realpathSync(workspace);
 const files=[...new Set([file,...assets])].map(relative=>{
  const full=confined(root,path.resolve(root,relative));
  return {path:path.relative(root,full).split(path.sep).join('/'),full};
 });
 if(!/\.(md|markdown|resolved)$/i.test(files[0].path))throw Error('展示入口需要 Markdown 文件：'+file);
 const documents=files.filter(f=>/\.(md|markdown|resolved)$/i.test(f.path)).map(f=>{
  const bytes=fs.readFileSync(f.full);
  return {id:crypto.createHash('sha256').update(f.path).digest('hex').slice(0,32),path:f.path,current:{content:bytes.toString('utf8'),hash:crypto.createHash('sha256').update(bytes).digest('hex')},versions:[],comments:[]};
 });
 const outDir=path.join(root,'.artifacts','pages');fs.mkdirSync(outDir,{recursive:true});
 confined(root,outDir);
 // Cache a complete renderer in the workspace; generated pages survive package moves and updates.
 const fingerprint=crypto.createHash('sha256');
 function hashDirectory(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(dir,entry.name);if(entry.isDirectory())hashDirectory(full);else{fingerprint.update(path.relative(web,full));fingerprint.update(fs.readFileSync(full));}}}
 hashDirectory(web);
 const runtimeParent=path.join(root,'.artifacts','runtime');fs.mkdirSync(runtimeParent,{recursive:true});confined(root,runtimeParent);
 const runtime=path.join(runtimeParent,fingerprint.digest('hex').slice(0,24));
 if(fs.existsSync(runtime))confined(root,runtime);
 const complete=path.join(runtime,'.complete');
 if(!fs.existsSync(complete)){
  log('info','prepare-local-renderer',{workspace:root,runtime});
  copyRuntime(web,runtime);fs.writeFileSync(complete,'ready','utf8');
 }
 const relativeUrl=full=>path.relative(outDir,full).split(path.sep).map(part=>encodeURIComponent(part)).join('/');
 const resources=Object.fromEntries(files.map(f=>[f.path,relativeUrl(f.full)]));
 const payload={documents,resources,entry:documents[0].id,assetBase:relativeUrl(path.join(runtime,'app.js'))};
 const output=path.join(outDir,documents[0].id+'.html');if(fs.existsSync(output))confined(root,output);
 const json=JSON.stringify(payload).replace(/</g,'\\u003c');
 let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
 html=html.replace(/(src|href)="([^":]+\.(?:js|css))"/g,(_,attribute,name)=>`${attribute}="${relativeUrl(path.join(runtime,name))}"`);
 html=html.replace('<div id="artifacts-app">',`<script>window.ARTIFACTS_LOCAL_PAGE=${json};</script><div id="artifacts-app">`);
 // Freeze this page's adapter so later package updates cannot invalidate saved document data.
 const adapter=fs.readFileSync(path.join(web,'app.js'),'utf8').replace(/<\/script/gi,'<\\/script');
 html=html.replace(/<script src="[^"]*\/app\.js"><\/script>/,()=>`<script>${adapter}</script>`);
 fs.writeFileSync(output,html,'utf8');
 return {url:pathToFileURL(output).href,path:files[0].path,previewPath:output,interface:'local-file',artifactId:documents[0].id};
}
module.exports={localPage};
if(require.main===module){try{console.log(JSON.stringify(localPage(process.argv[2],process.argv[3],process.argv.slice(4))));}catch(error){log('error','local-page',{workspace:process.argv[2],file:process.argv[3]},error);process.exitCode=1;}}
