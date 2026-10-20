import { defineConfig } from 'vitepress';

// CI 里 GITHUB_REPOSITORY 形如 "your-name/agent-study"
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agent-study';
const isUserSite = repoName.endsWith('.github.io');
const base = process.env.DOCS_BASE ?? (isUserSite ? '/' : `/${repoName}/`);

export default defineConfig({
  title: 'Agent 应用开发学习笔记',
  description: '记录 Agent 应用开发学习过程',
  base,
  themeConfig: {
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '总纲', link: '/notes/00.代码仓库总纲' },
      { text: '基础认知', link: '/notes/01.Agent 认知' },
      { text: '开发实践', link: '/notes/05.实践案例 - 联网研究员' },
    ],
    sidebar: [
      {
        text: '总纲',
        items: [
          { text: '00.代码仓库总纲', link: '/notes/00.代码仓库总纲' },
        ],
      },
      {
        text: '基础认知',
        items: [
          { text: '01.Agent 认知', link: '/notes/01.Agent 认知' },
        ],
      },
      {
        text: '开发实践',
        items: [
          { text: '05.实践案例 - 联网研究员', link: '/notes/05.实践案例 - 联网研究员' },
        ],
      },
    ],
    outline: {
      level: [2, 4],   // 只显示 H2 和 H3 和 H4，默认就是这个
      label: '本页目录', // 把 "On this page" 改成中文
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/15272410401/agent-study.git' },
    ],
  },
});