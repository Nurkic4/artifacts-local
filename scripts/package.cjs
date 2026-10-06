const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const {createVSIX}=require('@vscode/vsce');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
function copySamples(source,target){
 fs.mkdirSync(target,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  if(entry.name==='.artifacts')continue;
  const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isDirectory())copySamples(from,to);else if(entry.isFile())fs.copyFileSync(from,to);else throw Error('示例包不支持特殊文件：'+from);
 }
}
async function main(){
 require('./build.cjs');
 const vscode=path.join(dist,'vscode'),plugin=path.join(dist,'codex-plugin'),standalone=path.join(dist,'standalone');
 for(const dir of [vscode,plugin,standalone]){fs.mkdirSync(dir,{recursive:true});fs.cpSync(path.join(dist,'web'),path.join(dir,'web'),{recursive:true});for(const name of ['README.md','NOTICE.md'])fs.copyFileSync(path.join(root,name),path.join(dir,name));fs.mkdirSync(path.join(dir,'docs'),{recursive:true});fs.copyFileSync(path.join(root,'docs/开发说明.md'),path.join(dir,'docs/开发说明.md'));}
 copySamples(path.join(root,'samples'),path.join(standalone,'samples'));
 fs.copyFileSync(path.join(root,'src/vscode/package.json'),path.join(vscode,'package.json'));
 await esbuild.build({entryPoints:[path.join(root,'src/vscode/extension.cjs')],outfile:path.join(vscode,'extension.cjs'),bundle:true,platform:'node',target:'node20',external:['vscode']});
 fs.cpSync(path.join(root,'src/plugin'),plugin,{recursive:true});
 await esbuild.build({entryPoints:[path.join(root,'src/mcp.cjs')],outfile:path.join(plugin,'mcp.cjs'),bundle:true,platform:'node',target:'node22',define:{__ARTIFACTS_WEB_DIR__:'"./web"'}});
 await esbuild.build({entryPoints:[path.join(root,'src/present.cjs')],outfile:path.join(plugin,'present.cjs'),bundle:true,platform:'node',target:'node22',define:{__ARTIFACTS_WEB_DIR__:'"./web"'}});
 await esbuild.build({entryPoints:[path.join(root,'src/server.cjs')],outfile:path.join(standalone,'server.cjs'),bundle:true,platform:'node',target:'node22',define:{__ARTIFACTS_WEB_DIR__:'"./web"'}});
 await esbuild.build({entryPoints:[path.join(root,'src/present.cjs')],outfile:path.join(standalone,'present.cjs'),bundle:true,platform:'node',target:'node22',define:{__ARTIFACTS_WEB_DIR__:'"./web"'}});
 for(const name of ['service','receive','local-page'])await esbuild.build({entryPoints:[path.join(root,`src/${name}.cjs`)],outfile:path.join(standalone,`${name}.cjs`),bundle:true,platform:'node',target:'node22',define:{__ARTIFACTS_WEB_DIR__:'"./web"'}});
 const output=path.join(dist,'artifacts-local-0.1.0.vsix');
 await createVSIX({cwd:vscode,packagePath:output,dependencies:false,allowMissingRepository:true,skipLicense:true});
 console.log('Local packages:',output,plugin,standalone);
}
main().catch(error=>{console.error('Packaging failed',error);process.exitCode=1;});
