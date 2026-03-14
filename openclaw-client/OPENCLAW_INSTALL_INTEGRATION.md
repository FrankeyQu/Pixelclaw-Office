# Pixelclaw Office — 从 GitHub 安装并自动对接 OpenClaw 方案

## 目标

用户通过一条命令从 GitHub 安装 Pixelclaw Office，并自动与本地 OpenClaw Gateway 对接，无需手动配置。

---

## 三种对接方式对比

| 方案 | 安装方式 | 自动化程度 | 可行性 | 说明 |
|------|----------|------------|--------|------|
| **A. OpenClaw 原生 install** | `openclaw install owner/repo` | 高 | 中 | 需符合 ClawHub/Skill 规范，Pixelclaw Office 是 Dashboard 形态，适配成本较高 |
| **B. 独立安装脚本（推荐）** | `npx create-pixelclaw-office` 或 `curl \| bash` | 高 | 高 | 不依赖 OpenClaw 规范，自管安装与配置 |
| **C. npm 全局包** | `npm i -g pixelclaw-office` | 中 | 高 | 类似 LobsterBoard，包内带启动脚本和配置向导 |

---

## 推荐方案：B — 独立安装脚本

### 流程

```
用户执行安装命令
    → 拉取 Pixelclaw Office 代码（GitHub / npmmirror）
    → 写入配置文件（自动检测 Gateway 地址、Token）
    → 启动服务（静态 + API 代理）
    → 浏览器打开 http://localhost:8088
```

### 优点

1. **一条命令**：`npx create-pixelclaw-office@latest` 或 `curl -fsSL https://raw.../install.sh | bash`
2. **自动对接**：脚本读取 `~/.openclaw/` 或环境变量，生成 `.env`
3. **不依赖 OpenClaw 机制**：无需 Skill 包装，实现简单
4. **适用场景广**：本机、Docker、内网均可按需调整

---

## 实施要点

### 1. 安装入口

| 入口 | 命令 | 说明 |
|------|------|------|
| npx | `npx create-pixelclaw-office@latest` | 使用 npm 包，可带版本号 |
| curl | `curl -fsSL https://raw.githubusercontent.com/xxx/install.sh \| bash` | 无 Node 时用 Git + 静态服务 |
| npm 全局 | `npm i -g pixelclaw-office && pixelclaw-office` | 持久安装，类似 LobsterBoard |

### 2. 自动检测 OpenClaw

```
1. 检查 OPENCLAW_GATEWAY_URL 环境变量
2. 默认 http://127.0.0.1:18789
3. Token：尝试读取 ~/.openclaw/config 或 OPENCLAW_TOKEN
4. 若无法获取 Token，生成 .env.example，提示用户填写
```

### 3. 项目结构（安装后）

```
~/.pixelclaw-office/  或  ./pixelclaw-office/
├── openclaw-client/      # 从 GitHub 拉取的代码
│   ├── index.html
│   ├── pixel-office.js
│   ├── license.js
│   └── ...
├── .env                  # 自动生成，含 GATEWAY_URL、TOKEN
├── api-proxy.js          # 代理层（若有）
└── start.sh / start.ps1  # 启动脚本
```

### 4. 安装脚本职责

- 检测 Node.js（如需代理）
- 拉取代码（git clone 或 degit）
- 生成 `.env`（自动 + 可选交互）
- 安装依赖（仅在有 api-proxy 等 Node 模块时）
- 启动服务并输出访问地址

---

## 与 OpenClaw Skill 的关系

若希望未来支持 `openclaw install owner/Pixelclaw-Office`，可额外做：

1. **Skill 包装**：增加 `SKILL.md`、`index.js`，提供「启动 Pixelclaw Office」工具
2. **ClawHub 发布**：满足 ClawHub 格式后发布，供 `clawhub install` 使用

当前仍以 **方案 B** 为主路径，Skill 为可选增强。

---

## 文档交付物

安装对接完成后，可提供：

1. **README 安装说明**：复制即用的安装命令与前提条件
2. **install.sh / install.ps1**：Linux/macOS 与 Windows 安装脚本
3. **配置说明**：`.env` 示例、Gateway 与 Token 获取方式
4. **故障排查**：Gateway 未启动、Token 无效等常见问题

---

## 总结建议

| 阶段 | 动作 |
|------|------|
| 短期 | 实现方案 B：`install.sh` + `install.ps1`，从 GitHub 安装并自动生成配置 |
| 中期 | 发布 `create-pixelclaw-office` npm 包，支持 `npx` 安装 |
| 长期 | 视需要评估 Skill 包装，接入 `openclaw install` / ClawHub |

整体以「独立安装脚本 + 自动配置」为核心，保证从 GitHub 安装后即可与 OpenClaw 对接，再根据需要扩展 Skill 支持。
