# mahiro-wiki

## 用文章管理页发布

在 Windows 双击 `start-editor.cmd`，浏览器会打开本机的文章管理页。也可以从仓库目录运行 `python scripts/editor.py`。首次启动需要 Python 3.10 或更新版本和构建依赖，发布使用本机已有的 GitHub 登录。

1. 点「新建」，写标题和正文。日期默认为当天，分类可以直接填写，或选用已有分类。
2. 点「预览」查看 Markdown 排版。想稍后再发，可以点「保存到本地」。
3. 点「发布到网站」并确认。编辑器会把当前填写的文章保存下来，提交 `posts/` 中待发布的 Markdown 改动，再推送 `main` 上待发布的提交。GitHub Actions 完成后网站就会更新。

删除时先在文章列表打开对应的文章，点「删除文章」并确认，再点「发布到网站」。原有 Ubuntu 或 macOS 环境也可以用 Python 命令启动编辑器。文章管理页随仓库提供，在本机运行。

「链接与封面」可以选择仓库里已有的插画。想用自己的图片时，先把图片放进 `assets/` 并提交到仓库。

## 发一篇文章

在 `posts/` 下新建一个 Markdown 文件，例如 `posts/my-first-post.md`。

```markdown
---
title: "我的第一篇文章"
date: 2026-11-19
category: "技术学习"
summary: "在首页显示的一句话摘要。"
cover: "assets/covers/code.svg"
readingTime: "3 分钟"
---

## 第一节

从这里开始写正文。正文支持 Markdown 的标题、链接、列表、图片和代码块。
```

- 文件名使用小写英文字母、数字和连字符。文章链接由文件名决定，例如 `#post/my-first-post`。文章发布后保留文件名，已有链接就能继续使用。
- 标题、日期、分类和摘要必填。文章按日期倒序显示，新分类会自动出现在筛选栏。
- 封面和阅读时长可省略。省略封面时使用默认插画。自定义封面或正文图片放进 `assets/`，在文章中引用 `assets/文件名`。
- 纯正文的 Markdown 会留在本地作为草稿。用编辑器补齐文章信息并保存，就会进入待发布列表。
- 可添加 `featured: true` 将文章放进首页「正在翻阅」卡片。多篇文章设置时选日期最新的一篇。`example: true` 用于标记示例文章。

## 本地预览

需要 Python 3.10 或更新版本。首次运行安装构建依赖。

```sh
python -m pip install -r requirements.txt
python scripts/build.py
python -m http.server 8000 --directory dist
```

浏览器打开 `http://localhost:8000/`。编辑文章后，在另一个终端重新运行 `python scripts/build.py`，然后刷新页面。构建脚本会检查必填信息和封面路径，生成可直接托管的 `dist/`。

## 发布到 GitHub Pages

首次发布时，在仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。之后将文章和新增图片提交到 `main`，工作流会构建并发布站点。也可以将 `dist/` 部署到其他静态托管服务。

## 代码入口

- `index.html` 是首页。独立模块的内容和共用布局在 `pages/`，构建后生成 `articles.html`、`archive.html`、`projects.html` 和 `about.html`。
- `scripts/build.py` 读取 Markdown，渲染正文并生成文章索引。
- `js/main.js` 初始化页面功能。
- `js/journal.js` 管理文章卡片、搜索、分类和归档。
- `js/reader.js` 管理文章链接、阅读弹窗和下一篇。
- `js/clock.js` 管理时钟和日历。
