// Client → Server
export interface ClientMessage {
  type: 'command' | 'page_content' | 'element_content';
  id: string;
  timestamp: number;
  payload: {
    instruction?: string;
    context?: string;
    url?: string;
    title?: string;
    content?: string;
    selectedText?: string;
    // Element picker fields
    selector?: string;
    tagName?: string;
    elementType?: 'text' | 'table' | 'list' | 'code';
    structured?: Record<string, unknown>;
    // Media fields (now included in command messages)
    images?: string[];
    videos?: string[];
  };
}

// Server → Client (streamed)
export interface StreamMessage {
  type: 'status' | 'text' | 'tool' | 'error' | 'done';
  requestId: string;
  content?: string;
  tool?: string;
  timestamp: number;
}
