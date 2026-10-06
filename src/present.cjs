const path=require('node:path');
const {log}=require('./core.cjs');
const {localPage}=require('./local-page.cjs');

async function main(workspace,file){
 if(!workspace||!file)throw Error('用法：node present.cjs <工作区绝对路径> <Markdown 文件路径>');
 if(!path.isAbsolute(workspace))throw Error('工作区必须是绝对路径：'+workspace);
 if(!/\.(md|markdown|resolved)$/i.test(file))throw Error('需要 Markdown 文件路径：'+file);
 console.log(localPage(workspace,file,process.argv.slice(4)).url);
}
if(require.main===module)main(process.argv[2],process.argv[3]).catch(error=>{log('error','present-markdown',{workspace:process.argv[2],file:process.argv[3]},error);process.exitCode=1;});
