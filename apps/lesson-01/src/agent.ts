/**
 * Agent 核心：对话记忆 + 工具调用循环 + 流式输出
 *
 * 【本课关键知识点】
 * 1. LLM 本身不会“真的执行工具”，只会返回 tool_calls 意图
 * 2. Agent = 模型决策 + 本地执行工具 + 把结果塞回 messages 再问模型
 * 3. stream: true 时，正文与 tool_calls 都是增量 delta，需要自行拼接
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions';
import { executeTool, tools } from './tools';

// 从当前文件定位到 apps/lesson-01/.env 并加载
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const DEFAULT_SYSTEM_PROMPT = `你是一个有用的 AI 助手，尽量一步到位。
你可以按需调用工具：获取北京时间、安全计算数学表达式、按关键词查询互联网公开信息、查询城市当前天气。
需要准确时间、计算结果、实时信息或天气时，请使用对应工具，再基于工具结果回答用户。`;

/**
 * 流式场景下，一次完整的 function tool_call 会被拆成多个 delta 片段。
 * 用 index 做槽位，把 id / name / arguments 逐步拼回完整对象。
 */
type ToolCallAccumulator = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export class Agent {
  /** OpenAI 兼容客户端（DeepSeek 等也可通过 baseURL 接入） */
  private readonly client: OpenAI;
  private readonly model: string;

  /**
   * 多轮对话上下文（messages）。
   * 常见角色：
   * - system：人设与工具使用规则
   * - user / assistant：正常对话
   * - assistant + tool_calls：模型发起工具调用
   * - tool：本地工具执行结果（必须带 tool_call_id 与上一次调用对应）
   */
  private readonly messages: ChatCompletionMessageParam[];

  /** 防止模型反复调工具导致死循环 */
  private readonly maxToolRounds = 5;

  constructor(systemPrompt = DEFAULT_SYSTEM_PROMPT) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key') {
      throw new Error('请在 .env 中填写 OPENAI_API_KEY（可用 DeepSeek API Key）');
    }

    this.model = process.env.OPENAI_MODEL ?? 'deepseek-chat';
    // DeepSeek 兼容 OpenAI Chat Completions：换 baseURL + model 即可
    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL
    });
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  /**
   * 一次用户提问的完整 Agent 循环（可能包含多轮工具调用）。
   *
   * 流程：
   *   用户输入
   *     → 请求模型（携带 tools）
   *     → 若返回 tool_calls：本地执行 → 结果写入 messages → 再请求模型
   *     → 若返回正文：通过 onChunk 流式输出，结束本轮
   *
   * @param userInput 用户输入
   * @param onChunk   流式回调；每收到一段文本就调用一次（适合终端打字机效果）
   * @returns 完整回复文本（方便后续扩展，例如落库）
   */
  async chat(
    userInput: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    this.messages.push({ role: 'user', content: userInput });

    for (let round = 0; round < this.maxToolRounds; round++) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: this.messages,
        tools, // 把工具 schema 交给模型，由模型决定是否调用、传什么参数
        stream: true,
        temperature: 0
      });

      let content = '';
      const toolCalls: ToolCallAccumulator[] = [];

      // ---------- 消费 SSE 流：拼正文 + 拼工具调用 ----------
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 最终回答阶段：content 会一段段到来
        if (delta.content) {
          content += delta.content;
          onChunk?.(delta.content);
        }

        // 工具调用阶段：按 index 累积碎片
        // 例：第 1 片只有 name，第 2~N 片不断追加 arguments 字符串
        if (delta.tool_calls) {
          for (const part of delta.tool_calls) {
            const index = part.index;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: part.id ?? '',
                type: 'function',
                function: {
                  name: part.function?.name ?? '',
                  arguments: part.function?.arguments ?? ''
                }
              };
              continue;
            }

            if (part.id) toolCalls[index].id = part.id;
            if (part.function?.name) {
              toolCalls[index].function.name += part.function.name;
            }
            if (part.function?.arguments) {
              toolCalls[index].function.arguments += part.function.arguments;
            }
          }
        }
      }

      const completedToolCalls = toolCalls.filter(
        (tc): tc is ToolCallAccumulator => Boolean(tc?.id && tc.function.name)
      );

      // 没有工具调用 → 本轮结束，返回最终文本
      if (completedToolCalls.length === 0) {
        this.messages.push({ role: 'assistant', content });
        return content;
      }

      // 把“模型发起的工具调用”写入历史，再写入每条工具结果
      this.messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: completedToolCalls as ChatCompletionMessageToolCall[]
      });

      for (const toolCall of completedToolCalls) {
        const { name, arguments: argsJson } = toolCall.function;
        console.log(`\n[tool] ${name}(${argsJson || '{}'})`);

        // arguments 是 JSON 字符串，由 executeTool 解析并分发给具体实现
        const result = await executeTool(name, argsJson || '{}');
        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }
      // 进入下一轮：模型会基于 tool 结果继续推理或再次调工具
    }

    const fallback = '工具调用轮次过多，已停止。请换个问法再试。';
    onChunk?.(fallback);
    return fallback;
  }
}
