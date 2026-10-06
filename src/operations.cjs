const {ArtifactError}=require('./core.cjs');
function execute(store,operation,args={}) {
 switch(operation){
  case 'list':return store.list();
  case 'get':return store.get(args.id);
  case 'register':return store.register(args);
  case 'submit':store.submit(args);return store.get(args.id);
  case 'addComment':store.addComment(args);return store.get(args.id);
  case 'comment':store.comment(args);return store.get(args.id);
  case 'decide':store.decide(args);return store.get(args.id);
  case 'compare':return store.compare(args);
  case 'events':return store.events(args.after);
  case 'publishFeedback':store.publishFeedback(args);return store.get(args.id);
  default:throw new ArtifactError('UNKNOWN_OPERATION','不支持的操作',{operation});
 }
}
module.exports={execute};
