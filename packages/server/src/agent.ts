import { query } from "@anthropic-ai/claude-agent-sdk";
import type { WebSocket } from "ws";

/**
 * Run Claude Agent with streaming responses to WebSocket
 * Based on: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
 *
 * Note: SDK reads API credentials from environment variables:
 * - ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY
 * - ANTHROPIC_BASE_URL (optional, for custom endpoints)
 */
export async function runAgent(
  prompt: string,
  requestId: string,
  ws: WebSocket,
  sessionId?: string
): Promise<string | undefined> {
  let currentSessionId = sessionId;

  try {
    const response = query({
      prompt,
      options: {
        allowedTools: ["Bash", "Read", "Write", "Glob", "Edit"],
        ...(sessionId && { resume: sessionId }),
      }
    });

    for await (const message of response) {
      switch (message.type) {
        case 'system':
          // Initialization and completion messages
          if (message.subtype === 'init') {
            currentSessionId = message.session_id;
            console.log(`[Agent] Session: ${currentSessionId}`);
          }
          break;

        case 'assistant':
          // Claude's response - may contain text and/or tool_use blocks
          if (!message.message?.content) break;

          for (const block of message.message.content) {
            if (block.type === 'text' && block.text.trim()) {
              ws.send(JSON.stringify({
                type: 'text',
                requestId,
                content: block.text,
                timestamp: Date.now()
              }));
            } else if (block.type === 'tool_use') {
              ws.send(JSON.stringify({
                type: 'tool',
                requestId,
                tool: block.name,
                timestamp: Date.now()
              }));
            }
          }
          break;

        case 'user':
          // Tool execution results
          if (!message.message?.content) break;

          for (const block of message.message.content) {
            if (block.type === 'tool_result' && block.content) {
              const text = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);

              ws.send(JSON.stringify({
                type: 'text',
                requestId,
                content: text,
                timestamp: Date.now()
              }));
            }
          }
          break;

        case 'result':
          // Query completed (success or error)
          if (message.is_error) {
            ws.send(JSON.stringify({
              type: 'error',
              requestId,
              content: `Error: ${message.subtype}`,
              timestamp: Date.now()
            }));
          } else {
            console.log(`[Agent] Completed in ${message.duration_ms}ms`);
          }
          break;
      }
    }

    ws.send(JSON.stringify({
      type: 'done',
      requestId,
      timestamp: Date.now()
    }));

    return currentSessionId;

  } catch (error) {
    console.error('[Agent] Error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      requestId,
      content: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    }));
    return currentSessionId;
  }
}
