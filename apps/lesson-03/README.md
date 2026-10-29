# Lesson 03：LangGraph 异常告警分流 Agent

阶段 3 目标：用 **LangGraph.js** 编排一条「异常过滤 → 诊断 → 溯源 → 告警」流水线，让 **LLM 在运行时动态决定** 走哪条分支（而不是把 if/else 画死在画布上）。

相对前两课：

| | Lesson 01 | Lesson 02 | Lesson 03 |
|--|-----------|-----------|-----------|
| 形态 | CLI + 自建 Tool Loop | Web + Coze 平台 Bot | CLI + **LangGraph 状态机** |
| 决策 | 模型选工具 | 平台内编排 | **Conditional Edges + 共享 State** |
| 模型接入 | OpenAI SDK | Coze OpenAPI | **ChatOpenAI（可接 DeepSeek）** |

---

## 你会学到什么

| 知识点 | 说明 |
|--------|------|
| `ChatOpenAI` | OpenAI 兼容连接器：`model` / `temperature` / `apiKey` / `configuration.baseURL` |
| Zod + `withStructuredOutput` | 强制 LLM 输出 `{ isCodeBug: boolean }`，可工程化消费 |
| `Annotation` State | 节点间共享内存，reducer 定义字段如何合并 |
| `StateGraph` | `addNode` / `addEdge` / `addConditionalEdges` / `compile` |
| 条件路由 | Filter 后：真 Bug → diagnose；噪音 → END |
| Mock 降级 | 无 API Key 时仍可跑通整张图 |

---

## 场景：异常告警分流

线上告警 90% 是噪音（爬虫 403、网络抖动），10% 是真 Bug。人工筛选成本高。

本课图结构：

```text
START
  │
  ▼
filter ──(LLM 判断)──┬── 真 Bug ──► diagnose ──► trace ──► notify ──► END
                     │
                     └── 噪音 ──────────────────────────────► END
```

- **Filter**：ChatOpenAI + Zod 结构化输出，决定是否继续
- **Diagnose**：从 stack 解析文件路径
- **Trace**：查 Mock Git 日志，找到负责人
- **Notify**：打印告警（可扩展为 IM / 工单）

---

## 目录结构

```text
apps/lesson-03/
├── .env.example          # DeepSeek / OpenAI 兼容配置模板
├── .env                  # 本地密钥（勿提交）
├── package.json
├── README.md
├── mock/
│   └── data.ts           # Mock 异常 + Git 日志
└── src/
    ├── index.ts          # 入口：逐条 invoke 图
    ├── state.ts          # GraphState（共享状态）
    └── langGreph.ts      # ChatOpenAI + 节点 + StateGraph
```

> 文件名 `langGreph.ts` 为课程既有拼写，入口已按此引用。

---

## 快速开始

### 1. 配置环境变量

```bash
cp apps/lesson-03/.env.example apps/lesson-03/.env
```

```env
OPENAI_API_KEY=你的_DeepSeek_API_Key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

未配置有效 Key 时，会自动进入 **Mock 分流**（`type` 含 `TypeError` 视为真 Bug），图仍可跑通。

### 2. 安装与运行

在仓库根目录：

```bash
pnpm install
pnpm --filter lesson-03 dev
```

或在本目录：

```bash
pnpm dev
```

预期输出大致为：

1. `ex_101`（TypeError）→ Filter 判为 Bug → Diagnose → Trace → 告警 Li Si  
2. `ex_102`（WebScannerError）→ Filter 判为噪音 → 直接结束  

---

## ChatOpenAI 参数说明（本课完善点）

```ts
new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "deepseek-chat", // 调用哪个模型
  temperature: 0,                                      // 分流要稳定，取 0
  apiKey: process.env.OPENAI_API_KEY,                  // 鉴权
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,              // DeepSeek 等兼容端点
  },
  maxRetries: 2,                                       // 偶发失败重试
});
```

要点：

- DeepSeek 兼容 OpenAI Chat Completions，**换 `baseURL` + `model` 即可**
- `temperature: 0` 适合「是否 Bug」这类分类决策
- Filter 再包一层 `withStructuredOutput(schema, { method: "functionCalling" })`  
  （DeepSeek 部分模型对 `json_schema` response_format 支持不完整，用 function calling 更稳）

---

## 核心代码导读

### `src/state.ts`

定义 `exceptions` / `currentException` / `diagnosticReport` / `status`。  
条件边读的是 `currentException`：有值走诊断，无值结束。

### `src/langGreph.ts`

- 创建真实或 Mock 模型
- 四个节点函数：只返回「要更新的 State 片段」
- `workflow.compile()` 得到可 `invoke` 的 `app`

### `src/index.ts`

对 `MOCK_EXCEPTIONS` 逐条 `app.invoke({ exceptions: [ex] })`。

### `mock/data.ts`

两条对比样例 + 文件到 Git author 的映射。

---

## 常见问题

**Q: 报 API Key / 鉴权错误？**  
检查 `.env` 是否被 `dotenv/config` 加载（入口已 `import "dotenv/config"`），以及 `OPENAI_BASE_URL` 是否指向正确区域。

**Q: `deepseek-flash` 报 tool_choice / response_format 错误？**  
部分 thinking / flash 模型不支持 Function Calling。本课默认用 `deepseek-chat`；若仍失败，Filter 会回退到「纯文本 JSON + Zod 解析」。

**Q: Mock 和真实 LLM 结果不一致？**  
Mock 仅按字符串是否包含 `TypeError` 判断；真实模型会结合 message/stack，可能略有差异。

**Q: 如何扩展？**  
- Notify 改为企业微信 / Lark Webhook  
- Trace 改为真实 `git blame`  
- Filter schema 增加 `reason` 字段便于审计  
- 用循环边处理 `exceptions` 队列中的多条异常  

---

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 用 tsx 运行 `src/index.ts` |

---

## 小结

Lesson 03 演示了 LangGraph 的核心价值：**用 State + 条件边，把 LLM 决策嵌进可维护的状态机**。  
Filter 负责「想」；Diagnose / Trace / Notify 负责「做」—— 这正是 Agent 编排里「大脑与四肢」的分工。
