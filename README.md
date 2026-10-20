## Agent 应用开发学习笔记

前端视角的 **AI Agent 零基础入门到实战** 学习仓库：代码实践（`apps/`）与学习笔记（`docs/`）同仓维护，用 pnpm monorepo 组织。

> 核心理念：LLM 负责理解与决策，Agent Loop 负责「调工具 → 观察结果 → 再决策」直到任务完成。

---

## 项目总纲

| 模块 | 路径 | 职责 |
|------|------|------|
| 课程实践 | `apps/*` | 每阶段产生的代码 |
| 公共包 | `packages/*` | 跨阶段复用的类型与核心逻辑（骨架，随阶段扩展） |
| 学习站点 | `docs/` | VitePress 笔记站，GitHub Pages 自动部署 |
| CI | `.github/workflows/` | 文档构建与 Pages 发布 |

**技术基线**

- Node.js `>= 22`，包管理器 **pnpm** workspace
- TypeScript（`tsconfig.base.json` 统一基础配置）
- LLM 调用优先走 **OpenAI 兼容协议**（可接 DeepSeek 等）

---

## 仓库结构

```text
agent-study/
├── apps/                          # 阶段代码
│   └── lesson-01/                 # 阶段 1 ：OpenAI 兼容 SDK + Function Calling + 流式输出的最小 Agent
│       ...
│       ...
│
├── packages/                      # 共享包（预留，后续逐步填充）
│   │    ...
│   │    ...
│   │
├── docs/                          # VitePress 学习笔记站
│   ├── .vitepress/                # 站点配置与主题
│   ├── notes/                     # Markdown 笔记
│   │   └── 01.Agent 认知.md
│   │    ...
│   │
│   └── index.md                   # 站点首页
├── .github/workflows/
│   └── deploy-docs.yml            # push 文档 → GitHub Pages
├── package.json                   # 根脚本入口
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md                      # 本文件
```

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 11（根 `package.json` 的 `devEngines` 会按需引导）

### 安装

在仓库根目录：

```bash
pnpm install
```

### 跑阶段 1 Agent

```bash
# 1. 配置密钥
cp apps/lesson-01/.env.example apps/lesson-01/.env
# 编辑 .env，填入 OPENAI_API_KEY（可用 DeepSeek）

# 2. 启动 CLI
pnpm lesson-01
# 等价于：pnpm --filter lesson-01 dev
```

### 本地预览学习笔记站

```bash
pnpm docs:dev
```

构建与预览：

```bash
pnpm docs:build
pnpm docs:preview
```

文档站推送到 `main` 且变更落在 `docs/**` 等相关路径时，会由 GitHub Actions 自动部署到 GitHub Pages。

---

## 根目录常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm lesson-01` | 启动阶段 1 命令行 Agent |
| `pnpm lesson-XX` |  |
| `pnpm docs:dev` | 本地启动 VitePress |
| `pnpm docs:build` | 构建静态文档站 |
| `pnpm docs:preview` | 预览构建产物 |

---

## Workspace 说明

`pnpm-workspace.yaml` 包含：

- `apps/*` — 各课独立应用
- `packages/*` — 共享库
- `docs` — 文档站（独立 package：`docs`）

约定：

- **一课一目录**：新课在 `apps/lesson-XX` 增加可运行项目，并写自己的 `README.md`
- **一文一结**：重要认知与总结同步到 `docs/notes/`，避免代码与笔记脱节
- **密钥不上库**：`.env` 已在 `.gitignore`；只提交 `.env.example`

---

## 相关链接

- GitHub：https://github.com/15272410401/agent-study.git
- 学习笔记站：https://15272410401.github.io/agent-study/

