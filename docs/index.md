---
layout: home

hero:
  name: Agent 应用开发学习笔记
  tagline: 记录 Agent 应用开发的学习过程
  actions:
    - theme: brand
      text: 开始阅读
      link: /notes/01.Agent 认知
    - theme: alt
      text: GitHub 仓库
      link: https://github.com/15272410401/agent-study.git

features:
  - icon: 📦
    title: 笔记管理
    details: 使用 VitePress 驱动，Markdown 编写，GitHub Actions 自动构建部署，实现笔记站点的自动更新。
    link: /notes/00.代码仓库总纲
    linkText: 查看笔记
  - icon: ⚡
    title: 基础认知
    details: 对 Agent 基础知识的认知，包括 Agent 的定义、特点、应用场景等。
    link: /notes/01.Agent 认知
    linkText: 查看笔记
  - icon: 🤖
    title: 开发实践
    details: 从基础知识到应用开发，逐步实践 Agent 开发，包括 Agent 的创建、训练、部署等。
    link: /notes/05.实践案例 - 联网研究员
    linkText: 查看笔记
---

### 📌 关于此静态资源站点

这里记录学习 Agent 开发的完整轨迹：每个阶段的代码放在 `apps/`，对应的笔记放在 `docs/notes/`。  
代码和文档在同一仓库，避免 “代码更新了笔记忘了改” 的常见问题。