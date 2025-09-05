import crypto from 'crypto';

/**
 * 计算字符串的哈希值
 */
export function hashStr(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 简化的token计算（实际应该使用tiktoken）
 */
export function countTokens(text: string): number {
  // 简单估算：中文字符按2个token计算，英文按0.75计算
  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherCount = text.length - chineseCount;
  return Math.ceil(chineseCount * 2 + otherCount * 0.75);
}

/**
 * 清理文本，移除标点符号和空格
 */
export function cleanText(text: string): string {
  return text.replace(/[^\p{L}\p{N}]/gu, '');
}
