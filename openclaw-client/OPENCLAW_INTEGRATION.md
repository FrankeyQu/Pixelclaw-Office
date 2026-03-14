# Pixelclaw Office 对接 OpenClaw 完整方案

## 〇、快速开始（设置与架构调整清单）

### 环境准备
1. **安装 OpenClaw**：`npm i -g openclaw`（需 Node.js ≥22）
2. **启动 Gateway**：`openclaw gateway`（默认 http://127.0.0.1:18789）
3. **获取 Token**：从 OpenClaw 控制台或 `~/.openclaw/` 配置中获取 Bearer Token

### 架构调整（最小改动）
| 项目 | 操作 | 说明 |
|------|------|------|
| 新增 | `api-proxy.js` | Node 代理，转发请求并注入 Token |
| 新增 | `api/openclaw-client.js` | 封装对 `/api/openclaw/*` 的调用 |
| 修改 | `pixel-office.js` | 使用 `OpenClawDataProvider` 替换 MockDataProvider |
| 新增 | `.env` / `.env.example` | `OPENCLAW_GATEWAY_URL`、`OPENCLAW_TOKEN` |
| 启动 | 用 Node 代理替代 server.ps1 | 同时提供静态资源 + API 代理 |

### 启动方式
```bash
# 1. 确保 OpenClaw Gateway 已启动
openclaw gateway

# 2. 配置 .env
cp .env.example .env
# 编辑 .env 填入 OPENCLAW_GATEWAY_URL 和 OPENCLAW_TOKEN

# 3. 启动开发服务（Node 代理 + 静态资源）
node api-proxy.js
# 访问 http://localhost:8088
```

---

## 一、架构概览

### 1.1 现状
- **Pixelclaw Office**：纯前端（HTML5 Canvas + 原生 JS），无后端
- **OpenClaw Gateway**：本地服务，默认 `http://127.0.0.1:18789`，提供 Tools Invoke、Chat Completions、WebSocket 等

### 1.2 对接架构（推荐）

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Pixelclaw Office   │     │   API 代理层          │     │  OpenClaw Gateway   │
│  (浏览器)            │────▶│  (同域 /api/proxy)   │────▶│  localhost:18789    │
│                     │     │  - 转发请求           │     │  - /tools/invoke    │
│  - 数据面板          │     │  - 注入 Token        │     │  - /v1/chat/...     │
│  - Agent 列表       │     │  - 避免 CORS         │     │  - WebSocket        │
│  - 任务看板          │     │  - Token 不暴露      │     └─────────────────────┘
└─────────────────────┘     └──────────────────────┘
```

**核心原则**：API Key / Bearer Token 只在代理层使用，前端不接触敏感信息。

---

## 二、OpenClaw API 能力速查

| 能力 | 接口 / 方式 | 说明 |
|------|-------------|------|
| 工具调用 | `POST /tools/invoke` | 调用 sessions_list、gateway 等内置工具 |
| 会话列表 | 工具 `sessions_list` | 获取会话元数据（sessionId, channel, kind, model, token 等） |
| 用量/成本 | CLI `/usage tokens`、`/usage cost` | 无直接 HTTP 端点，需通过工具或解析会话日志 |
| Chat | `POST /v1/chat/completions` | OpenAI 兼容格式 |
| 实时 | WebSocket | 控制、流式响应 |

### 2.1 Tools Invoke 示例

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": { "limit": 50, "activeMinutes": 60 }
  }'
```

### 2.2 sessions_list 返回结构（参考）

```json
{
  "rows": [
    {
      "sessionId": "xxx",
      "channel": "slack",
      "kind": "main",
      "model": "claude-sonnet",
      "updatedAt": "...",
      "inputTokens": 1234,
      "outputTokens": 567
    }
  ]
}
```

---

## 三、分阶段实施计划

### 阶段 1：API 代理层（必选）

**目标**：前端通过同域代理访问 OpenClaw Gateway，Token 不出前端。

**实现方式（二选一）**：

| 方案 | 适用 | 说明 |
|------|------|------|
| A. Node 代理 | 推荐 | 新增 `api-proxy.js`，与 server.ps1 并行或替代 |
| B. 扩展 server.ps1 | 简单 | 在 PowerShell 中增加 `/api/openclaw/*` 转发 |

**方案 A 示例结构**：

