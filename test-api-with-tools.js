import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  API Test with Tools (like our server)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Configuration:');
console.log('  API Key:', process.env.ANTHROPIC_AUTH_TOKEN?.substring(0, 20) + '...');
console.log('  Base URL:', process.env.ANTHROPIC_BASE_URL);
console.log('  Model:', process.env.ANTHROPIC_DEFAULT_SONNET_MODEL);
console.log('');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  timeout: parseInt(process.env.API_TIMEOUT_MS || '60000', 10)
});

const MODEL = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4-5-20250929';

// Simple test tool
const tools = [{
  name: 'get_current_time',
  description: 'Get the current time',
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
}];

async function testWithTools() {
  try {
    console.log('🔄 Making API request WITH TOOLS (same as WebSocket server)...\n');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: 'What time is it? Use the get_current_time tool.'
      }],
      tools
    });

    console.log('✅ API Response received!\n');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('\n✅ Test PASSED!');
    process.exit(0);
  } catch (error) {
    console.error('❌ API Error:\n');
    console.error('  Message:', error.message);
    console.error('  Status:', error.status);
    console.error('  Details:', JSON.stringify(error.error, null, 2));
    console.log('\n❌ Test FAILED');
    process.exit(1);
  }
}

testWithTools();
