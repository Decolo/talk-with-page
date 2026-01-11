import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Direct API Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Configuration:');
console.log('  API Key:', process.env.ANTHROPIC_AUTH_TOKEN?.substring(0, 20) + '...');
console.log('  Base URL:', process.env.ANTHROPIC_BASE_URL);
console.log('  Model:', process.env.ANTHROPIC_DEFAULT_SONNET_MODEL);
console.log('  Timeout:', process.env.API_TIMEOUT_MS + 'ms');
console.log('');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  timeout: parseInt(process.env.API_TIMEOUT_MS || '60000', 10)
});

const MODEL = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'claude-sonnet-4-5-20250929';

async function testDirectAPI() {
  try {
    console.log('🔄 Making API request...\n');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: 'Hello! Please respond with "API connection successful" if you can read this.'
      }]
    });

    console.log('✅ API Response received!\n');
    console.log('Response details:');
    console.log('  ID:', response.id);
    console.log('  Model:', response.model);
    console.log('  Role:', response.role);
    console.log('  Stop reason:', response.stop_reason);
    console.log('');

    console.log('Content:');
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log('  ', block.text);
      }
    }
    console.log('');

    console.log('✅ Test PASSED - API is working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ API Error:\n');

    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Name:', error.name);

      if (error.status) {
        console.error('  Status:', error.status);
      }

      if (error.error) {
        console.error('  Details:', JSON.stringify(error.error, null, 2));
      }

      console.error('\nFull stack:');
      console.error(error.stack);
    } else {
      console.error('  Unknown error:', error);
    }

    console.log('\n❌ Test FAILED - API connection issue');
    process.exit(1);
  }
}

console.log('Starting API test...\n');
testDirectAPI();
