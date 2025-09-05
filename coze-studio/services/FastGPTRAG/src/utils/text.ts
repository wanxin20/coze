import crypto from 'crypto';

/**
 * Generate hash for text content
 */
export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Normalize text content
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate text similarity using simple word overlap
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract summary from text (first paragraph or sentence)
 */
export function extractSummary(text: string, maxLength: number = 200): string {
  // Try to find first paragraph
  const firstParagraph = text.split('\n\n')[0];
  if (firstParagraph.length <= maxLength) {
    return firstParagraph.trim();
  }
  
  // Try to find first sentence
  const firstSentence = text.split(/[.!?。！？]/)[0];
  if (firstSentence.length <= maxLength) {
    return firstSentence.trim() + '。';
  }
  
  // Truncate to max length
  return truncateText(text, maxLength);
}

/**
 * Count tokens in text (rough estimation)
 */
export function estimateTokenCount(text: string): number {
  // Simple estimation: 1 token ≈ 4 characters for English, 1.5 for Chinese
  const englishChars = text.replace(/[\u4e00-\u9fff]/g, '').length;
  const chineseChars = text.length - englishChars;
  
  return Math.ceil(englishChars / 4 + chineseChars / 1.5);
}

/**
 * Clean text content
 */
export function cleanText(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}