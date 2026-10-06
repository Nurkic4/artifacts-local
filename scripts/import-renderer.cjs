const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const fingerprint='47f36abaabd34f7d54a95df40d942b609c02db9f5c04d56b124a048571b9f16d';
const files=['main.js','prism_bundle.js','jetbox.css','compiled_tailwind.css','theme.css','katex.min.css','index.html'];
function importRenderer(source,destination=path.resolve(__dirname,'../research/original-viewer')){
 if(!source||!path.isAbsolute(source))throw Error('用法：node scripts/import-renderer.cjs <已提取资源目录的绝对路径>');
 source=fs.realpathSync(source);
 if(source===path.resolve(destination))throw Error('导入来源不能是目标资源目录：'+source);
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'main.js'))).digest('hex');
 if(actual!==fingerprint)throw Error('不支持的 Antigravity main.js 版本：'+actual);
 const entries=[];
 function collect(relative){
  const absolute=path.join(source,relative),stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink())throw Error('资源导入不接受符号链接：'+absolute);
  if(stat.isDirectory())for(const name of fs.readdirSync(absolute))collect(path.join(relative,name));
  else if(stat.isFile())entries.push(relative);
  else throw Error('资源导入不接受特殊文件：'+absolute);
 }
 for(const name of [...files,'fonts','workers'])collect(name);
 for(const name of ['pdfjs_loader.mjs','pdf.min.mjs','pdf.worker.mjs'])fs.accessSync(path.join(source,'workers',name));
 if(!fs.readFileSync(path.join(source,'index.html'),'utf8').includes('<header'))throw Error('缺少 index.html 本地页面外壳的 <header 分界：'+source);
 for(const relative of entries){const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,relative),target);}
 return {files:entries.length,fingerprint};
}
if(require.main===module){
 try{console.log('Imported local renderer:',importRenderer(process.argv[2]));}
 catch(error){console.error('Renderer import failed',{source:process.argv[2],error});process.exitCode=1;}
}
module.exports={importRenderer};
