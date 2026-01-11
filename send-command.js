#!/usr/bin/env node
import WebSocket from 'ws';

const command = process.argv.slice(2).join(' ');

if (!command) {
  console.log('Usage: node send-command.js <your command here>');
  console.log('');
  console.log('Examples:');
  console.log('  node send-command.js List all files in the current directory');
  console.log('  node send-command.js Create a file called test.txt with content Hello World');
  console.log('  node send-command.js Read the package.json file');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Sending to Claude Code Bridge');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const ws = new WebSocket('ws://127.0.0.1:9999');

ws.on('open', () => {
  console.log('📤 Command:', command);
  console.log('');

  const message = {
    type: 'command',
    id: 'cmd-' + Date.now(),
    timestamp: Date.now(),
    payload: {
      instruction: command
    }
  };

  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'status') {
    console.log('⏳', message.content || 'Processing...');
  } else if (message.type === 'text') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Response:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(message.content);
    console.log('');
  } else if (message.type === 'tool') {
    console.log('🔧 Tool:', message.tool);
  } else if (message.type === 'done') {
    console.log('');
    ws.close();
  } else if (message.type === 'error') {
    console.log('❌ Error:', message.content);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('✅ Done!\n');
  process.exit(0);
});
