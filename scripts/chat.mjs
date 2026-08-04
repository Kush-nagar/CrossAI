#!/usr/bin/env node
// Interactive chat with Cross: CROSS.md is the system prompt,
// and every file in training-data/ is loaded as grounding context.
//
// Usage: npm run chat

import readline from "node:readline/promises";
import { hasCredentials, missingCredentialsError, prepareConversation, streamChat, appendToolResults } from "./lib/aiClient.mjs";
import { buildSystemPrompt } from "./lib/prompt.mjs";
import { generateFileTool, runGenerateFileTool } from "./lib/tools.mjs";

const MAX_TOOL_ITERATIONS = 4;
const MAX_TOKENS = 8000;

async function main() {
  if (!hasCredentials()) {
    console.error(missingCredentialsError());
    process.exitCode = 1;
    return;
  }

  const system = await buildSystemPrompt();
  // Seeded once, then mutated in place for the rest of the session.
  const conversation = await prepareConversation(system, []);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Cross — type your message (Ctrl+C to quit).\n");

  while (true) {
    const userInput = await rl.question("You: ");
    if (!userInput.trim()) continue;

    conversation.push({ role: "user", content: userInput });

    process.stdout.write("\nCross: ");
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const { assistantMessage, toolCalls, isToolUse } = await streamChat({
        system,
        conversation,
        tools: [generateFileTool],
        maxTokens: MAX_TOKENS,
        onText: (delta) => process.stdout.write(delta),
      });
      conversation.push(assistantMessage);

      if (!isToolUse) break;

      const results = new Map();
      for (const call of toolCalls) {
        if (call.name !== "generate_file") {
          results.set(call.id, { content: `Unknown tool: ${call.name}`, isError: true });
          continue;
        }
        const result = await runGenerateFileTool({ input: call.input }, (_finalName, absPath) => absPath);
        if (!result.isError) {
          console.log(`\n📎 Saved: ${result.location}`);
        } else {
          console.log(`\n⚠️ ${result.toolResultContent}`);
        }
        results.set(call.id, { content: result.toolResultContent, isError: result.isError });
      }
      appendToolResults(conversation, toolCalls, results);
    }
    console.log("\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
