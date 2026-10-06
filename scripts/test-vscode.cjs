const fs=require('node:fs');
const path=require('node:path');
const {runTests}=require('@vscode/test-electron');
const root=path.resolve(__dirname,'..'),workspace=path.join(root,'work/vscode-test');
fs.mkdirSync(workspace,{recursive:true});fs.writeFileSync(path.join(workspace,'plan.md'),'# VS Code test\nShared original preview\n');
runTests({vscodeExecutablePath:process.env.VSCODE_EXECUTABLE_PATH,extensionDevelopmentPath:path.join(root,'dist/vscode'),extensionTestsPath:path.join(root,'tests/vscode-runner.cjs'),launchArgs:[workspace,'--user-data-dir='+path.join(root,'work/vscode-test-profile'),'--extensions-dir='+path.join(root,'work/vscode-test-extensions'),'--disable-workspace-trust','--skip-welcome','--skip-release-notes','--disable-updates']}).catch(error=>{console.error('VS Code integration test failed',error);process.exitCode=1;});
