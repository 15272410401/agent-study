# Lesson 01：最基本的 Tool-Calling Agent

本节课目标：用 **OpenAI 兼容 SDK**（可接 DeepSeek）实现一个最小可用的 Agent：

- 多轮对话记忆
- Function Calling（工具调用）
- 流式输出（终端打字机效果）

---

## 你会学到什么

| 知识点 | 说明 |
|--------|------|
| OpenAI 兼容调用 | 通过 `baseURL` 切换 DeepSeek 等供应商 |
| System / User / Assistant / Tool 消息 | 构建 Agent 对话上下文 |
| Function Calling | 模型只决策，本地真正执行工具 |
| Agent 循环 | 调工具 → 写回结果 → 再问模型，直到给出最终回答 |
| Streaming | `stream: true` 下拼接 `content` 与 `tool_calls` 增量 |

---

## 目录结构

```text
apps/lesson-01/
├── .env.example          # 环境变量模板
├── .env                  # 本地密钥（勿提交）
├── package.json
├── README.md
└── src/
    ├── index.ts          # CLI 入口，流式打印
    ├── agent.ts          # Agent：对话 + 工具循环 + 流式
    └── tools.ts          # 工具 schema 与实现
```

---

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
OPENAI_API_KEY=你的_DeepSeek_API_Key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

> DeepSeek 兼容 OpenAI Chat Completions，因此直接使用官方 `openai` npm 包即可。

### 2. 安装依赖（在 monorepo 根目录）

```bash
pnpm install
```

### 3. 启动

```bash
cd apps/lesson-01
pnpm dev
```

输入问题开始对话，输入 `exit` 退出。

---

## 内置工具

| 工具名 | 作用 | 数据来源 |
|--------|------|----------|
| `get_current_datetime` | 当前北京时间 | 本地系统时间 |
| `safe_calculate` | 安全四则运算 `+ - * / ()` | 本地白名单求值 |
| `get_realtime_info` | 关键词公开信息摘要 | DuckDuckGo Instant Answer |
| `get_current_weather` | 城市当前天气 | Open-Meteo（免费，无需 Key） |

可试：

- 「现在几点了」
- 「算一下 (12 + 8) * 3」
- 「DeepSeek 是什么」
- 「北京现在天气怎么样」

调用工具时终端会打印：`[tool] 工具名({...})`。

---

## 核心流程（必读）

```text
用户提问
   │
   ▼
messages += user
   │
   ▼
┌─────────────────────────────────────┐
│  请求模型（messages + tools, stream） │
└─────────────────────────────────────┘
   │
   ├─ 流式返回 content ──► onChunk 打印 ──► 结束
   │
   └─ 流式返回 tool_calls
         │
         ▼
      本地 executeTool
         │
         ▼
      messages += assistant(tool_calls)
      messages += tool(result)
         │
         └──── 再次请求模型（最多 5 轮）
```

要点：

1. **模型不会执行代码**，只返回“要调哪个工具、参数是什么”。
2. **工具结果必须写回 messages**，模型才能基于真实数据回答。
3. **流式模式下** `tool_calls` 是碎片，必须按 `index` 拼接完整后再执行。

---

## 代码导读

### `agent.ts`

- 维护 `messages` 对话历史
- `chat()` 内实现工具调用循环
- `stream: true` + `onChunk` 实现流式输出

### `tools.ts`

- `tools`：给模型看的 JSON Schema
- `executeTool(name, argsJson)`：按名称分发到具体实现

### `index.ts`

- 命令行读写
- 把 `onChunk` 接到 `process.stdout.write`

---

## 常见问题

**Q: 报错提示未填写 API Key？**  
检查 `.env` 是否存在，且 `OPENAI_API_KEY` 不是示例占位符。

**Q: 天气 / 联网工具失败？**  
需要本机能访问外网；公司网络或代理可能导致 `fetch` 失败。

**Q: 模型不调工具？**  
确认 `tools` 已传入请求；system prompt 中写明可用工具；换问更明确的需求（例如“用工具查一下北京天气”）。

---

