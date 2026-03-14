# Pixelclaw Office

像素办公室可视化系统 - 基于 HTML5 Canvas 的等距投影办公室场景。

**版本**: 1.2.0

## 功能特性

- **主可视化**：等距像素办公室场景，Agent 动画（待机 / 走动 / 工作 / 对话 / 等待 / 错误）
- **Agent 管理**：添加、配置、对话，支持多状态展示，可选择头像与人物模型
- **地图编辑器**：拖拽布局、碰撞编辑、格子笔/橡皮/取色/填充、裁剪、撤销重做、应用为当前地图
- **点阵资产系统**：点阵资产创建与管理（已并入地图编辑器）
- **多视图模式**：Agent 列表支持列表、紧凑、图标、长条等展示方式
- **面板 Tab 化**：总览 / 任务 / 数据 三栏切换
- **任务看板**：四列 Kanban（待办 / 进行中 / 需确认 / 完成），可关联 Agent
- **数据面板**：Token 用量与成本（支持 DataProvider 对接 OpenClaw）
- **区域标签**：地图编辑器支持添加、拖拽、编辑区域标签（会议室、研发区等）

## 快速开始

### 本地运行

1. 进入 `openclaw-client` 目录
2. 启动开发服务器（PowerShell）：
   ```powershell
   .\server.ps1
   ```
3. 浏览器访问 http://localhost:8088

### 页面说明

| 页面 | 说明 |
|------|------|
| `index.html` | 主页面 - 像素办公室可视化 |
| `editor.html` | 地图编辑器 |
| `asset-system.html` | 点阵资产系统 |

## 技术栈

- HTML5 Canvas 2D
- 原生 JavaScript
- CSS3

## 版本历史

| 版本 | 说明 |
|------|------|
| [v1.2.0](https://github.com/FrankeyQu/Pixelclaw-Office/releases/tag/v1.2.0) | 面板 Tab 化、任务看板、数据面板、Agent 状态增强（error/waiting）、地图区域标签与拖拽、OpenClaw 对接方案 |
| [v1.1.0](https://github.com/FrankeyQu/Pixelclaw-Office/releases/tag/v1.1.0) | 地图编辑器增强（像素工具、撤销重做、裁剪、碰撞编辑优化）、Agent 头像与模型选择、当前地图编辑 |
| v1.0.0 | 初始版本 |

## License

**授权使用说明**：本项目仅授权个人学习与个人非商业使用。未经授权，不得用于任何商业目的或商业盈利行为。
