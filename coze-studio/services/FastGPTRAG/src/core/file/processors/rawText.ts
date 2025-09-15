import { logger } from '../../../utils/logger.js';
import { FileProcessResult } from '../types.js';

/**
 * 纯文本文件处理器 - 复刻FastGPT-2的实现
 * 处理 .txt, .md 等纯文本文件
 */
export class RawTextProcessor {

  async processFromBuffer(buffer: Buffer, encoding: string = 'utf-8'): Promise<FileProcessResult> {
    try {
      logger.info('Starting raw text processing');
      
      let rawText: string;
      
      try {
        rawText = buffer.toString(encoding as BufferEncoding);
      } catch (error) {
        logger.warn(`Failed to decode with ${encoding}, trying utf-8:`, error);
        rawText = buffer.toString('utf-8');
      }
      
      // 基本文本清理
      rawText = this.cleanRawText(rawText);
      
      logger.info(`Raw text processed successfully: ${rawText.length} characters`);

      return {
        rawText,
        imageList: [],
        metadata: {
          format: 'text',
          contentLength: rawText.length,
          encoding
        }
      };
    } catch (error) {
      logger.error('Failed to process raw text file:', error);
      throw new Error('Cannot read text file, please check the file format and encoding');
    }
  }

  async processFromPath(filePath: string, encoding: string = 'utf-8'): Promise<FileProcessResult> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      return this.processFromBuffer(buffer, encoding);
    } catch (error) {
      logger.error('Failed to read text file from path:', error);
      throw error;
    }
  }

  /**
   * 清理原始文本 - 复刻FastGPT-2逻辑
   */
  private cleanRawText(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    try {
      // 移除BOM标记
      cleaned = cleaned.replace(/^\uFEFF/, '');
      
      // 标准化换行符
      cleaned = cleaned.replace(/\r\n/g, '\n');
      cleaned = cleaned.replace(/\r/g, '\n');
      
      // 移除控制字符（保留换行和制表符）
      cleaned = cleaned.replace(/[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '');
      
      // 处理制表符
      cleaned = cleaned.replace(/\t/g, '    '); // 转换为4个空格
      
      // 清理多余的空白行（保留段落结构）
      cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // 移除行尾空白
      cleaned = cleaned.replace(/[ \t]+$/gm, '');
      
      // 移除文件开头和结尾的空白
      cleaned = cleaned.trim();
      
      return cleaned;
      
    } catch (error) {
      logger.warn('Error cleaning raw text:', error);
      return text.trim();
    }
  }

  /**
   * 检测文本编码（简单版本）
   */
  static detectEncoding(buffer: Buffer): string {
    // 检查BOM
    if (buffer.length >= 3) {
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf-8';
      }
    }
    
    if (buffer.length >= 2) {
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf-16le';
      }
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf-16be';
      }
    }
    
    // 简单的UTF-8检测
    try {
      const text = buffer.toString('utf-8');
      // 检查是否包含替换字符（通常表示编码错误）
      if (text.includes('\uFFFD')) {
        return 'latin1'; // 回退到latin1
      }
      return 'utf-8';
    } catch (error) {
      return 'latin1';
    }
  }

  /**
   * 自动检测编码并处理文本
   */
  async processWithAutoEncoding(buffer: Buffer): Promise<FileProcessResult> {
    const detectedEncoding = RawTextProcessor.detectEncoding(buffer);
    logger.info(`Detected encoding: ${detectedEncoding}`);
    
    return this.processFromBuffer(buffer, detectedEncoding);
  }
}

export const rawTextProcessor = new RawTextProcessor();
