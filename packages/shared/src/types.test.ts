import { describe, it, expect } from 'vitest';
import type { ClientMessage, StreamMessage } from './types.js';

describe('ClientMessage', () => {
  it('should create a valid command message', () => {
    const message: ClientMessage = {
      type: 'command',
      id: 'test-id',
      timestamp: Date.now(),
      payload: {
        instruction: 'test instruction',
        context: 'test context',
      },
    };

    expect(message.type).toBe('command');
    expect(message.id).toBe('test-id');
    expect(message.payload.instruction).toBe('test instruction');
  });

  it('should create a valid page_content message', () => {
    const message: ClientMessage = {
      type: 'page_content',
      id: 'test-id',
      timestamp: Date.now(),
      payload: {
        url: 'https://example.com',
        title: 'Example',
        content: 'Page content',
      },
    };

    expect(message.type).toBe('page_content');
    expect(message.payload.url).toBe('https://example.com');
  });

  it('should create a valid element_content message', () => {
    const message: ClientMessage = {
      type: 'element_content',
      id: 'test-id',
      timestamp: Date.now(),
      payload: {
        selector: '.test-selector',
        tagName: 'div',
        elementType: 'text',
        content: 'Element content',
      },
    };

    expect(message.type).toBe('element_content');
    expect(message.payload.selector).toBe('.test-selector');
    expect(message.payload.elementType).toBe('text');
  });
});

describe('StreamMessage', () => {
  it('should create a valid status message', () => {
    const message: StreamMessage = {
      type: 'status',
      requestId: 'req-123',
      content: 'Processing...',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('status');
    expect(message.requestId).toBe('req-123');
    expect(message.content).toBe('Processing...');
  });

  it('should create a valid text message', () => {
    const message: StreamMessage = {
      type: 'text',
      requestId: 'req-123',
      content: 'Response text',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('text');
    expect(message.content).toBe('Response text');
  });

  it('should create a valid tool message', () => {
    const message: StreamMessage = {
      type: 'tool',
      requestId: 'req-123',
      tool: 'Read',
      content: 'Reading file...',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('tool');
    expect(message.tool).toBe('Read');
  });

  it('should create a valid error message', () => {
    const message: StreamMessage = {
      type: 'error',
      requestId: 'req-123',
      content: 'Error occurred',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('error');
    expect(message.content).toBe('Error occurred');
  });

  it('should create a valid done message', () => {
    const message: StreamMessage = {
      type: 'done',
      requestId: 'req-123',
      timestamp: Date.now(),
    };

    expect(message.type).toBe('done');
    expect(message.requestId).toBe('req-123');
  });
});
