# Pixelclaw Office — 安装与 OpenClaw 对接指南

> **本文档面向 AI 助手（如 OpenClaw）**：请按步骤顺序执行。每条指令都是可执行的。执行前若本地尚未有项目，请先执行「零、获取项目」。

---

## 零、获取项目

**GitHub 仓库地址**：`https://github.com/FrankeyQu/Pixelclaw-Office`

若本地尚无本项目代码，请先执行以下命令拉取：

**步骤 0.1**：克隆仓库
```
git clone https://github.com/FrankeyQu/Pixelclaw-Office.git
```

**步骤 0.2**：进入项目根目录
```
cd Pixelclaw-Office
```

**步骤 0.3**：确认目录结构  
项目根目录下应包含 `openclaw-client` 文件夹及本文件 `INSTALL_FOR_OPENCLAW.md`。确认后，从「一、项目概述」起按后续章节执行。

**步骤 0.4（可选）**：若需安装**对接模块分支** `feature/openclaw-integration`（含 OpenClaw 安装与对接文档），二选一：
- 方式 A：克隆后切换：`git checkout feature/openclaw-integration`
- 方式 B：直接克隆该分支：`git clone -b feature/openclaw-integration https://github.com/FrankeyQu/Pixelclaw-Office.git`
未执行此步骤时，默认使用 `main` 分支。

---

## 一、项目概述

**项目名称**：Pixelclaw Office  
**项目类型**：纯前端可视化应用（HTML5 Canvas + 原生 JavaScript）  
**主要入口**：`openclaw-client/index.html`  
**运行方式**：通过 HTTP 服务提供静态文件，浏览器访问

**核心目录结构**：
```
<项目根>/
├── openclaw-client/          # 前端应用目录
│   ├── index.html            # 主页面入口
│   ├── editor.html           # 地图编辑器
│   ├── pixel-office.js       # 核心逻辑
│   ├── license.js            # 许可证模块
│   ├── server.ps1            # 静态服务（Windows PowerShell）
│   ├── presets/              # 预设 JSON
│   └── assets/               # 静态资源
├── INSTALL_FOR_OPENCLAW.md   # 本文档
└── README.md
```

---

## 二、运行模式说明

本项目支持两种运行模式：

| 模式 | 说明 | 前置条件 |
|------|------|----------|
| **A. 独立运行** | 仅展示办公室场景，数据面板为示例数据 | 无需 OpenClaw，只需 HTTP 服务 |
| **B. 对接 OpenClaw** | 数据面板显示真实 Token 用量与成本，可扩展 Agent 同步 | 需 OpenClaw Gateway 运行，且需实现 API 代理层 |

请根据用户需求选择模式。若用户要求「与 OpenClaw 对接」，执行模式 B；否则执行模式 A。

---

## 三、模式 A — 独立运行（立即可用）

### 3.1 前置检查

执行以下命令确认环境：

- **检查 Node.js**（可选，仅模式 B 需要）：
  ```
  node --version
  ```
  若输出类似 `v22.x.x` 或更高，则满足。

- **检查 PowerShell**（Windows）：
  ```
  powershell -Command "Write-Host 'OK'"
  ```

### 3.2 启动服务

**步骤 1**：进入前端目录
```
cd openclaw-client
```

**步骤 2**：启动 HTTP 服务

- **Windows（PowerShell）**：
  ```
  .\server.ps1
  ```
  或指定端口：
  ```
  .\server.ps1 -Port 8089
  ```

- **Linux / macOS**：若无可用的 `server.ps1`，使用 Python 或 Node 启动静态服务：
  ```
  # Python 3
  python -m http.server 8088 --directory .
  
  # 或 Node（需安装 http-server）
  npx http-server -p 8088 -c-1
  ```

**步骤 3**：验证

- 终端应输出类似：`Access address: http://localhost:8088`
- 浏览器访问 `http://localhost:8088`
- 应看到像素办公室场景、Agent 列表、任务与数据面板

### 3.3 预期结果

- 主页面加载成功
- 数据 Tab 显示示例数据（Token 用量、成本为占位值）
- 无报错

---

## 四、模式 B — 对接 OpenClaw（需实现代理层）

### 4.1 前置条件（必须满足）

在执行对接前，请逐项确认：

1. **OpenClaw Gateway 已安装并运行**
   - 安装：`npm install -g openclaw`
   - 启动：`openclaw gateway`
   - 默认地址：`http://127.0.0.1:18789`

