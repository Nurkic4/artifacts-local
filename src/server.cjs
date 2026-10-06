const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createGzip}=require('node:zlib');
const {pipeline}=require('node:stream');
const {Store,ArtifactError,log,confined}=require('./core.cjs');
const {execute}=require('./operations.cjs');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.pdf':'application/pdf','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav'};
async function startServer(root,{port=0,host='127.0.0.1',token=crypto.randomBytes(32).toString('hex'),readOnly=false,assets=path.resolve(__dirname,typeof __ARTIFACTS_WEB_DIR__==='string'?__ARTIFACTS_WEB_DIR__:'../dist/web')}={}) {
 Object.assign(mime,{'.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ogg':'audio/ogg','.m4a':'audio/mp4'});
 const store=new Store(root);
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!==`${host}:${req.socket.localPort}`)throw new ArtifactError('BAD_HOST','访问地址无效');
   const url=new URL(req.url,`http://${req.headers.host}`);
   if(req.headers.origin && req.headers.origin!==url.origin)throw new ArtifactError('BAD_ORIGIN','拒绝跨来源请求');
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
   if(url.pathname==='/api'){
    if(req.method!=='POST'||req.headers.authorization!==`Bearer ${token}`)throw new ArtifactError('UNAUTHORIZED','请求未授权');
    let body='';for await(const chunk of req){body+=chunk;if(body.length>2e6)throw new ArtifactError('TOO_LARGE','请求超过大小限制');}
    const {operation,args}=JSON.parse(body);
    if(readOnly&&!['get','list'].includes(operation))throw new ArtifactError('READ_ONLY','服务器阅读页不接受写入操作');
    const value=execute(store,operation,args);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));return;
   }
   if(req.method!=='GET')throw new ArtifactError('METHOD','此路径只支持读取');
   let file;
   if(url.pathname==='/media'){
    if(url.searchParams.get('token')!==token)throw new ArtifactError('UNAUTHORIZED','资源请求未授权');
    file=url.searchParams.has('version')?store.snapshotMedia(url.searchParams.get('id'),url.searchParams.get('version')):store.source(url.searchParams.get('path'));
    if(!mime[path.extname(file).toLowerCase()])throw new ArtifactError('UNSUPPORTED_MEDIA','此文件类型不能作为预览资源');
    res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'");
   }else file=confined(fs.realpathSync(assets),path.join(assets,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname)));
   const stat=fs.statSync(file);
   const gzip=stat.size>1024&&/\.(html|js|mjs|css|svg)$/i.test(file)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
   const etag=`"${stat.size}-${stat.mtimeMs}${gzip?'-gzip':''}"`;
   res.setHeader('Vary','Accept-Encoding');
   res.setHeader('ETag',etag);res.setHeader('Cache-Control',url.pathname==='/media'?'private, no-cache':'no-cache');
   if(req.headers['if-none-match']===etag){res.statusCode=304;res.end();return;}
   res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');
   if(gzip)res.setHeader('Content-Encoding','gzip');else res.setHeader('Content-Length',stat.size);
   const streams=[fs.createReadStream(file),...(gzip?[createGzip()]:[]),res];
   pipeline(...streams,error=>{if(error)log(error.code==='ERR_STREAM_PREMATURE_CLOSE'?'info':'error','stream-resource',{file},error);});
  }catch(error){
   log('error','http-request',{path:req.url?.split('?')[0]},error);
   res.statusCode=error instanceof ArtifactError?400:error.code==='ENOENT'?404:500;
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:error.code||'INTERNAL',message:error.message,context:error.context}}));
  }
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const url=`http://${host}:${server.address().port}/#token=${token}`;
 return {server,store,url,token,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
module.exports={startServer};
if(require.main===module){
 const root=process.argv[2]||process.cwd();startServer(root,{port:Number(process.env.ARTIFACTS_PORT||0)}).then(({url})=>console.log(url)).catch(error=>{log('error','start-server',{root},error);process.exitCode=1;});
}
