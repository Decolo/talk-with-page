#!/usr/bin/env node

import { WebSocketServer } from "ws";
import { runAgent } from "./agent.js";
import type { ClientMessage } from "./types.js";
import { parseCliArgs } from "./cli.js";
import { loadConfig } from "./config.js";

// Parse CLI arguments and load configuration
const cliOptions = parseCliArgs();
const config = loadConfig(cliOptions);

const wss = new WebSocketServer({ port: config.port, host: config.host });

console.log(`🌉 Claude Code Bridge running on ws://${config.host}:${config.port}`);

wss.on("connection", (ws) => {
  console.log('[Server] Client connected');

  // Store session ID per connection for conversation continuity
  let sessionId: string | undefined;
  // Store page context for this connection
  let pageContext: string | undefined;
  // Track current page URL to detect page changes
  let currentPageUrl: string | undefined;

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

      // Check if page changed (for command messages with URL)
      if (message.type === 'command' && message.payload.url) {
        const pageChanged = currentPageUrl && currentPageUrl !== message.payload.url;

        if (pageChanged) {
          // Reset session for new page
          sessionId = undefined;
          console.log(`[Server] Page changed: ${currentPageUrl} → ${message.payload.url}`);
        }

        // Update page context if full data provided
        if (message.payload.content || message.payload.images || message.payload.videos) {
          pageContext = buildPageContext(message);
          currentPageUrl = message.payload.url;
          console.log(`[Server] Page context updated (${pageContext.length} chars, ${message.payload.images?.length || 0} images, ${message.payload.videos?.length || 0} videos)`);
        } else {
          console.log(`[Server] No page content in message (content: ${!!message.payload.content}, images: ${!!message.payload.images}, videos: ${!!message.payload.videos})`);
        }
      }

      // Build prompt AFTER updating context
      const prompt = buildPrompt(message, pageContext);

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
      sessionId = await runAgent(prompt, message.id, ws, {
        anthropicAuthToken: config.anthropicAuthToken,
        anthropicBaseUrl: config.anthropicBaseUrl,
      }, sessionId);

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

function buildPageContext(message: ClientMessage): string {
  const { url, title, content, images, videos } = message.payload;
  const truncatedContent = content?.substring(0, 15000) || '';
  const isTruncated = (content?.length || 0) > 15000;

  const parts: string[] = [
    `URL: ${url}`,
    `Title: ${title}`,
    '',
    `Page Content:\n${truncatedContent}${isTruncated ? '...(truncated)' : ''}`,
  ];

  if (images && images.length > 0) {
    parts.push('', `Images (${images.length}):`);
    images.slice(0, 50).forEach((img, i) => parts.push(`  ${i + 1}. ${img}`));
    if (images.length > 50) parts.push(`  ... and ${images.length - 50} more`);
  }

  if (videos && videos.length > 0) {
    parts.push('', `Videos (${videos.length}):`);
    videos.forEach((vid, i) => parts.push(`  ${i + 1}. ${vid}`));
  }

  return parts.join('\n');
}

function buildPrompt(message: ClientMessage, pageContext?: string): string {
  if (message.type === 'command') {
    const { instruction, context, url, title } = message.payload;
    const parts: string[] = [];

    // Include stored page context if available
    if (pageContext) {
      parts.push('[Page Context]');
      parts.push(pageContext);
      parts.push('');
    } else if (url || title) {
      parts.push(`[Page context: ${title || 'Untitled'} - ${url || 'unknown URL'}]`);
    }

    if (context) {
      parts.push(`Context: ${context}`);
    }
    if (instruction) {
      parts.push(`User request: ${instruction}`);
    }

    return parts.join('\n\n');
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
