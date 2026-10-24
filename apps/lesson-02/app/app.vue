<script setup lang="ts">
/**
 * Lesson 02 前端入口：基于 Vercel AI SDK 的对话 UI
 *
 * 【关键知识点】
 * 1. useChat + DefaultChatTransport：浏览器只跟本站 /api/chat 通信
 * 2. UIMessage.parts：新协议用 parts[].text，而不是旧的 content 字符串
 * 3. Markdown（@comark/nuxt）：流式渲染助手回复，支持加粗/列表/链接
 */

import { computed, nextTick, ref, watch } from 'vue'
import { useChat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'

const input = ref('')
const listRef = ref<HTMLElement | null>(null)

/** 空状态快捷提问，降低首次使用成本 */
const suggestions = [
  '最近有什么科技新闻？',
  '帮我总结一下 AI 行业动态',
  '今天有哪些值得关注的互联网热点？'
]

// transport.api 指向 Nuxt server route：server/api/chat.post.ts
const { messages, sendMessage, status, error, stop } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' })
})

/** 请求已发出或正在收流：用于禁用重复发送、显示加载态 */
const isLoading = computed(() =>
  status.value === 'submitted' || status.value === 'streaming'
)

/** 仅「正在流式输出」时给 Markdown 开 streaming，避免整段重绘闪烁 */
const isStreaming = computed(() => status.value === 'streaming')

/** 从 UIMessage.parts 拼接纯文本（助手 Markdown / 用户气泡都用它） */
function messageText(message: {
  parts?: Array<{ type: string, text?: string }>
}) {
  return (message.parts ?? [])
    .filter(part => part.type === 'text')
    .map(part => part.text ?? '')
    .join('')
}

/** 发送消息；也可被快捷提问按钮直接调用 */
async function handleSubmit(text = input.value) {
  const value = text.trim()
  if (!value || isLoading.value) return

  input.value = ''
  await sendMessage({ text: value })
}

/** Enter 发送，Shift+Enter 换行 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

// 新消息或流式增量到来时，自动滚到列表底部
watch(
  messages,
  async () => {
    await nextTick()
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  },
  { deep: true }
)
</script>

<template>
  <UApp>
    <div class="from-default via-default to-muted/30 flex h-dvh flex-col bg-linear-to-b">
      <!-- 顶栏：品牌 + 状态 + 深浅色切换 -->
      <header class="border-default/80 bg-default/80 supports-backdrop-filter:backdrop-blur-md sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 ring-primary/15 text-primary flex size-10 items-center justify-center rounded-xl ring-1">
            <UIcon
              name="i-lucide-sparkles"
              class="size-5"
            />
          </div>
          <div>
            <h1 class="text-highlighted text-sm font-semibold tracking-tight">
              资讯助手
            </h1>
            <p class="text-muted text-xs">
              {{ isLoading ? '正在整理资讯…' : 'Coze Agent · 实时问答' }}
            </p>
          </div>
        </div>

        <UColorModeButton />
      </header>

      <!-- 消息滚动区 -->
      <div
        ref="listRef"
        class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 overflow-y-auto px-4 py-6"
      >
        <!-- 空状态 + 快捷提问 -->
        <div
          v-if="messages.length === 0"
          class="m-auto flex w-full max-w-lg flex-col items-center text-center"
        >
          <div class="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
            <UIcon
              name="i-lucide-messages-square"
              class="size-7"
            />
          </div>
          <p class="text-highlighted mb-1 text-lg font-semibold">
            开始一段对话
          </p>
          <p class="text-muted mb-6 text-sm leading-relaxed">
            我会帮你检索并整理最新资讯，支持 Markdown 排版与可点击链接。
          </p>
          <div class="flex w-full flex-wrap justify-center gap-2">
            <UButton
              v-for="item in suggestions"
              :key="item"
              color="neutral"
              variant="soft"
              size="sm"
              class="rounded-full"
              @click="handleSubmit(item)"
            >
              {{ item }}
            </UButton>
          </div>
        </div>

        <!-- 消息列表：用户右对齐气泡 / 助手左对齐 Markdown 卡片 -->
        <div
          v-for="(m, index) in messages"
          :key="m.id"
          class="flex gap-3"
          :class="m.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
        >
          <UAvatar
            :icon="m.role === 'user' ? 'i-lucide-user' : 'i-lucide-bot'"
            size="md"
            :class="m.role === 'user'
              ? 'bg-primary/15 text-primary'
              : 'bg-elevated text-muted ring-default ring-1'"
          />

          <div
            class="min-w-0 max-w-[min(100%,42rem)]"
            :class="m.role === 'user' ? 'items-end' : 'items-start'"
          >
            <p
              class="text-muted mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase"
              :class="m.role === 'user' ? 'text-right' : 'text-left'"
            >
              {{ m.role === 'user' ? '你' : '助手' }}
            </p>

            <!-- 用户：纯文本气泡 -->
            <div
              v-if="m.role === 'user'"
              class="bg-primary text-inverted rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed shadow-sm"
            >
              <p class="whitespace-pre-wrap">
                {{ messageText(m) }}
              </p>
            </div>

            <!-- 助手：流式 Markdown（最后一条且 streaming 时开启增量渲染） -->
            <div
              v-else
              class="border-default/60 bg-elevated/80 rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm"
            >
              <Markdown
                v-if="messageText(m)"
                :value="messageText(m)"
                :streaming="isStreaming && index === messages.length - 1"
                class="text-default max-w-none text-sm leading-relaxed
                  [&_a]:text-primary [&_a]:break-all [&_a]:underline [&_a]:underline-offset-2
                  [&_ol]:my-2 [&_ul]:my-2 [&_li]:my-1.5
                  [&_p]:my-2 [&_strong]:font-semibold
                  [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold
                  [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold"
              />
              <p
                v-else-if="isLoading"
                class="text-muted flex items-center gap-2 text-sm"
              >
                <UIcon
                  name="i-lucide-loader-circle"
                  class="size-4 animate-spin"
                />
                正在生成…
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="border-error/20 bg-error/5 text-error mx-auto max-w-md rounded-xl border px-4 py-3 text-center text-sm"
        >
          出错了：{{ error.message }}
        </div>
      </div>

      <!-- 输入区 -->
      <div class="border-default/80 bg-default/90 supports-backdrop-filter:backdrop-blur-md border-t px-4 py-4">
        <form
          class="mx-auto flex w-full max-w-3xl items-end gap-2"
          @submit.prevent="handleSubmit()"
        >
          <UTextarea
            v-model="input"
            :rows="1"
            autoresize
            :maxrows="6"
            class="flex-1"
            :ui="{ base: 'rounded-2xl' }"
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            @keydown="handleKeydown"
          />

          <UButton
            v-if="isLoading"
            type="button"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-lucide-square"
            class="rounded-xl"
            @click="stop"
          >
            停止
          </UButton>
          <UButton
            v-else
            type="submit"
            size="lg"
            icon="i-lucide-send"
            class="rounded-xl"
            :disabled="!input.trim()"
          >
            发送
          </UButton>
        </form>
        <p class="text-muted mx-auto mt-2 max-w-3xl text-center text-[11px]">
          回答由 Agent 生成，重要信息请核实原文链接
        </p>
      </div>
    </div>
  </UApp>
</template>
