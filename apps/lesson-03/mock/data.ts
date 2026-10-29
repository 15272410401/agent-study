/**
 * Mock 数据：线上异常样本 + 简易 Git 日志
 * 真实项目可替换为 Sentry / 日志平台 / git blame API
 */

/** 一条线上异常记录 */
export interface Exception {
  id: string;
  type: string;
  message: string;
  stack: string;
  bundleId: string;
  timestamp: string;
}

/** 两条样例：一条真 Bug（TypeError），一条噪音（扫描器） */
export const MOCK_EXCEPTIONS: Exception[] = [
  {
    id: "ex_101",
    type: "TypeError",
    message: "Cannot read property 'price' of undefined",
    stack:
      "TypeError: Cannot read property 'price' of undefined\n    at CartService.calculate (src/services/CartService.ts:24:12)\n    at ...",
    bundleId: "shopping-cart-v1.0.5",
    timestamp: "2026-05-26T14:00:00Z",
  },
  {
    id: "ex_102",
    type: "WebScannerError",
    message: "Suspicious UA detected",
    stack:
      "Error: 403 Forbidden\n    at SecurityMiddleware.check (src/middleware/Security.ts:15:9)",
    bundleId: "unknown",
    timestamp: "2026-05-26T14:10:00Z",
  },
];

/** file path → 最近一次相关提交（供 Trace 节点查找负责人） */
export const MOCK_GIT_LOGS: Record<
  string,
  { hash: string; author: string; date: string; message: string }
> = {
  "src/services/CartService.ts": {
    hash: "f2e4a1b",
    author: "He MouRen",
    date: "2026-05-26T09:00:00Z",
    message: "refactor: simplify cart logic",
  },
};
