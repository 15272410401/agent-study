/**
 * Lesson 03 入口：依次把 Mock 异常送进 LangGraph 流水线
 *
 * 运行：在 apps/lesson-03 下执行 `pnpm dev`
 * 配置：复制 .env.example 为 .env，可接 DeepSeek；无 Key 则自动 Mock 分流
 */

import "dotenv/config";
import { app } from "./langGreph";
import { MOCK_EXCEPTIONS } from "../mock/data";

async function main() {
  console.log("异常处理 Agent 启动...");

  for (const ex of MOCK_EXCEPTIONS) {
    console.log(`\n>>> 正在处理异常: ${ex.id} (${ex.type})`);
    // invoke 传入初始 State 片段；其余字段用 Annotation 的 default
    await app.invoke({ exceptions: [ex] });
  }
}

main().catch(console.error);
