# Virga 悬雨

Virga 是 QQNT 的纯色主题。雾白、石墨和雨青贯穿聊天、联系人、弹窗与 QQ 频道。

[下载 Virga-0.1.17.zip](https://github.com/DrSmoothl/Virga/releases/download/v0.1.17/Virga-0.1.17.zip) · [查看版本](https://github.com/DrSmoothl/Virga/releases)

<img src="packages/plugin/assets/overview.png" alt="云下雨幕与 Virga 字标" width="680">

## 安装

需要能正常加载插件的 [LiteLoaderQQNT](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT)。

1. 下载上面的 ZIP，在 LiteLoaderQQNT 的插件管理中导入。
2. 重启 QQ。在 QQ 设置侧栏打开 **Virga 悬雨**。也可以从 LiteLoaderQQNT 设置里的 **打开 Virga 设置** 进入。

也可以手动安装。将 ZIP 内容解压到 LiteLoaderQQNT 的插件目录下的 `virga/`，确认 `manifest.json` 直接位于 `virga/` 中，然后重启 QQ。

## 外观与交互

- 分别调整浅色和深色外观、主题色、字体与动效。设置会自动保存，并同步到已打开的窗口。
- 连续消息按发送者成组，头像贴齐末条气泡。输入框随草稿增高，从 **+** 展开 QQ 原有工具栏。
- 导航栏可以自动收起，也可以隐藏单个入口和角标。把鼠标移到窗口左缘可展开导航栏。按 `⌘ + Shift + ;`（macOS）或 `Ctrl + Shift + ;`（Windows/Linux）可恢复全部入口和角标。

## 开发

使用 Node.js 24.12+ 和 `package.json` 中固定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 会检查类型、运行测试，并在 `release/` 生成安装 ZIP。`pnpm dev` 打开设置页预览。`pnpm test:browser` 使用 Chrome 验证界面与交互，也可通过 `VIRGA_CHROMIUM` 指定 Chromium。
