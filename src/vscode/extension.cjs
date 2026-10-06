const vscode=require('vscode');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Store,ArtifactError}=require('../core.cjs');
const {execute}=require('../operations.cjs');
function activate(context){
 const output=vscode.window.createOutputChannel('Artifacts',{log:true});context.subscriptions.push(output);
 const assets=vscode.Uri.joinPath(context.extensionUri,'web');
 const stores=new Map();
 function storeFor(uri){
  if(!vscode.workspace.isTrusted)throw new ArtifactError('UNTRUSTED','请先信任此工作区再保存审阅数据');
  const folder=vscode.workspace.getWorkspaceFolder(uri);
  if(!folder||uri.scheme!=='file')throw new ArtifactError('NO_WORKSPACE','请把本地文档所在文件夹作为工作区打开');
  if(!stores.has(folder.uri.fsPath))stores.set(folder.uri.fsPath,new Store(folder.uri.fsPath,(level,operation,details,error)=>output[level](operation,JSON.stringify(details),...(error?[error]:[]))));
  return stores.get(folder.uri.fsPath);
 }
 async function resolveCustomTextEditor(document,panel){
  const store=storeFor(document.uri),artifact=store.register({path:document.uri.fsPath});
  const webview=panel.webview;webview.options={enableScripts:true,localResourceRoots:[assets,vscode.Uri.file(store.root)]};
  const nonce=crypto.randomBytes(20).toString('hex');
  let html=fs.readFileSync(path.join(assets.fsPath,'index.html'),'utf8');
  html=html.replace(/(src|href)="([^":]+\.(?:js|css))"/g,(_,attr,file)=>`${attr}="${webview.asWebviewUri(vscode.Uri.joinPath(assets,file))}"`);
  const csp=`default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; worker-src blob: ${webview.cspSource}; connect-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: blob: https:; media-src ${webview.cspSource}; font-src ${webview.cspSource} data: blob:; frame-src ${webview.cspSource} about:;`;
  html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${csp}">`).replace(/<script /g,`<script nonce="${nonce}" `);
  const base=webview.asWebviewUri(vscode.Uri.file(store.root+path.sep)).toString();
  html=html.replace('<div id="artifacts-app">',`<script nonce="${nonce}">window.ARTIFACTS_MEDIA_BASE=${JSON.stringify(base)};</script><div id="artifacts-app">`);
  const disposable=webview.onDidReceiveMessage(async message=>{
   try{
    if(message.kind==='ready'){await webview.postMessage({kind:'open',id:artifact.id});return;}
    if(message.kind==='external'){
     const uri=vscode.Uri.parse(message.uri);
     if(!['https','http','mailto'].includes(uri.scheme))throw Error('不支持的外部链接：'+uri.scheme);
     await vscode.env.openExternal(uri);return;
    }
    if(message.kind!=='request')throw Error('无法识别的页面消息');
    const {operation,args}=message;
    if(['submit','decide'].includes(operation)){
     const target=store.get(args.id),uri=vscode.Uri.file(store.source(target.path));
     const open=vscode.workspace.textDocuments.find(d=>d.uri.toString()===uri.toString());
     if(open?.isDirty)throw new ArtifactError('UNSAVED_DOCUMENT','此文档有未保存修改，请在文本编辑器中保存后再提交或批准',{path:target.path});
    }
    const value=execute(store,operation,args);
    if(operation==='get'){
     const uri=vscode.Uri.file(store.source(value.path));
     value.editorDirty=!!vscode.workspace.textDocuments.find(d=>d.uri.toString()===uri.toString())?.isDirty;
    }
    await webview.postMessage({kind:'response',requestId:message.requestId,value});
   }catch(error){
    output.error('页面操作失败',JSON.stringify({file:document.uri.fsPath,operation:message.operation,code:error.code}),error);
    if(message.kind==='request')await webview.postMessage({kind:'response',requestId:message.requestId,error:{message:error.message,code:error.code}});
    else vscode.window.showErrorMessage('Artifacts：'+error.message);
   }
  });
  panel.onDidDispose(()=>disposable.dispose());webview.html=html;
 }
 context.subscriptions.push(vscode.window.registerCustomEditorProvider('artifacts.preview',{resolveCustomTextEditor},{webviewOptions:{retainContextWhenHidden:true},supportsMultipleEditorsPerDocument:true}));
 context.subscriptions.push(vscode.window.registerCustomEditorProvider('artifacts.media',{openCustomDocument:uri=>({uri,dispose(){}}),resolveCustomEditor:resolveCustomTextEditor},{webviewOptions:{retainContextWhenHidden:true},supportsMultipleEditorsPerDocument:true}));
 context.subscriptions.push(vscode.commands.registerCommand('artifacts.open',async uri=>{
  try{
   const target=uri||vscode.window.activeTextEditor?.document.uri;
   if(!target)throw Error('请先选择一个文档');
   await vscode.commands.executeCommand('vscode.openWith',target,/\.(png|jpe?g|gif|webp|svg|ico|pdf|mp4|webm|mp3|wav|ogg|m4a)$/i.test(target.path)?'artifacts.media':'artifacts.preview');
  }catch(error){output.error('打开产物失败',error);vscode.window.showErrorMessage('Artifacts：'+error.message);throw error;}
 }));
 const markdownFiles=vscode.workspace.createFileSystemWatcher('**/*.{md,markdown,resolved}',false,true,true);
 context.subscriptions.push(markdownFiles,markdownFiles.onDidCreate(uri=>{
  if(uri.scheme!=='file'||!vscode.workspace.isTrusted)return;
  if(/\/(node_modules|\.git|\.artifacts)\//.test(uri.path))return;
  output.info('Agent 文档已创建，打开 Artifacts 预览',JSON.stringify({file:uri.fsPath}));
  vscode.commands.executeCommand('artifacts.open',uri).then(undefined,error=>output.error('自动打开 Markdown 预览失败',JSON.stringify({file:uri.fsPath}),error));
 }));
 return {storeFor};
}
module.exports={activate};
