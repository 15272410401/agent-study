/**
 * LangGraph 工作流：异常告警分流 Agent
 *
 * 【关键知识点】
 * 1. ChatOpenAI：OpenAI 兼容客户端（可接 DeepSeek），temperature=0 保证分流稳定
 * 2. withStructuredOutput(Zod)：强制 LLM 输出 { isCodeBug: boolean }
 * 3. StateGraph + Conditional Edges：Filter 节点按 LLM 结果动态走 diagnose 或 END
 *
 * 图结构：
 *   START → filter ─┬─(真 Bug)→ diagnose → trace → notify → END
 *                   └─(噪音)──→ END
 */

import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { GraphState } from "./state";
import { MOCK_GIT_LOGS } from "../mock/data";

// 有 API Key 用真实 LLM，没有则用 Mock
const model = process.env.OPENAI_API_KEY
    ? new ChatOpenAI({
        model: process.env.OPENAI_MODEL,
        apiKey: process.env.OPENAI_API_KEY,
        // 兼容 DeepSeek 等：改 baseURL 即可，不必换 SDK
        configuration: {
            baseURL: process.env.OPENAI_BASE_URL || undefined,
        },
        // 失败时有限重试，避免偶发网络抖动直接打断流水线
        maxRetries: 2,
        temperature: 0
    }) : {
        withStructuredOutput: (schema: any) => ({
            invoke: async (input: string) => {
                console.log("[Mock Mode] 无 API Key，按预设逻辑分流。");
                return input.includes("TypeError")
                    ? { isCodeBug: true }
                    : { isCodeBug: false };
            }
        })
    } as any;

/** Filter 节点：LLM（或 Mock）判断是否为代码 Bug，并消费队列中的一条异常 */
async function filterNode(state: typeof GraphState.State) {
    console.log("\n[Node: Filter] 检查异常类型...");
    const ex = state.exceptions[0];

    // 用 Zod 定义输出 schema
    const schema = z.object({
        isCodeBug: z.boolean().describe("是否为代码 Bug"),
    });

    // withStructuredOutput 强制 LLM 按 schema 输出
    const res = await model
        .withStructuredOutput(schema)
        .invoke(`判断是否为代码 Bug: ${ex.type}`);

    return {
        // 真 Bug 才写入 currentException，供后续条件边判断
        currentException: res.isCodeBug ? ex : null,
        // 从队列头消费掉已处理异常
        exceptions: state.exceptions.slice(1),
        status: res.isCodeBug ? "diagnosing" : "filtered",
    };
}

/** Diagnose 节点：从堆栈解析出文件路径，写入诊断报告初稿 */
async function diagnoseNode(state: typeof GraphState.State) {
    console.log("[Node: Diagnose] 提取堆栈信息...");
    const ex = state.currentException!;

    // 匹配常见 Node 堆栈：at Fn (file:line:col)
    const fileMatch = ex.stack.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
    const file = fileMatch ? fileMatch[2] : "unknown";

    return {
        diagnosticReport: {
            file,
            introductionVersion: ex.bundleId,
        },
    };
}

/** Trace 节点：用文件路径关联 Git 日志，补上 author / reason */
async function traceNode(state: typeof GraphState.State) {
    console.log("[Node: Trace] 关联 Git 记录...");
    const report = state.diagnosticReport!;

    // 用 Mock Git 数据；真实项目可换成 git blame / 代码托管 API
    const git = MOCK_GIT_LOGS[report.file] || { author: "System" };

    return {
        diagnosticReport: {
            ...report,
            author: git.author,
            reason: `由 ${git.author} 引入`,
        },
    };
}

/** Notify 节点：输出告警（打印到控制台） */
async function notifyNode(state: typeof GraphState.State) {
    const report = state.diagnosticReport!;
    console.log(
        `[告警] 发现真 Bug！负责人: ${report.author}, 位置: ${report.file}`,
    );
    return { status: "notified" };
}

/**
 * 组装 StateGraph：
 * - addNode：注册处理函数
 * - addEdge：固定边
 * - addConditionalEdges：按 state 动态选下一跳（编排核心）
 */
const workflow = new StateGraph(GraphState)
    .addNode("filter", filterNode)
    .addNode("diagnose", diagnoseNode)
    .addNode("trace", traceNode)
    .addNode("notify", notifyNode)
    .addEdge(START, "filter")
    .addConditionalEdges("filter", (s) =>
        // 有 currentException → 走诊断；否则当作噪音直接结束
        s.currentException ? "diagnose" : END,
    )
    .addEdge("diagnose", "trace")
    .addEdge("trace", "notify")
    .addEdge("notify", END);

/** 编译后的可执行图（类似把蓝图变成可 invoke 的应用） */
export const app = workflow.compile();
