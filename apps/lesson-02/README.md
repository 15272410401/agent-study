# Lesson 02：Nuxt + Coze 资讯对话 Agent

阶段 2 目标：在浏览器里做一个**可流式对话的资讯助手** —— 前端用 Nuxt UI 展示，后端把 **Coze Studio / 扣子 OpenAPI** 的 SSE 转成 **Vercel AI SDK** 协议，密钥只留在服务端。

相对 Lesson 01（命令行 + 自建工具循环），本课重点是：

- Web 对话 UI + 流式打字效果
- 对接现成 Agent 平台（Coze），而不是自己写 Tool Loop
- 协议转换：Coze SSE → AI SDK UI Message Stream → `useChat`

---

## 你会学到什么

| 知识点 | 说明 |
|--------|------|
| Nuxt 4 + Nuxt UI | 全屏对话页、主题色、深浅色模式 |
| `@ai-sdk/vue` `useChat` | 浏览器侧对话状态、发送、停止、流式更新 |
| `DefaultChatTransport` | 默认 POST `/api/chat`，消费 UI Message Stream |
| Nuxt `server/api` | 服务端代理 Coze，Token 不下发到前端 |
| Coze OpenAPI `/v3/chat` | 流式对话；兼容本地 Studio 与云端 |
| 自写 SSE 解析 | 规避官方 SDK 对 Studio 结束帧 `JSON.parse` 失败 |
| `@comark/nuxt` | 助手回复 Markdown 流式渲染（加粗/列表/链接） |

---

## 架构一览

```text
浏览器 app.vue
  useChat → POST /api/chat（UIMessage[]）
                │
                ▼
        server/api/chat.post.ts
          · 取最后一条用户文本
          · fetch(COZE_BASE_URL/v3/chat)  SSE
          · readCozeSse 容错解析
          · createUIMessageStreamResponse
                │
                ▼
        浏览器流式更新 messages → Markdown 渲染
```

---

## 目录结构

```text
apps/lesson-02/
├── .env.example              # Coze 配置模板
├── .env                      # 本地密钥（勿提交）
├── nuxt.config.ts            # 模块、runtimeConfig、routeRules
├── package.json
├── README.md
├── app/
│   ├── app.vue               # 对话 UI（useChat + Markdown）
│   ├── app.config.ts         # Nuxt UI 主题色
│   └── assets/css/main.css   # Tailwind + Nuxt UI 入口
└── server/
    └── api/
        └── chat.post.ts      # Coze 代理 + SSE → AI SDK 协议
```

---

## 快速开始

### 1. 环境要求

- Node.js >= 22
- 已在仓库根目录执行过 `pnpm install`
- 本地 **Coze Studio** 已启动，或使用官方云端 API
- Bot 已发布为可调用的 API 服务，并准备好 PAT Token

### 2. 配置环境变量

```bash
cp apps/lesson-02/.env.example apps/lesson-02/.env
```

编辑 `.env`：

```env
COZE_API_TOKEN=你的_PAT_Token
COZE_BOT_ID=你的_Bot_ID
# 本地 Studio（不要加 /v3）
COZE_BASE_URL=http://localhost:8888
# 官方云端国内可改为：https://api.coze.cn
```

也可用 Nuxt 覆盖写法：`NUXT_COZE_API_TOKEN` / `NUXT_COZE_BOT_ID` / `NUXT_COZE_BASE_URL`。

### 3. 启动

在仓库根目录：

```bash
pnpm --filter lesson-02 dev
```

或在 `apps/lesson-02` 下：

```bash
pnpm dev
```

浏览器打开 `http://localhost:3000`。

---

## 核心代码导读

### `app/app.vue`

- `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`
- 用户消息：纯文本气泡
- 助手消息：`<Markdown :streaming="..." />` 渲染
- 空状态快捷提问、Enter 发送 / 停止生成、自动滚底

### `server/api/chat.post.ts`

1. 从 `messages` 取出最后一条用户文本（支持 `parts`）
2. `fetch(`${baseURL}/v3/chat`)`，`stream: true`
3. `readCozeSse`：容忍空 data、`[DONE]`、`conversation.stream.done`
4. 将 `conversation.message.delta`（及必要时的 `completed` answer）写成  
   `text-start` → `text-delta` → `text-end`
5. `createUIMessageStreamResponse` 返回给前端

### `nuxt.config.ts`

- 模块：`@nuxt/ui`、`@comark/nuxt`
- `ui.prose: true` 配合 Markdown 排版
- `runtimeConfig` 注入 Coze 配置
- `'/'` 使用 `ssr: false`（对话依赖服务端 API）

---

## 常见问题

**Q: 终端报 `Could not parse message into JSON`？**  
旧版走 `@coze/api` stream 时，Studio 结束帧会踩坑。当前实现已改为自写 SSE 解析；请确认代码已更新并重启 dev。

**Q: 有 Coze event 但前端无正文？**  
检查 Bot 是否发布为 API；阶段 2 只转发 `type=answer`。若只有 `function_call` 等中间事件，需要在 Studio 侧把工作流/回复配完整。

**Q: 首次打开页面 `/_nuxt/assets/css/main.css` 很慢？**  
开发态冷编译：Tailwind v4 + Nuxt UI 首次扫类生成 CSS，属正常现象；编完后通常只要几毫秒。

**Q: Token 会不会暴露到浏览器？**  
不会。Token 只在 `server/api` + `runtimeConfig`（服务端）使用，前端只请求同源 `/api/chat`。

---

## 与 Lesson 01 的对比

| | Lesson 01 | Lesson 02 |
|--|-----------|-----------|
| 形态 | CLI | Web（Nuxt） |
| 模型/Agent | 自接 OpenAI 兼容 API + 自建 tools | 复用 Coze 平台 Bot |
| 流式 | 终端 `onChunk` | `useChat` + UI Message Stream |
| 密钥 | `.env` 本地 CLI | 仅服务端 runtimeConfig |

---

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发服务器（默认 :3000） |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `nuxt typecheck` |

---

## 小结

Lesson 02 完成了一条完整的「前端对话 → 服务端代理 → Coze 流式 Agent → Markdown 展示」链路。  
