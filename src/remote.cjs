const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {confined}=require('./core.cjs');
function remoteConfig(){
 const file=process.env.ARTIFACTS_CONFIG||path.join(os.homedir(),'.codex','artifacts.json');
 if(!fs.existsSync(file))return null;
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
function publishRemote(workspace,file,assets=[],config=remoteConfig()){
 const root=fs.realpathSync(workspace);
 const files=[...new Set([file,...assets])].map(relative=>{
  const full=confined(root,path.resolve(root,relative));
  if(!/\.(md|markdown|resolved|png|jpe?g|gif|webp|svg|pdf|woff2?)$/i.test(full))throw Error('不支持发送的文件类型：'+relative);
  if(fs.statSync(full).size>12*1024*1024)throw Error('文件超过 12 MB：'+relative);
  return {path:path.relative(root,full).split(path.sep).join('/'),data:fs.readFileSync(full).toString('base64')};
 });
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/.test(config.sshHost)||!/^\/[a-zA-Z0-9_./-]+$/.test(config.receiver)||!/^\/[a-zA-Z0-9_./-]+$/.test(config.serverConfig))throw Error('Artifacts SSH 配置包含不支持的主机或路径');
 const namespace=crypto.createHash('sha256').update(os.hostname()+'\0'+root).digest('hex').slice(0,24);
 const input=JSON.stringify({namespace,entry:files[0].path,files});
 if(Buffer.byteLength(input)>20*1024*1024)throw Error('本次展示文件总量超过 20 MB');
 const result=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10',config.sshHost,`node ${config.receiver} ${config.serverConfig}`],{input,env:{...process.env,...config.sshEnv},encoding:'utf8',timeout:60000,maxBuffer:1024*1024,windowsHide:true});
 if(result.error)throw new Error('发送 Markdown 到服务器失败：'+file,{cause:result.error});
 if(result.status!==0)throw Error(`服务器展示失败 (${result.status})：${file}\n${result.stderr}`);
 return JSON.parse(result.stdout);
}
module.exports={remoteConfig,publishRemote};