```
openclaw-client/
├── api-proxy.js          # 代理服务（Node + http-proxy 或 fetch 转发）
├── api-proxy-config.js   # 读取 OPENCLAW_GATEWAY_URL、OPENCLAW_TOKEN
├── server.ps1            # 静态资源（可选：代理也由 Node 统一提供）
└── .env.example          # OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
                          # OPENCLAW_TOKEN=your_bearer_token
```

**代理路由**：
- `GET/POST /api/openclaw/tools/invoke` → `{GATEWAY}/tools/invoke`
- `POST /api/openclaw/v1/chat/completions` → `{GATEWAY}/v1/chat/completions`
- `GET /api/openclaw/usage` → 自定义聚合接口（见阶段 2）

---

### 阶段 2：数据面板（用量 / 成本）

**目标**：数据 Tab 展示真实 Token 用量和估算成本。

**数据来源策略**：

| 来源 | 实现 | 优先级 |
|------|------|--------|
| sessions_list 聚合 | 调用 `sessions_list`，汇总 rows 中的 token 字段 | P0 |
| 会话日志解析 | 若 Gateway 提供日志路径，可解析 `~/.openclaw/...` | P1（需代理能读本地文件） |
| 自定义 /usage 端点 | 代理层实现 `GET /api/openclaw/usage`，内部调 tools + 聚合 | P0 |

**OpenClawDataProvider 接口**（扩展现有 DataProvider）：

```javascript
// 需支持的字段
{
  tokenUsage: '12.4K',      // 聚合 inputTokens + outputTokens
  cost: '¥0.02',            // 按模型单价估算（需配置或从 OpenClaw 获取）
  isLive: true,
  // 可选扩展
  sessionCount: 5,
  lastUpdated: '2025-03-14 10:30'
}
```

**成本估算**：若无官方 API，可在代理层维护简单模型单价表，按 token 量估算。

---

### 阶段 3：Agent 同步

**目标**：将 OpenClaw 的 Agent/会话映射到画布上的可视化 Agent。

**映射关系**：

| OpenClaw | Pixelclaw Office |
|----------|------------------|
| Agent（如 Slack Bot） | 画布上的 Agent 角色 |
| Session (channel, kind) | Agent 的「正在处理的会话」 |
| 会话 model、status | Agent 的 status（working / idle / waiting / error） |

**实现步骤**：
1. 调用 `sessions_list` 或类似接口，获取 agent/session 列表
2. 建立 `openclawAgentId` ↔ `pixelOfficeAgent.id` 的映射（可存 localStorage）
3. 根据 session 活跃度、状态推演 Agent 的 status
4. 支持「从 OpenClaw 导入 Agent」：自动在画布上创建对应 Agent 并定位到工位

**数据流**：
```
sessions_list / agents_list → 代理层 /api/openclaw/agents
→ OpenClawAgentProvider.fetchAgents()
→ 合并/更新 pixelOffice.agents
→ 刷新 Agent 列表与画布
```

---

### 阶段 4：任务与工作流（可选）

**目标**：若 OpenClaw 有任务/工作流 API，与本地任务看板双向同步。

**现状**：OpenClaw 文档中未见标准「任务 API」，多为 CLI 与内部工作流。

**建议**：
- 短期：保持任务看板为本地数据（localStorage），可增加「关联 OpenClaw Session」字段
- 中期：若 OpenClaw 提供 workflow/task 接口，再设计同步规则与冲突处理

---

### 阶段 5：实时更新（可选）

**目标**：会话、用量、Agent 状态实时刷新。

**实现**：
- 前端轮询：如每 10–30 秒调用 `/api/openclaw/usage`、`/api/openclaw/agents`
- WebSocket：若 Gateway 暴露 WS，代理层可做 WS 透传，前端订阅事件
- SSE：代理层封装 `GET /api/openclaw/events`，服务端定时推送

---

## 四、目录与文件规划

### 4.1 调整后的目录结构

```
openclaw-client/
├── OPENCLAW_INTEGRATION.md    # 本文档
├── .env.example               # 配置模板（不提交 .env）
├── .env                       # 实际配置（gitignore，勿提交）
├── api-proxy.js               # 代理服务：静态资源 + API 转发
├── api/
│   └── openclaw-client.js     # 封装 fetch('/api/openclaw/xxx')
├── pixel-office.js            # 使用 OpenClawDataProvider
├── index.html
├── server.ps1                 # 保留：纯静态时可单独用
└── ...
```

### 4.2 各文件职责

