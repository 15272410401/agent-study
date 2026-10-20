/**
 * 命令行入口：交互式对话，流式打印助手回复。
 *
 * 运行：在 apps/lesson-01 目录执行 `pnpm dev`
 * 退出：输入 exit 或空行
 */

import readline from 'node:readline/promises';
import { Agent } from './agent';

const agent = new Agent();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Lesson-01 Agent 已启动。输入问题开始对话，输入 exit 退出。');

while (true) {
  const input = (await rl.question('你: ')).trim();
  if (!input || input === 'exit') {
    break;
  }

  // 流式输出：每收到一段 token 就立刻写到终端
  process.stdout.write('助手: ');
  await agent.chat(input, (chunk) => {
    process.stdout.write(chunk);
  });
  process.stdout.write('\n');
}

rl.close();
