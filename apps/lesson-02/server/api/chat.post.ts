/**
 * POST /api/chat
 *
 * 浏览器 useChat → 本接口 → Coze Studio/OpenAPI（SSE）→ 转成 AI SDK UI Message Stream
 *
 * 【关键知识点】
 * 1. 密钥只放服务端 runtimeConfig，前端拿不到 Token
 * 2. 本地 Coze Studio 的结束帧常导致官方 @coze/api 解析失败，故自写 SSE 解析
 * 3. createUIMessageStreamResponse：把增量文本写成 useChat 能消费的标准协议
 */

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

/** AI SDK useChat 发来的 UIMessage（正文在 parts 里） */
type UIChatMessage = {
  role: string
  content?: string
  parts?: Array<{ type: string, text?: string }>
}

type CozeSseEvent = {
  event: string
  data: unknown
}

/** 兼容旧 content 字段与新 parts 协议，取出用户纯文本 */
function getMessageText(message: UIChatMessage): string {
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content
  }

  return (message.parts ?? [])
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text ?? '')
    .join('')
}

/**
 * 自行解析 Coze Studio / 官方 OpenAPI 的 SSE。
 * 不使用 @coze/api 的 stream：本地 Studio 在结束后常发空 data 或
 * conversation.stream.done，官方 SDK 会 JSON.parse 失败。
 */
async function* readCozeSse(response: Response): AsyncGenerator<CozeSseEvent> {
  if (!response.body) {
    throw createError({ statusCode: 502, message: 'Coze 响应没有 body' })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []

  /** 把累积的 event/data 冲刷成一条结构化事件 */
  const flush = (): CozeSseEvent | null => {
    if (!eventName && dataLines.length === 0) return null

    const raw = dataLines.join('\n').trim()
    const currentEvent = eventName || 'message'
    eventName = ''
    dataLines = []

    // Studio 结束帧：空 data、[DONE]、stream.done → 统一成 done
    if (
      !raw
      || raw === '[DONE]'
      || currentEvent === 'done'
      || currentEvent === 'conversation.stream.done'
    ) {
      return { event: 'done', data: '[DONE]' }
    }

    try {
      return { event: currentEvent, data: JSON.parse(raw) as unknown }
    } catch {
      console.warn('[chat] 跳过无法解析的 SSE data:', raw.slice(0, 120))
      return null
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      // SSE 以空行分隔一条完整事件
      if (!line) {
        const item = flush()
        if (item) yield item
        continue
      }

      if (line.startsWith(':')) continue // 注释 / keepalive

      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        continue
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
  }

  // 刷掉尾部未以空行结束的最后一帧
  if (buffer.trim()) {
    const line = buffer.trim()
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }

  const last = flush()
  if (last) yield last
}

export default defineEventHandler(async (event) => {
  // 1. 读取前端 messages，并解析 Coze 配置
  const { messages } = await readBody<{ messages: UIChatMessage[] }>(event)
  const config = useRuntimeConfig(event)

  const token = String(config.cozeApiToken || process.env.COZE_API_TOKEN || '')
  const botId = String(config.cozeBotId || process.env.COZE_BOT_ID || '')
  // baseURL 不要带 /v3；SDK/路径里会拼 /v3/chat
  const baseURL = String(
    config.cozeBaseUrl
    || process.env.COZE_BASE_URL
    || 'http://localhost:8888'
  ).replace(/\/$/, '')

  if (!token || !botId) {
    throw createError({
      statusCode: 500,
      message: '请在 .env 中配置 COZE_API_TOKEN 与 COZE_BOT_ID'
    })
  }

  // 2. 取最后一条用户文本（本课单轮提问足够；多轮上下文可后续扩展）
  const lastUserMessage = [...(messages ?? [])]
    .reverse()
    .find(m => m.role === 'user')

  const userText = lastUserMessage ? getMessageText(lastUserMessage) : ''
  if (!userText) {
    throw createError({ statusCode: 400, message: 'No user message found' })
  }

  console.log('[chat] Coze request →', {
    url: `${baseURL}/v3/chat`,
    botId,
    userText: userText.slice(0, 80)
  })

  // 3. 同一段助手回复共用 textId，并按 AI SDK 要求写 text-start / delta / end
  const textId = crypto.randomUUID()
  let started = false

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const writeDelta = (delta: string) => {
        if (!delta) return
        if (!started) {
          writer.write({ type: 'text-start', id: textId })
          started = true
        }
        writer.write({ type: 'text-delta', id: textId, delta })
      }

      try {
        // 真正发起 Coze 流式对话（OpenAPI）
        const response = await fetch(`${baseURL}/v3/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({
            bot_id: botId,
            user_id: 'lesson-02-web-user',
            stream: true,
            auto_save_history: true,
            additional_messages: [
              {
                role: 'user',
                content: userText,
                content_type: 'text'
              }
            ]
          })
        })

        if (!response.ok) {
          const errText = await response.text()
          throw createError({
            statusCode: 502,
            message: `Coze HTTP ${response.status}: ${errText.slice(0, 200)}`
          })
        }

        // 4. 消费 Coze SSE，转成前端 UI Message 增量
        for await (const part of readCozeSse(response)) {
          console.log('[chat] Coze event:', part.event)

          if (part.event === 'done') break

          if (part.event === 'error') {
            const err = part.data as { code?: number, msg?: string }
            throw createError({
              statusCode: 502,
              message: `Coze error ${err.code ?? ''}: ${err.msg ?? 'unknown'}`
            })
          }

          const data = part.data as {
            type?: string
            content?: string
          }

          // 流式增量：只转发 type=answer 的正文
          if (part.event === 'conversation.message.delta') {
            if (data.type && data.type !== 'answer') continue
            writeDelta(data.content ?? '')
            continue
          }

          // Studio 有时不推 delta，只在 completed 给整段 answer
          if (part.event === 'conversation.message.completed') {
            if (data.type === 'answer' && !started) {
              writeDelta(data.content ?? '')
            }
          }
        }

        if (started) {
          writer.write({ type: 'text-end', id: textId })
        } else {
          console.warn('[chat] Coze 流结束但未收到 answer 文本')
          writer.write({ type: 'text-start', id: textId })
          writer.write({
            type: 'text-delta',
            id: textId,
            delta: '（未收到助手文本，请检查 Bot 是否已发布为 API 服务）'
          })
          writer.write({ type: 'text-end', id: textId })
        }
      } catch (error) {
        console.error('[chat] Coze 调用失败:', error)
        throw error
      }
    }
  })

  // 5. 返回标准 UI Message Stream Response，供 useChat 消费
  return createUIMessageStreamResponse({ stream })
})
