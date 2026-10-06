---
name: artifacts-present
description: 展示 Agent 写好的 Markdown 文档；交付方案、报告、说明等 .md 文件时使用。用户只阅读成品，不操作工作流。
---

自行决定是否需要独立文档，先保存普通 `.md`，再展示；不要为了使用工具而新建文档。

有 `artifacts_present` 工具时，提供项目绝对路径 `workspace`、文档路径 `path`。文档引用本地图片或其他 Markdown 时，将必要文件的工作区相对路径放入 `assets`。工具生成本地阅读页，不上传文档，不启动网页服务。使用宿主的文件或浏览器展示能力打开返回的 `url` 或 `previewPath`，并提供源 Markdown 链接。

修改源文件后再次调用同一入口，然后刷新阅读页；页面展示生成时的内容。宿主拒绝本地 HTML 时，明确报告限制并提供源 Markdown，不自动改为上传或启动服务。

工具不可用时按需读取 [命令行入口](references/command.md)。展示失败时按需读取 [展示排查](references/connection.md)。无需预先加载这些细节。
