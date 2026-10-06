const fs=require('node:fs');
const {startServer}=require('./server.cjs');
const {log}=require('./core.cjs');
const configPath=process.argv[2];
(async()=>{
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 const token=fs.readFileSync(config.tokenFile,'utf8').trim();
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('服务器读取密钥无效：'+config.tokenFile);
 const view=await startServer(config.root,{host:config.host,port:config.port,token,readOnly:true});
 log('info','service-start',{host:config.host,port:config.port,root:config.root});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>view.close().catch(error=>{log('error','service-stop',{signal},error);process.exitCode=1;}));
})().catch(error=>{log('error','service-start',{configPath},error);process.exitCode=1;});
