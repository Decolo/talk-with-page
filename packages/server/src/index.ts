#!/usr/bin/env node

import { WebSocketServer } from "ws";
import { runAgent } from "./agent.js";
import type { ClientMessage } from "./types.js";
import "dotenv/config";

const PORT = parseInt(process.env.WS_PORT || "9999");
const HOST = "127.0.0.1";

const wss = new WebSocketServer({ port: PORT, host: HOST });

console.log(`🌉 Claude Code Bridge running on ws://${HOST}:${PORT}`);

wss.on("connection", (ws) => {
  console.log('[Server] Client connected');

  // Store session ID per connection for conversation continuity
  let sessionId: string | undefined;

  ws.send(JSON.stringify({
    type: "status",
    requestId: "system",
    content: "Connected to Claude Code Bridge",
    timestamp: Date.now()
  }));

  ws.on("message", async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log(`[Server] Received: ${message.type} (id: ${message.id})`);

      const prompt = buildPrompt(message);

      if (!prompt) {
        ws.send(JSON.stringify({
          type: 'error',
          requestId: message.id,
          content: 'No instruction or content provided',
          timestamp: Date.now()
        }));
        return;
      }

      ws.send(JSON.stringify({
        type: 'status',
        requestId: message.id,
        content: 'Processing...',
        timestamp: Date.now()
      }));

      // Pass session ID for continuity, update with returned ID
      sessionId = await runAgent(prompt, message.id, ws, sessionId);

    } catch (error) {
      console.error('[Server] Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        requestId: 'unknown',
        content: error instanceof Error ? error.message : 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  ws.on("close", () => console.log('[Server] Client disconnected'));
  ws.on("error", (err) => console.error('[Server] WebSocket error:', err));
});

function buildPrompt(message: ClientMessage): string {
  if (message.type === 'command') {
    const { instruction, context } = message.payload;
    return context
      ? `Context: ${context}\n\nUser request: ${instruction}`
      : instruction || '';
  }

  if (message.type === 'page_content') {
    const { url, title, content, selectedText } = message.payload;
    const truncatedContent = content?.substring(0, 10000) || '';
    const isTruncated = (content?.length || 0) > 10000;

    return [
      'Analyze this web page content:',
      '',
      `URL: ${url}`,
      `Title: ${title}`,
      '',
      selectedText ? `Selected Text:\n${selectedText}\n` : '',
      `Content:\n${truncatedContent}${isTruncated ? '...(truncated)' : ''}`,
      '',
      'Please provide a concise analysis.'
    ].filter(Boolean).join('\n');
  }

  return '';
}

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Server] Shutting down...');
  wss.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
