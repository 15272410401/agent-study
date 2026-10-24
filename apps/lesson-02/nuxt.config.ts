// https://nuxt.com/docs/api/configuration/nuxt-config
/**
 * Lesson 02 Nuxt 配置
 * - @nuxt/ui：UI 组件与主题
 * - @comark/nuxt：流式 Markdown 渲染（助手回复）
 * - runtimeConfig：Coze Token / BotId / BaseURL（仅服务端可读）
 */
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@comark/nuxt'
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      title: '资讯助手 · Lesson 02',
      htmlAttrs: {
        lang: 'zh-CN'
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // 开启 Nuxt UI Prose，配合 Markdown 组件样式
  ui: {
    prose: true
  },

  runtimeConfig: {
    // 也可用环境变量覆盖：NUXT_COZE_API_TOKEN / NUXT_COZE_BOT_ID / NUXT_COZE_BASE_URL
    cozeApiToken: process.env.COZE_API_TOKEN || '',
    cozeBotId: process.env.COZE_BOT_ID || '',
    // 本地 coze-studio 示例：http://localhost:8888 ；云端：https://api.coze.cn
    cozeBaseUrl: process.env.COZE_BASE_URL || 'http://localhost:8888'
  },

  // 对话页依赖服务端 /api/chat，不做静态预渲染
  routeRules: {
    '/': { ssr: false }
  },

  compatibilityDate: '2026-06-30',

  telemetry: false,

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
