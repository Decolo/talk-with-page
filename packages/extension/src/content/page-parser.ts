import { Readability } from '@mozilla/readability';

export interface ParsedPage {
  url: string;
  title: string;
  content: string;
  textContent: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
  length: number;
  selectedText: string;
}

/**
 * Parse the current page using Readability.js
 * Returns clean, readable content stripped of ads, navigation, etc.
 */
export function parsePage(): ParsedPage {
  const selectedText = window.getSelection()?.toString() || '';

  try {
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;

    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (article) {
      console.log('[PageParser] Readability parsed successfully');
      return {
        url: window.location.href,
        title: article.title || document.title,
        content: article.content,        // HTML content
        textContent: article.textContent, // Plain text
        excerpt: article.excerpt,
        byline: article.byline,
        siteName: article.siteName,
        length: article.length,
        selectedText,
      };
    }
  } catch (error) {
    console.error('[PageParser] Readability error:', error);
  }

  // Fallback if Readability fails to parse
  console.log('[PageParser] Using fallback extraction');
  return {
    url: window.location.href,
    title: document.title,
    content: document.body.innerHTML,
    textContent: document.body.innerText,
    excerpt: null,
    byline: null,
    siteName: null,
    length: document.body.innerText.length,
    selectedText,
  };
}
