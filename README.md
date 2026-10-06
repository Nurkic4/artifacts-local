# Artifacts · Agent 的本地 Markdown 展示工具

注：这是根据提取到的 Antigravity 程序内部的 Markdown 文档审查器 Artifacts 工具进行开发的项目。

本地 Agent 保存一份 Markdown 文档后，会通过 `artifacts_present` 生成本地阅读页给用户。默认内容留在本地，不需要服务器或本地网页服务。

这是原版 Antigravity 渲染组件的适配源码仓库。使用前必须自行准备相关内容并导入资源，详见 [开发说明](docs/开发说明.md) 和 [版权说明](NOTICE.md)。

## 展示流程

1. Agent 写入 `.md` 源文件。
2. 调用 `artifacts_present`，传入工作区绝对路径、文档相对路径和必要的本地资源路径。
3. 工具生成 `.artifacts/pages` 阅读快照，返回本地文件网址和预览路径。
4. Agent 在宿主支持的文件或浏览器面板中打开阅读页。修改源文件后再次调用并刷新。

页面使用本地缓存的渲染资源，支持标题、表格、代码、流程图、数学公式和本地图片。已生成的快照及资源采用相对路径，可以随整个工作区迁移。

<img width="1003" height="1214" alt="image" src="https://github.com/user-attachments/assets/5b538c98-9801-4342-a0f2-5dcf5431668a" />

## 开发入口

```text
npm ci
node scripts/import-renderer.cjs <已提取资源目录的绝对路径>
npm run build
npm test
node src/present.cjs <项目绝对路径> docs/result.md docs/chart.svg
```

需要 Node.js 22 或更新版本。源码可通过 MCP（模型调用工具的协议）接入 Agent，也保留 VS Code 扩展入口。技能采用按需读取的说明，不依赖固定用户名、桌面目录或服务器地址。
