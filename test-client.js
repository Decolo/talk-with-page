import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9999');

ws.on('open', () => {
  console.log('✅ Connected to Claude Code Bridge');

  // Send a test command
  const testMessage = {
    type: 'command',
    id: 'test-' + Date.now(),
    timestamp: Date.now(),
    payload: {
      instruction: 'List all files in the current directory'
    }
  };

  console.log('\n📤 Sending command:', testMessage.payload.instruction);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'status') {
    console.log(`\n📊 Status: ${message.payload.status}`);
    if (message.payload.message) {
      console.log(`   Message: ${message.payload.message}`);
    }
  } else if (message.type === 'response') {
    console.log('\n📥 Response received:');
    console.log('   Content:', message.payload.content);
    if (message.payload.toolsUsed) {
      console.log('   Tools used:', message.payload.toolsUsed.join(', '));
    }

    // Close connection after receiving response
    setTimeout(() => {
      console.log('\n✅ Test completed successfully!');
      ws.close();
      process.exit(0);
    }, 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
});
