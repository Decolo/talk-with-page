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
  images: string[];
  videos: string[];
}

/**
 * Extract all image and video URLs from the page
 */
function extractMediaUrls(): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];

  // Extract image URLs
  document.querySelectorAll('img[src]').forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (src && !src.startsWith('data:')) {
      images.push(src);
    }
  });

  // Extract video URLs (video elements and sources)
  document.querySelectorAll('video[src], video source[src]').forEach((el) => {
    const src = (el as HTMLVideoElement | HTMLSourceElement).src;
    if (src) {
      videos.push(src);
    }
  });

  // Extract iframe embeds (YouTube, Vimeo, etc.)
  document.querySelectorAll('iframe[src]').forEach((iframe) => {
    const src = (iframe as HTMLIFrameElement).src;
    if (src && (src.includes('youtube') || src.includes('vimeo') || src.includes('player'))) {
      videos.push(src);
    }
  });

  // Deduplicate
  return {
    images: [...new Set(images)],
    videos: [...new Set(videos)],
  };
}

/**
 * Parse the current page using Readability.js
 * Returns clean, readable content stripped of ads, navigation, etc.
 */
export function parsePage(): ParsedPage {
  const selectedText = window.getSelection()?.toString() || '';
  const media = extractMediaUrls();

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
        images: media.images,
        videos: media.videos,
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
    images: media.images,
    videos: media.videos,
  };
}