| 文件 | 职责 |
|------|------|
| `api-proxy.js` | 监听 8088，静态文件走本地，`/api/openclaw/*` 转发到 Gateway |
| `api/openclaw-client.js` | `fetchUsage()`, `fetchSessions()` 等，统一走 `/api/openclaw/...` |
| `pixel-office.js` | `this.dataProvider = new OpenClawDataProvider('/api/openclaw')` |
| `.env` | `OPENCLAW_GATEWAY_URL`, `OPENCLAW_TOKEN` |

### 4.3 是否需要新建分支

- **建议**：在 `feature/openclaw-integration` 分支开发，完成后再合并 `main`
- **命令**：`git checkout -b feature/openclaw-integration`

---

## 五、安全与配置

### 5.1 环境变量（.env，不提交）

```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=your_bearer_token
```

### 5.2 代理层检查清单

- [ ] Token 仅从环境变量读取
- [ ] 代理仅监听 localhost
- [ ] 限制可转发的路径（如只允许 /tools/invoke、/v1/chat/completions、自定义 /usage）
- [ ] 敏感信息不写入前端可读的日志

### 5.3 前端检查清单

- [ ] 不出现 OPENCLAW_TOKEN、API Key
- [ ] 所有 OpenClaw 请求走 /api/openclaw/* 代理
- [ ] 失败时提示「请检查 OpenClaw Gateway 是否启动、代理配置是否正确」

---

## 六、实施优先级建议

| 阶段 | 内容 | 预估工期 | 依赖 |
|------|------|----------|------|
| 1 | API 代理层 | 0.5–1 天 | 无 |
| 2 | 数据面板真实用量/成本 | 0.5–1 天 | 阶段 1 |
| 3 | Agent 同步 | 1–2 天 | 阶段 1 |
| 4 | 任务/工作流同步 | 待定 | 需 OpenClaw 任务 API |
| 5 | 实时更新 | 0.5 天 | 阶段 1–3 |

---

## 七、验证步骤

1. **代理连通**：`curl http://localhost:8088/api/openclaw/tools/invoke`（带 Token）能正确转发并返回
2. **数据面板**：切换到「数据」Tab，能看到非 `--` 的用量与成本
3. **Agent 同步**：能导入 OpenClaw Agent，画布上出现对应角色且状态正确

---

## 八、参考资料

- [OpenClaw HTTP API](https://openclawlab.com/en/docs/reference/http-api/)
- [Tools Invoke API](https://openclawlab.com/en/docs/gateway/tools-invoke-http-api/)
- [API Usage and Costs](https://openclawlab.com/en/docs/reference/api-usage-costs/)
- [Gateway Configuration](https://openclaw.cc/en/gateway/configuration)

---

## 九、实施步骤（按顺序执行）

### Step 1：环境与 OpenClaw

```bash
# 安装 OpenClaw（需 Node ≥22）
npm i -g openclaw

# 配置（首次运行会引导）
openclaw configure

# 启动 Gateway（另开终端保持运行）
openclaw gateway
# 默认 http://127.0.0.1:18789
```

### Step 2：获取 Token

- 打开 http://127.0.0.1:18789 控制台
- 或查看 `~/.openclaw/` 下配置文件中的 token / apiKey

### Step 3：创建 .env.example 与 .env

```bash
# .env.example（提交到 git）
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=

# .env（不提交，本地填写）
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=你的实际token
```

### Step 4：新增 api-proxy.js

- 使用 Node `http` + `http-proxy` 或 `fetch` 转发
- 静态：`/`、`/*.html`、`/*.js` 等 → 本地 `openclaw-client/` 目录
- API：`/api/openclaw/*` → `{GATEWAY}/*`，请求头加 `Authorization: Bearer ${TOKEN}`

### Step 5：新增 api/openclaw-client.js

```javascript
// 示例
async function fetchUsage() {
  const res = await fetch('/api/openclaw/usage');
  return res.json();
}
```

### Step 6：代理层实现 /api/openclaw/usage

- 内部调用 Gateway `POST /tools/invoke`，tool=`sessions_list`
- 聚合 rows 的 token 字段，返回 `{ tokenUsage, cost, isLive: true }`

### Step 7：修改 pixel-office.js

```javascript
// 将 MockDataProvider 替换为
this.dataProvider = new OpenClawDataProvider('/api/openclaw');
```

### Step 8：验证

1. `node api-proxy.js` 启动
2. 打开 http://localhost:8088
3. 切换到「数据」Tab，应显示真实用量
