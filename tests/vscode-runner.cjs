const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vscode=require('vscode');
exports.run=async()=>{
 const ext=vscode.extensions.getExtension('local-artifacts.artifacts-local');assert.ok(ext,'Extension installed');const api=await ext.activate();
 const root=vscode.workspace.workspaceFolders[0].uri,uri=vscode.Uri.joinPath(root,'plan.md');
 await vscode.commands.executeCommand('artifacts.open',uri);
 const store=api.storeFor(uri),list=store.list(),planEntry=list.find(item=>item.path==='plan.md');assert.ok(planEntry);
 const document=await vscode.workspace.openTextDocument(uri);const edit=new vscode.WorkspaceEdit();edit.insert(uri,new vscode.Position(0,0),'# Unsaved\n');await vscode.workspace.applyEdit(edit);assert.equal(document.isDirty,true);
 // Custom editor keeps VS Code's document model; a normal save updates the same source.
 await document.save();assert.equal(document.isDirty,false);assert.match(store.get(planEntry.id).current.content,/# Unsaved/);
 const generatedName=`agent-output-${Date.now()}.md`,generated=vscode.Uri.joinPath(root,generatedName);
 await vscode.workspace.fs.writeFile(generated,Buffer.from('# Agent output\nDisplayed automatically\n'));
 let preview;
 const deadline=Date.now()+8000;
 while(Date.now()<deadline){
  preview=vscode.window.tabGroups.all.flatMap(group=>group.tabs).find(tab=>tab.input?.viewType==='artifacts.preview'&&tab.input.uri?.toString()===generated.toString());
  if(preview&&store.list().some(item=>item.path===generatedName))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(preview,'A newly created Markdown file should open its Artifacts preview automatically');
 assert.ok(store.list().some(item=>item.path===generatedName));
 fs.writeFileSync(path.join(root.fsPath,'extension-test-result.json'),JSON.stringify({activated:true,customEditorOpened:true,registered:true,documentSave:true,autoPresentNewMarkdown:true}));
};
