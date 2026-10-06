/* Original runtime is intentionally loaded unmodified before this adapter. */
(() => {
 const h=z.createElement;
 const localPage=window.ARTIFACTS_LOCAL_PAGE;
 const assetBase=new URL('.',localPage?new URL(localPage.assetBase,location.href):document.currentScript.src);
 const viewerNonce=document.currentScript.nonce;
 ric.workerSrc=new URL('workers/pdf.worker.mjs',assetBase).href;
 // Original math renderer normally inserts a CDN stylesheet. The same stylesheet is bundled locally.
 eic=true;
 const vscode=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
 const waiting=new Map();
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(localPage&&!fragment.has('artifact'))fragment.set('artifact',localPage.entry);
 const token=fragment.get('token');
 const presentation=fragment.get('mode')!=='review';
 // VS Code rewrites window.parent to window. Its host relay keeps this origin;
 // sandboxed HTML children have an opaque ("null") origin and must not drive the bridge.
 if(vscode)window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const m=event.data;if(m.kind==='response'){const job=waiting.get(m.requestId);if(job){waiting.delete(m.requestId);m.error?job.reject(new Error(m.error.message)):job.resolve(m.value);}}else if(m.kind==='open')window.dispatchEvent(new CustomEvent('artifact-open',{detail:m.id}));});
 async function request(operation,args={}) {
  if(localPage){
   if(operation==='list')return localPage.documents;
   if(operation==='get'){const doc=localPage.documents.find(d=>d.id===args.id);if(!doc)throw Error('本地阅读页未包含文档：'+args.id);return doc;}
   throw Error('本地阅读页不支持此操作：'+operation);
  }
  if(vscode){const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{waiting.set(requestId,{resolve,reject});vscode.postMessage({kind:'request',requestId,operation,args});});}
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({operation,args})});
  const result=await response.json();if(result.error)throw new Error(`${result.error.message} [${result.error.code}]`);return result.value;
 }
 function resource(relative) { if(localPage){const url=localPage.resources[relative];if(!url)throw Error('本地阅读页缺少资源：'+relative);return new URL(url,location.href).href;}return vscode?new URL(relative,window.ARTIFACTS_MEDIA_BASE).href:`/media?path=${encodeURIComponent(relative)}&token=${encodeURIComponent(token)}`; }
 const originalTheme=new wi({uiTheme:'vs-dark'}),tokens=new qqc(originalTheme.getState(),originalTheme).getState();
 const originalState={colorThemeProvider:new wi({type:'dark'})};
 const toolkit={core:{analyticsService:{fireEvent:(name,detail)=>console.debug('[original-ui]',name,detail),logObservabilityData:data=>console.debug('[original-ui]',data),logError:(...args)=>console.error('[original-ui]',...args)}},editor:{clipboardService:{writeClipboardText:text=>navigator.clipboard.writeText(text)}}};
 const baselineFeatures=oka._currentValue;
 const features={...baselineFeatures,get:name=>name==='inputComponent'?{enableMicrophone:false}:baselineFeatures.get(name)};
 const labels={draft:'草稿',pending:'等待审阅',approved:'已批准',changes_requested:'要求修改',changed:'内容已变化，需重新审阅'};
 function Wrapped({children}) {return h(Oba.Provider,{value:toolkit},h(Hj.Provider,{value:originalState},h(dy.Provider,{value:{}},h(oka.Provider,{value:features},children))));}
 function HtmlReview({content,title}){
  const html=z.useMemo(()=>{
   const doc=new DOMParser().parseFromString(content,'text/html');
   doc.querySelectorAll('base,meta[http-equiv]').forEach(el=>el.remove());
   // Isolated inline scripts can update their own page. They cannot read the review page or contact a server.
   const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';
   policy.content=`default-src 'none'; script-src ${viewerNonce?"'nonce-"+viewerNonce+"'":"'unsafe-inline'"}; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; form-action 'none'; base-uri 'none';`;
   doc.head.prepend(policy);
   if(viewerNonce){
    doc.querySelectorAll('script').forEach(el=>el.setAttribute('nonce',viewerNonce));
    // Inline event attributes are disallowed by the editor CSP. Attach their handlers from one allowed child script.
    const handlers=[];let index=0;
    doc.querySelectorAll('*').forEach(el=>{for(const attr of Array.from(el.attributes)){if(/^on[a-z]+$/i.test(attr.name)){const key=String(++index);el.setAttribute('data-art-event-'+key,'');handlers.push(`document.querySelector('[data-art-event-${key}]').addEventListener(${JSON.stringify(attr.name.slice(2))},function(event){${attr.value}\n});`);el.removeAttribute(attr.name);}}});
    if(handlers.length){const script=doc.createElement('script');script.setAttribute('nonce',viewerNonce);script.textContent=handlers.join('\n');doc.body.appendChild(script);}
   }
   return '<!doctype html>'+doc.documentElement.outerHTML;
  },[content]);
  return h('iframe',{className:'art-frame',sandbox:'allow-scripts',srcDoc:html,title});
 }
 class RenderBoundary extends z.Component {
  constructor(p){super(p);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('原版组件渲染失败',{artifact:this.props.artifact,...info},error);}
  render(){return this.state.error?h('div',{className:'art-error'},'原版组件渲染失败：'+this.state.error.message):this.props.children;}
 }
 function App(){
  const [items,setItems]=z.useState([]),[id,setId]=z.useState(vscode?vscode.getState()?.id:fragment.get('artifact')),[artifact,setArtifact]=z.useState(null),[version,setVersion]=z.useState('current'),[error,setError]=z.useState(''),[busy,setBusy]=z.useState(false),[modal,setModal]=z.useState(null),[diff,setDiff]=z.useState(null),[unsaved,setUnsaved]=z.useState(null);
  const currentId=z.useRef(null);currentId.current=id;
  const lastView=z.useRef('');
  async function refresh(selected=currentId.current){
   if(!presentation){const list=await request('list');setItems(old=>JSON.stringify(old)===JSON.stringify(list)?old:list);}
   if(selected){const next=await request('get',{id:selected});if(currentId.current!==selected)return;const serialized=JSON.stringify(next);if(lastView.current!==serialized){lastView.current=serialized;setArtifact(next);}}
  }
  function report(error,operation){console.error('Artifacts 操作失败',{operation,id:currentId.current},error);setError(error.message);}
  async function run(operation,args){setBusy(true);setError('');try{const result=await request(operation,args);try{await refresh();}catch(error){report(new Error('操作已保存，但刷新页面失败：'+error.message,{cause:error}),'refresh-after:'+operation);}return result;}catch(error){report(error,operation);throw error;}finally{setBusy(false);}}
  function perform(operation,args){run(operation,args).catch(error=>console.warn('界面操作未完成，请按页面错误提示重试',{operation,id:args.id},error));}
  z.useEffect(()=>{
   refresh().catch(e=>report(e,'initial-load'));
   let stopped=false,inFlight=false;
   const interval=localPage?null:setInterval(async()=>{if(stopped||inFlight||document.hidden)return;inFlight=true;try{await refresh();}catch(e){report(e,'refresh');}finally{inFlight=false;}},2500);
   const open=e=>{setId(e.detail);setVersion('current');setDiff(null);};window.addEventListener('artifact-open',open);
   const hashChange=()=>{if(!vscode){const selected=new URLSearchParams(location.hash.slice(1)).get('artifact');if(selected!==currentId.current)setId(selected);}};
   window.addEventListener('hashchange',hashChange);
   if(vscode)vscode.postMessage({kind:'ready'});
   return()=>{stopped=true;clearInterval(interval);window.removeEventListener('artifact-open',open);window.removeEventListener('hashchange',hashChange);};
  },[]);
  z.useEffect(()=>{setArtifact(null);lastView.current='';setVersion('current');setDiff(null);setUnsaved(null);if(id)refresh(id).catch(e=>report(e,'open'));},[id]);
  z.useEffect(()=>{if(vscode)vscode.setState({id});else{const params=new URLSearchParams(location.hash.slice(1));if(id)params.set('artifact',id);else params.delete('artifact');history.replaceState(null,'','#'+params);}},[id]);
  const snapshot=artifact&&(version==='current'?artifact.versions.at(-1):artifact.versions.find(v=>v.id===version));
  const content=artifact?(version==='current'?artifact.current.content:snapshot?.content):'';
  const canComment=artifact&&snapshot&&(version!=='current'||snapshot.hash===artifact.current.hash)&&!artifact.editorDirty;
  const visibleComments=artifact&&snapshot?artifact.comments.filter(c=>c.version===snapshot.id):[];
  const [focusComment,setFocusComment]=z.useState(null);
  async function saveSelection(selection,text){
   const args={id,version:snapshot.id,text,selection};setUnsaved(args);
   try{await run('addComment',args);setUnsaved(null);}catch(error){console.warn('批注未保存，保留重试内容',{id,version:snapshot.id},error);}
  }
  async function submitComment(selection,text){
   const args={id,version:snapshot.id,text,selection:{quote:selection.context.textSelection,before:selection.context.beforeText,after:selection.context.afterText,startLine:selection.context.startLine,endLine:selection.context.endLine}};
   setUnsaved(args);
   try{await run('addComment',args);setUnsaved(null);}catch(error){console.warn('批注未保存，保留重试内容',{id,version:snapshot.id},error);}
  }
  function markdown(){
   const base=new URL(artifact.path,'file:///workspace/');
   const isMarkdown=/\.(md|markdown|resolved)$/i.test(artifact.path),fence='`'.repeat(Math.max(3,...[...content.matchAll(/`+/g)].map(m=>m[0].length+1)));
   const renderedText=isMarkdown?(presentation?nvb(content)?.body??content:content):`${fence}${artifact.path.split('.').at(-1)}\n${content}\n${fence}`;
   const props={markdown:renderedText,parseFrontmatter:isMarkdown&&!presentation,baseDirUri:base.href.slice(0,base.href.lastIndexOf('/')+1),tokenizationService:tokens,MermaidDiagram:Cqc,latexFeature:fic,getHtmlAttributes:Gzb,
    resolveArtifactUrl:url=>{const resolved=new URL(url,base);if(resolved.protocol==='file:')return resource(decodeURIComponent(resolved.pathname).replace(/^\/workspace\//,''));return resolved.href;},
    artifactsDir:base.href.slice(0,base.href.lastIndexOf('/')),
    openUri:uri=>{const resolved=new URL(String(uri),base);if(['http:','https:','mailto:'].includes(resolved.protocol)){if(vscode)vscode.postMessage({kind:'external',uri:resolved.href});else window.open(resolved.href,'_blank','noopener,noreferrer');}else if(resolved.protocol==='file:'){request('list').then(list=>{const target=decodeURIComponent(resolved.pathname).replace(/^\/workspace\//,'');const existing=list.find(a=>a.path===target)||list.find(a=>encodeURI(a.path)===target);if(existing)return existing;if(presentation)throw new Error('关联文档尚未发布，请让 Agent 一并提供：'+target);return request('register',{path:target});}).then(a=>{setError('');setId(a.id);}).catch(e=>report(e,'open-link'));}else report(new Error('不支持的链接类型：'+resolved.protocol),'open-link');}
   };
   const rendered=h(TY,props);
   if(!canComment||presentation)return rendered;
   return h(QK,{key:`${id}:${snapshot.id}`,fileUri:base.href,fileContents:content,isArtifact:true,activeCommentTarget:focusComment,onActiveCommentTargetFocused:()=>setFocusComment(null),
    pendingComments:visibleComments.filter(c=>!c.resolved&&c.selection.quote).map(c=>({id:c.id,comment:c.text,initialPositioning:{textSelection:c.selection.quote,beforeText:c.selection.before,afterText:c.selection.after,startLine:c.selection.startLine,endLine:c.selection.endLine}})),
    submitComment,removeComment:commentId=>perform('comment',{id,commentId,action:'delete'}),editComment:(commentId,text)=>perform('comment',{id,commentId,action:'edit',text})},rendered);
  }
  function media(){
   const ext=artifact.path.split('.').at(-1).toLowerCase(),url=version==='current'?resource(artifact.path):snapshot.blob?(vscode?resource('.artifacts/blobs/'+snapshot.blob):`/media?id=${id}&version=${snapshot.id}&token=${encodeURIComponent(token)}`):null;
   if(!url)return h('p',{className:'art-error'},'此旧版本没有媒体快照，不能用当前文件代替历史内容。');
   const fileUri=new URL(artifact.path,'file:///workspace/').href;
   const edits={editComment:(commentId,text)=>perform('comment',{id,commentId,action:'edit',text}),deleteComment:commentId=>perform('comment',{id,commentId,action:'delete'})};
   if(['png','jpg','jpeg','gif','webp','svg','ico'].includes(ext))return canComment&&!presentation?h(ImageReview,{src:url,alt:artifact.title,className:'art-media',fileUri,comments:visibleComments.filter(c=>!c.resolved&&c.selection.kind==='image').map(c=>({id:c.id,comment:c.text,selection:c.selection.box,initialPositioning:{textSelection:'',beforeText:'',afterText:'',startLine:1,endLine:1}})),...edits,activeCommentTarget:focusComment,onActiveCommentTargetFocused:()=>setFocusComment(null),onSubmitComment:(selection,text)=>{
    const crop=selection.croppedMedia?.payload;
    const imageDataUrl=crop?.case==='inlineData'?'data:image/png;base64,'+btoa(Array.from(crop.value,b=>String.fromCharCode(b)).join('')):undefined;
    if(!imageDataUrl)console.error('原版图片裁剪未返回截图，保留区域坐标',{id,selection});
    saveSelection({kind:'image',quote:'',before:'',after:'',box:{x:selection.x,y:selection.y,width:selection.width,height:selection.height},imageDataUrl},text);
   }}):h('img',{className:'art-media',src:url,alt:artifact.title});
   if(['mp4','webm'].includes(ext))return h('video',{className:'art-media',src:url,controls:true});
   if(['mp3','wav','ogg','m4a'].includes(ext))return h(Fyb,{url,filename:artifact.title});
   if(ext==='pdf')return h(PdfReview,{url,fileUri,enabled:canComment,comments:visibleComments,...edits,onComment:c=>saveSelection({kind:c.type==='image'?'pdf-image':'pdf-text',page:c.pageNumber,quote:c.targetText||'',before:'',after:'',startLine:c.pageNumber,endLine:c.pageNumber,box:c.box,rects:c.rects,imageDataUrl:c.imageDataUrl},c.comment)});
   return h('p',{className:'art-error'},'尚不支持此文件类型的内嵌预览。');
  }
  function button(text,fn,disabled=false,primary=false){return h('button',{className:'art-control'+(primary?' art-primary':''),onClick:fn,disabled:busy||disabled},text);}
  const status=artifact?labels[artifact.status]:'';
  if(presentation)return h('main',{className:'art-present','aria-label':'Artifacts 文档预览'},
   error&&h('div',{role:'alert',className:'art-error'},error),
   !artifact?h('section',{className:'art-empty'},h('p',null,id?'正在读取文档…':'等待 Agent 展示文档')):
   h('article',{className:'art-present-document',key:`${id}:${artifact.current.hash}`},h(RenderBoundary,{artifact:id},h(Wrapped,null,content===null?media():/\.html?$/i.test(artifact.path)?h(HtmlReview,{content,title:artifact.title}):markdown()))));
  return h(z.Fragment,null,
   h('header',{className:'art-toolbar'},h('h1',null,'Artifacts'),h('select',{className:'art-control','aria-label':'选择产物',value:id||'',onChange:e=>setId(e.target.value||null)},h('option',{value:''},'选择文档'),...items.map(a=>h('option',{key:a.id,value:a.id},`${a.title} · ${labels[a.status]}`))),button('登记文档',()=>setModal({kind:'register',title:'登记工作区文件',placeholder:'相对工作区路径，例如 docs/plan.md'})),artifact&&button('提交当前版本',()=>perform('submit',{id,expectedHash:artifact.current.hash})),artifact&&button('批准',()=>setModal({kind:'decision',decision:'approved',title:'批准当前版本',placeholder:'可选说明',version:artifact.latestVersion,expectedHash:artifact.current.hash}),!snapshot||artifact.status==='changed'||version!=='current',true),artifact&&button('要求修改',()=>setModal({kind:'decision',decision:'changes_requested',title:'说明需要修改什么',placeholder:'输入审阅意见',version:artifact.latestVersion,expectedHash:artifact.current.hash}),!snapshot||artifact.status==='changed'||version!=='current')),
   error&&h('div',{role:'alert',className:'art-error'},error),
   artifact?.editorDirty&&h('div',{className:'art-note'},'编辑器有未保存修改：这里显示磁盘中已保存的内容。保存正文后才能提交审阅或批准。'),
   artifact&&h('div',{className:'art-toolbar'},h('span',null,status),h('span',{className:'art-muted'},artifact.path),h('label',null,'版本 ',h('select',{className:'art-control','aria-label':'选择版本',value:version,onChange:e=>{setVersion(e.target.value);setDiff(null);}},h('option',{value:'current'},'当前文件'),...artifact.versions.map(v=>h('option',{key:v.id,value:v.id},`第 ${v.number} 版`)))),button(diff?'返回预览':'对比当前文件',()=>{if(diff)setDiff(null);else run('compare',{id,from:snapshot.id,to:'current'}).then(setDiff).catch(e=>console.warn('版本比较未完成',e));},!snapshot)),
   artifact&&!canComment&&h('div',{className:'art-note'},'当前文件尚未提交，或内容已改变。点击“提交当前版本”后可保存审阅意见。'),
   !artifact?h('section',{className:'art-empty'},h('h2',null,id?'正在读取文档…':'在原版预览中审阅工作成果'),h('p',null,'登记工作区内的文档，提交一个版本后即可选中文字批注。批注和审批保存在工作区的 .artifacts 目录。'),h('p',{className:'art-muted'},'预览、代码着色、流程图、文字选区与浮动批注使用本机 Antigravity 2.19.1 原版组件。')):
   h('main',{className:'art-layout'},h('section',{className:'art-document','aria-label':'文档预览'},h(RenderBoundary,{key:`${id}:${version}:${artifact.current.hash}`,artifact:id},h(Wrapped,null,diff?h('pre',{className:'art-diff'},diff.binary?`二进制内容${diff.changed?'已变化':'未变化'}`:diff.parts.map((p,i)=>h('span',{key:i,className:p.added?'art-added':p.removed?'art-removed':''},p.value))):content===null?media():/\.html?$/i.test(artifact.path)?h(HtmlReview,{content,title:artifact.title}):markdown()))),
    h('aside',{className:'art-aside'},h('h2',null,`批注 · ${visibleComments.length}`),canComment&&button('整篇批注',()=>setModal({kind:'whole',title:'对整个文档批注',placeholder:'输入意见',version:snapshot.id})),unsaved&&h('div',{className:'art-error'},h('p',null,'有一条未保存的批注：'+unsaved.text),button('重试保存',()=>run('addComment',unsaved).then(()=>setUnsaved(null)).catch(e=>console.warn('批注重试未完成',e)))),
     ...visibleComments.map(c=>h('article',{className:'art-comment',key:c.id},h('span',{className:'art-muted'},c.resolved?'已处理':'未处理'),c.selection.page&&h('p',{className:'art-muted'},`第 ${c.selection.page} 页`),c.selection.quote&&h('blockquote',null,c.selection.quote),c.selection.imageDataUrl&&h('img',{src:c.selection.imageDataUrl,alt:'批注区域截图'}),c.selection.kind==='image'&&button('定位区域',()=>setFocusComment({id:c.id,mode:'view'})),h('p',null,c.text),...c.replies.map(r=>h('p',{key:r.id,className:'art-muted'},'回复：'+r.text)),h('div',{className:'art-actions'},button('回复',()=>setModal({kind:'comment',action:'reply',commentId:c.id,title:'回复批注'})),button('编辑',()=>setModal({kind:'comment',action:'edit',commentId:c.id,title:'编辑批注',initial:c.text})),button(c.resolved?'重新打开':'标记处理',()=>perform('comment',{id,commentId:c.id,action:c.resolved?'reopen':'resolve'})),button('删除',()=>setModal({kind:'delete',commentId:c.id,title:'删除这条批注？'}))))),
     artifact.comments.some(c=>c.version!==snapshot?.id)&&h('details',null,h('summary',null,'其他版本的批注'),...artifact.comments.filter(c=>c.version!==snapshot?.id).map(c=>h('p',{key:c.id,className:'art-muted'},`第 ${artifact.versions.find(v=>v.id===c.version)?.number} 版：${c.text}`))),
     h('h2',{style:{marginTop:24}},'审批记录'),...artifact.decisions.map((d,i)=>h('p',{key:i},`第 ${artifact.versions.find(v=>v.id===d.version)?.number} 版 · ${labels[d.decision]}${d.note?' · '+d.note:''}`)),
     h('p',{className:'art-muted',style:{marginTop:24}},'审批只适用于提交的版本。文档改变后需要重新审阅。反馈已保存在本地，AI 可通过 Artifacts 工具读取。'))),
   artifact&&snapshot&&h('footer',{className:'art-toolbar'},h('span',{className:'art-muted'},`已提交 ${(artifact.feedback||[]).length} 轮意见`),button('提交本轮意见',()=>setModal({kind:'feedback',version:snapshot.id,title:'提交本轮审阅意见',placeholder:'可选补充说明；将保存当前版本的全部未处理批注'}),!canComment),h('span',{className:'art-muted'},'提交后，可让助手读取本轮意见并修订文档。')),
   modal&&h(Dialog,{key:JSON.stringify(modal),config:modal,busy,onClose:()=>setModal(null),onSubmit:async text=>{
    try{
     if(modal.kind==='register'){const a=await run('register',{path:text});setId(a.id);}
     else if(modal.kind==='decision')await run('decide',{id,version:modal.version,expectedHash:modal.expectedHash,decision:modal.decision,note:text});
     else if(modal.kind==='whole')await run('addComment',{id,version:modal.version,text,selection:{quote:'',before:'',after:'',startLine:1,endLine:1}});
     else if(modal.kind==='feedback')await run('publishFeedback',{id,version:modal.version,note:text});
     else await run('comment',{id,commentId:modal.commentId,action:modal.kind==='delete'?'delete':modal.action,text});
     setModal(null);
    }catch(error){console.warn('对话框保留，等待用户修正操作',error);}
   }}));
 }
 function ImageReview(props){
  const [data,setData]=z.useState(null),[error,setError]=z.useState(null),scope=z.useContext(yC);
  // Image comments have one canvas rather than Markdown line numbers. Supply its draft position.
  const draftScope=z.useMemo(()=>{const initial={surface:'file',lineNumber:1};return {...scope,drafts:{...scope.drafts,getDraft:(uri,key)=>scope.drafts.getDraft(uri,key)??initial}};},[scope]);
  z.useEffect(()=>{let active=true;setData(null);setError(null);(async()=>{
   const response=await fetch(props.src);if(!response.ok)throw new Error(`图片读取失败 (${response.status}): ${props.fileUri}`);
   const blob=await response.blob();const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
   if(active)setData(url);
  })().catch(error=>{console.error('原版图片审阅资源加载失败',{file:props.fileUri},error);if(active)setError(error);});return()=>{active=false;};},[props.src]);
  if(error)return h('p',{className:'art-error'},error.message);
  return data?h(yC.Provider,{value:draftScope},h(Kyb,{...props,src:data})):h('p',null,'正在加载图片…');
 }
 function PdfReview({url,fileUri,enabled,comments,onComment,editComment,deleteComment}){
  const [ready,setReady]=z.useState(false),[error,setError]=z.useState(null);
  z.useEffect(()=>{let active=true;zic??=(async()=>{
   const library=await import(new URL('workers/pdf.min.mjs',assetBase).href);
   if(vscode){
    // Editor resource URLs are served by its page service worker. Load bytes here
    // so the PDF background worker does not depend on that page-only URL bridge.
    const response=await fetch(new URL('workers/pdf.worker.mjs',assetBase));
    if(!response.ok)throw new Error(`PDF worker 加载失败：${response.status} ${response.statusText}`);
    ric.workerSrc=URL.createObjectURL(new Blob([await response.arrayBuffer()],{type:'text/javascript'}));
   }
   return library;
  })();zic.then(()=>{if(active)setReady(true);},error=>{console.error('PDF 依赖加载失败',{fileUri},error);if(active)setError(error);});return()=>{active=false;};},[]);
  if(error)return h('p',{className:'art-error'},'PDF 加载失败：'+error.message);
  if(!ready)return h('p',null,'正在加载 PDF…');
  return h('div',{className:'art-pdf'},h(vZ,{url,fileUri,pendingAnnotations:comments.filter(c=>!c.resolved&&c.selection.kind?.startsWith('pdf-')).map(c=>({id:c.id,pageNumber:c.selection.page,type:c.selection.kind==='pdf-image'?'image':'text',box:c.selection.box,rects:c.selection.rects,targetText:c.selection.quote,comment:c.text})),onComment:enabled?onComment:()=>setError(new Error('请先提交当前版本再添加页内批注。')),onUpdateComment:editComment,onDeleteComment:deleteComment}));
 }
 function Dialog({config,busy,onClose,onSubmit}){const [text,setText]=z.useState(config.initial||'');return h('div',{className:'art-modal'},h('form',{className:'art-dialog',role:'dialog','aria-modal':true,'aria-label':config.title,onSubmit:e=>{e.preventDefault();onSubmit(text);}},h('h2',null,config.title),config.kind!=='delete'&&h('textarea',{autoFocus:true,className:'art-field','aria-label':config.title,value:text,placeholder:config.placeholder,onChange:e=>setText(e.target.value),required:!['decision','feedback'].includes(config.kind)}),h('div',{className:'art-actions',style:{marginTop:14}},h('button',{type:'submit',className:'art-control art-primary',disabled:busy},busy?'保存中…':'确认'),h('button',{type:'button',className:'art-control',onClick:onClose,disabled:busy},'取消'))));}
 window.addEventListener('error',event=>console.error('Artifacts 页面错误',event.error||event.message));
 Bu.createRoot(document.getElementById('artifacts-app')).render(h(App));
})();