2. **Gateway 可达性测试**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789
   ```
   - 若返回 `200` 或 `401` 表示 Gateway 已运行
   - 若连接失败，请先启动 `openclaw gateway`

3. **获取 Bearer Token**
   - 方式 1：访问 `http://127.0.0.1:18789` 控制台，从界面获取
   - 方式 2：查看 OpenClaw 配置目录，常见路径：
     - Linux/macOS：`~/.openclaw/` 下的 config 相关文件
     - Windows：`%USERPROFILE%\.openclaw\`
   - Token 用于请求头：`Authorization: Bearer <TOKEN>`

4. **Node.js 已安装（≥22）**
   - 对接需运行 Node 代理服务

### 4.2 需要创建/修改的文件

模式 B 需要新增以下文件，并修改一处现有文件。请按顺序执行。

---

### 4.2.1 创建 `.env.example`

**路径**：`openclaw-client/.env.example`

**内容**（逐行复制，勿修改变量名）：
```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=
```

**说明**：用户需将 `OPENCLAW_TOKEN=` 后填入实际 Token。实际使用的配置文件为 `.env`（见下一步）。

---

### 4.2.2 创建 `.env`

**路径**：`openclaw-client/.env`

**内容**：
```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=<在此填入实际的 Bearer Token>
```

**操作指引**：
- 若能从 `~/.openclaw/` 或环境变量 `OPENCLAW_TOKEN` 读取到 Token，请自动填入
- 若无法获取，则复制 `.env.example` 为 `.env`，并在文档或输出中提示用户填写 `OPENCLAW_TOKEN`
- `.env` 已在 `.gitignore` 中，请勿提交到版本库

---

### 4.2.3 创建 `api-proxy.js`

**路径**：`openclaw-client/api-proxy.js`

**用途**：提供静态文件服务，并将 `/api/openclaw/*` 转发到 OpenClaw Gateway，在请求头中注入 Token。

**完整代码**（请原样创建，注意替换 `loadEnv` 的实现以匹配实际 env 加载方式）：
```javascript
/**
 * Pixelclaw Office API 代理 — 静态资源 + OpenClaw Gateway 转发
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || '8088', 10);
const ROOT = path.join(__dirname);

// 加载 .env（简单实现）
function loadEnv() {
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const m = line.match(/^([^#=]+)=(.*)$/);
            if (m) process.env[m[1].trim()] = m[2].trim();
        });
    }
}
loadEnv();

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
const TOKEN = process.env.OPENCLAW_TOKEN || '';

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // API 代理：/api/openclaw/* -> Gateway
    if (pathname.startsWith('/api/openclaw/')) {
        const gatewayPath = pathname.replace('/api/openclaw', '') || '/';
        const target = GATEWAY.replace(/\/$/, '') + gatewayPath + (parsed.search || '');
        const headers = { ...req.headers, host: url.parse(GATEWAY).host };
        if (TOKEN) headers['authorization'] = 'Bearer ' + TOKEN;

        const opt = { method: req.method, headers };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            const body = await getBody(req);
            if (body) opt.body = body;
        }

        try {
            const resp = await fetch(target, opt);
            res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
            const buf = Buffer.from(await resp.arrayBuffer());
            res.end(buf);
        } catch (e) {
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'Gateway proxy error', message: e.message }));
        }
        return;
    }

    // 静态文件
    const subPath = (pathname === '/' || pathname === '') ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.resolve(ROOT, subPath);
    if (!filePath.startsWith(path.resolve(ROOT))) {
        res.writeHead(403);
        res.end();
        return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())
        filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('404');
        return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(fs.readFileSync(filePath));
});

function getBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

server.listen(PORT, () => {
    console.log('Pixelclaw Office server: http://localhost:' + PORT);
});
```

**说明**：Node 18+ 内置 `fetch`。若使用旧版 Node，请将 `fetch` 替换为 `http.request` 或引入 `node-fetch`。

---

### 4.2.4 实现代理层的 `/api/openclaw/usage` 端点

在 `api-proxy.js` 的 API 代理逻辑中，增加对 `/usage` 的特殊处理。当请求路径为 `/api/openclaw/usage` 时，不直接转发，而是：

1. 向 Gateway 发送 `POST /tools/invoke`，body 为：
   ```json
   {
     "tool": "sessions_list",
     "action": "json",
     "args": { "limit": 100, "activeMinutes": 10080 }
   }
   ```
2. 解析返回的 `rows`，汇总每个 row 的 `inputTokens` 与 `outputTokens`（或等效字段）
3. 返回 JSON：
   ```json
   {
     "tokenUsage": "12.4K",
     "cost": "¥0.02",
     "isLive": true
   }
   ```
   - `tokenUsage`：将总 token 格式化为如 `12.4K` 的字符串
   - `cost`：可按简单单价估算，或暂时写固定值
   - `isLive`：固定为 `true`

**实现位置**：在 `api-proxy.js` 中，在处理 `/api/openclaw/*` 时，若路径为 `/api/openclaw/usage` 且方法为 `GET`，则执行上述逻辑；否则按原样转发到 Gateway。

---

### 4.2.5 修改 `pixel-office.js` 使用 OpenClawDataProvider

**路径**：`openclaw-client/pixel-office.js`

**操作 1**：在 `MockDataProvider` 之后添加 `OpenClawDataProvider` 类：
```javascript
class OpenClawDataProvider {
    constructor(apiBase) {
        this.apiBase = apiBase || '/api/openclaw';
    }
    async fetchUsageData() {
        try {
            const res = await fetch(this.apiBase + '/usage');
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            return {
                tokenUsage: data.tokenUsage ?? '--',
                cost: data.cost ?? '--',
                isLive: !!data.isLive
            };
        } catch (e) {
            console.warn('OpenClawDataProvider error:', e);
            return { tokenUsage: '--', cost: '--', isLive: false };
        }
    }
}
```

**操作 2**：将 `this.dataProvider = new MockDataProvider();` 改为：
```javascript
this.dataProvider = new OpenClawDataProvider('/api/openclaw');
```

**位置**：在 PixelOffice 的 constructor 中，原 `this.dataProvider = new MockDataProvider();` 所在行。

---

### 4.3 启动模式 B

**步骤 1**：确认 `openclaw-client/.env` 已存在且 `OPENCLAW_TOKEN` 已填写

**步骤 2**：进入目录并启动代理
```
cd openclaw-client
node api-proxy.js
```

**步骤 3**：浏览器访问 `http://localhost:8088`，切换到「数据」Tab

### 4.4 模式 B 验证

- 数据 Tab 显示非 `--` 的 Token 用量与成本
- 底部提示「数据来自 OpenClaw」
- 若仍为 `--`，检查：Gateway 是否运行、Token 是否正确、`/api/openclaw/usage` 实现是否正常

---

## 五、故障排查

| 现象 | 可能原因 | 处理方式 |
|------|----------|----------|
| `server.ps1` 无法执行 | PowerShell 执行策略限制 | 运行：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| 8088 端口被占用 | 已有服务占用 | 使用 `-Port 8089` 或关闭占用进程 |
| 数据面板一直显示 `--` | Gateway 未启动或 Token 错误 | 启动 `openclaw gateway`，检查 `.env` 中的 Token |
| `node api-proxy.js` 报错 `fetch is not defined` | Node 版本 < 18 | 升级 Node 到 18+，或改用 `http.request` 实现代理 |
| 跨域错误 | 前端直接请求 Gateway | 确保通过 `api-proxy.js` 访问，所有 OpenClaw 请求走 `/api/openclaw/*` |

---

## 六、执行清单（供 AI 自检）

完成安装后，请逐项确认：

- [ ] 已从 GitHub 克隆项目（`git clone https://github.com/FrankeyQu/Pixelclaw-Office.git`）并进入项目根目录
- [ ] 已确定运行模式（A 独立 / B 对接 OpenClaw）
- [ ] 模式 A：`server.ps1` 或等价 HTTP 服务已启动，`http://localhost:8088` 可访问
- [ ] 模式 B：`openclaw gateway` 已运行，`.env` 已配置，`api-proxy.js` 已创建并实现 `/usage`，`pixel-office.js` 已接入 `OpenClawDataProvider`，`node api-proxy.js` 已启动
- [ ] 主页面加载正常，无控制台报错
- [ ] 数据 Tab 显示符合预期（模式 A 为示例数据，模式 B 为真实数据）

---

## 七、简要说明（供人类用户）

本文档供 AI 助手（如 OpenClaw）自动执行安装与对接。人类用户可直接阅读 README.md 获取简明指引。若需对接 OpenClaw，请确保已安装并启动 OpenClaw Gateway，并按照上述「模式 B」配置 Token 与代理服务。
