/**
 * Graph 共享状态（State）
 *
 * 【关键知识点】
 * - Annotation.Root：声明图里所有节点可读写的字段
 * - reducer：多节点更新同一字段时如何合并（本课多为「后者覆盖」）
 * - default：invoke 时未传入该字段的默认值
 *
 * 节点之间不靠函数参数层层传递，而是读写这份「共享内存」。
 */

import { Annotation } from "@langchain/langgraph";
import type { Exception } from "../mock/data";

/** 诊断报告：Diagnose 写初稿，Trace 再补 author / reason */
export type DiagnosticReport = {
  file: string;
  introductionVersion?: string;
  author?: string;
  reason?: string;
};

export const GraphState = Annotation.Root({
  /** 待处理异常队列（Filter 每次消费队头一条） */
  exceptions: Annotation<Exception[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  /** 当前真 Bug；Filter 写入，条件边据此分流 */
  currentException: Annotation<Exception | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  /** 诊断报告；Diagnose → Trace 逐步填充 */
  diagnosticReport: Annotation<DiagnosticReport | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  /** 流水线状态文案：idle / diagnosing / filtered / notified */
  status: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "idle",
  }),
});
