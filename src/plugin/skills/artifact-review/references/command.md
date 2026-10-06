# 命令行展示

定位当前安装包目录：插件包与独立包的根目录均包含 `present.cjs` 和 `web/`。使用安装目录的绝对路径，不依赖终端的当前目录。需要 Node.js 22 或更新版本。

```text
node <安装目录>/present.cjs <项目绝对路径> docs/result.md docs/chart.svg docs/appendix.md
```

第一个参数是项目绝对路径，第二个是 Markdown 路径，其余是文档必要的本地资源或链接文档，路径相对工作区。命令在项目的 `.artifacts/pages` 生成阅读页，在 `.artifacts/runtime` 缓存解析组件，返回本地文件网址后退出。不会读取旧服务器配置，也不启动网页服务。

用宿主浏览器入口打开返回网址。在 Codex 中使用 `open_in_codex` 的 `target: {type: "browser", url: "返回网址"}`。不要使用普通文件入口打开 HTML，那会显示源码；`previewPath` 仅供明确支持 HTML 渲染的预览器使用。若宿主拒绝本地 HTML，提供源 Markdown 并报告限制，不自动上传。修改 Markdown 后重新运行并刷新页面。

迁移电脑时复制整个工作区，包含 `.artifacts`，已生成页面使用相对路径；也可只复制源文件，在新电脑重新生成阅读页。不要把此命令和配置说明放进普通交付文档的正文。
