import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import TextCleaner from '@/utils/textCleaner.js';
import { splitText2Chunks, type SplitProps } from '@/utils/textSplitter.js';
import { 
  FileProcessResult, 
  FileProcessOptions, 
  SupportedFileType, 
  ChunkResult,
  SplitTextOptions,
  FileInfo,
  ImageType
} from './types.js';
import { docxProcessor } from './processors/docx.js';
import { pdfProcessor } from './processors/pdf.js';
import { xlsxProcessor } from './processors/xlsx.js';

/**
 * 文件处理管理器 - 复刻FastGPT-2的完整实现
 * 统一管理所有文件类型的处理逻辑
 */
export class FileProcessManager {
  
  /**
   * 主要文件处理入口函数
   */
  async processFileContent(options: FileProcessOptions): Promise<FileProcessResult> {
    const {
      content,
      filePath,
      buffer,
      type,
      chunkSize = 512,
      chunkOverlap = 50,
      preserveStructure = true,
      extractImages = false,
      filename
    } = options;

    try {
      logger.info(`Processing ${type} file: ${filename || filePath || 'buffer'}`);

      // 获取文件内容
      let fileContent = content;
      let fileBuffer = buffer;
      
      if (!fileContent && !fileBuffer && filePath) {
        if (this.isTextBasedFile(type)) {
          logger.info(`Processing text-based file: ${filename || filePath}`);
          fileContent = await this.readTextFile(filePath, options.encoding || 'utf-8');
        } else {
          logger.info(`Processing binary file: ${filename || filePath}`);
          fileBuffer = await fs.readFile(filePath);
        }
      }

      // 根据文件类型处理
      let processResult: FileProcessResult;
      
      switch (type) {
        case 'docx':
          if (!fileBuffer && filePath) {
            processResult = await docxProcessor.processFromPath(filePath);
          } else if (fileBuffer) {
            processResult = await docxProcessor.processFromBuffer(fileBuffer);
          } else {
            throw new Error('DOCX processing requires file buffer or path');
          }
          break;
          
        case 'pdf':
          if (!fileBuffer && filePath) {
            processResult = await pdfProcessor.processFromPath(filePath);
          } else if (fileBuffer) {
            processResult = await pdfProcessor.processFromBuffer(fileBuffer);
          } else {
            throw new Error('PDF processing requires file buffer or path');
          }
          break;
          
        case 'xlsx':
          if (!fileBuffer && filePath) {
            processResult = await xlsxProcessor.processFromPath(filePath);
          } else if (fileBuffer) {
            processResult = await xlsxProcessor.processFromBuffer(fileBuffer);
          } else {
            throw new Error('XLSX processing requires file buffer or path');
          }
          break;
          
        case 'html':
          if (!fileContent) throw new Error('HTML content is required');
          processResult = this.processHTMLContent(fileContent);
          break;
          
        case 'md':
        case 'markdown':
          if (!fileContent) throw new Error('Markdown content is required');
          processResult = this.processMarkdownContent(fileContent);
          break;
          
        case 'csv':
          if (!fileContent) throw new Error('CSV content is required');
          processResult = this.processCSVContent(fileContent);
          break;
          
        case 'json':
          if (!fileContent) throw new Error('JSON content is required');
          processResult = this.processJSONContent(fileContent);
          break;
          
        case 'txt':
        case 'text':
        default:
          if (!fileContent) throw new Error('Text content is required');
          processResult = this.processPlainText(fileContent);
          break;
      }

      // 使用增强的文本清理器
      const cleanedText = TextCleaner.smartClean(processResult.rawText);
      
      // 验证文本质量
      const quality = TextCleaner.validateTextQuality(cleanedText);
      if (!quality.isValid) {
        logger.warn(`Text quality issues detected: ${quality.issues.join(', ')}, score: ${quality.score}`);
        if (quality.score < 30) {
          throw new Error(`Text quality too poor: ${quality.issues.join(', ')}`);
        }
      }
      
      // 检测语言
      const language = this.detectLanguage(cleanedText);
      if (processResult.metadata) {
        processResult.metadata.language = language;
      }

      // 分块处理
      const chunks = await this.splitTextIntoChunks({
        text: cleanedText,
        chunkSize,
        chunkOverlap,
        preserveStructure,
        language
      });

      const result: FileProcessResult = {
        rawText: cleanedText, // 使用清理后的文本
        formatText: processResult.formatText,
        imageList: processResult.imageList,
        chunks: chunks, // 添加分块结果
        metadata: {
          ...processResult.metadata,
          totalChunks: chunks.length,
          totalCharacters: cleanedText.length,
          language,
          format: type
        }
      };

      logger.info(`File processed: ${chunks.length} chunks, ${processResult.rawText.length} characters`);
      return result;
      
    } catch (error) {
      logger.error('Failed to process file content:', error);
      throw error;
    }
  }

  /**
   * 检查是否为文本类型文件
   */
  private isTextBasedFile(type: SupportedFileType): boolean {
    return ['txt', 'md', 'markdown', 'html', 'csv', 'json'].includes(type);
  }

  /**
   * 清理文本中可能导致数据库错误的特殊字符
   * 增强版本，确保移除所有二进制数据和乱码
   */
  private cleanTextForDatabase(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    
    try {
      // 确保输入是字符串类型
      if (typeof cleaned !== 'string') {
        cleaned = String(cleaned);
      }
      
      cleaned = cleaned
        // 移除 NULL 字符和其他控制字符
        .replace(/\u0000/g, '')
        .replace(/[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '')
        
        // 移除常见的二进制文件头标识符
        .replace(/PK\u0003\u0004/g, '')  // ZIP文件头
        .replace(/\u00ff\u00d8\u00ff/g, '') // JPEG文件头
        .replace(/\u0089PNG\r\n\u001a\n/g, '') // PNG文件头
        .replace(/%PDF-/g, '') // PDF文件头
        
        // 移除BOM和其他特殊字符
        .replace(/[\u00ff\u00fe\u00ef\u00bb\u00bf]/g, '')
        .replace(/[\ufeff\ufffe]/g, '') // BOM标记
        
        // 移除可能的压缩文件内容标识符
        .replace(/word\/_rels\//g, '')
        .replace(/word\/document\.xml/g, '')
        .replace(/docProps\//g, '')
        .replace(/\[Content_Types\]\.xml/g, '')
        
        // 移除二进制数据模式 (连续的非ASCII字符)
        .replace(/[\u0080-\u00ff]{10,}/g, '') // 移除连续的高位字符
        
        // 移除看起来像base64但损坏的内容
        .replace(/[A-Za-z0-9+/]{50,}={0,2}/g, '')
        
        // 移除XML命名空间和标签残留
        .replace(/<[^>]*>/g, ' ')
        .replace(/xmlns[^=]*="[^"]*"/g, '')
        
        // 标准化换行符
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        
        // 清理多余的空白字符
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      // 检查清理后的文本是否包含有意义的内容
      if (cleaned.length < 10) {
        logger.warn('Cleaned text is too short, might be corrupted data');
        return '';
      }
      
      // 检查是否仍然含有大量非可打印字符
      const printableChars = cleaned.match(/[\u0020-\u007e\u4e00-\u9fff]/g) || [];
      const printableRatio = printableChars.length / cleaned.length;
      
      if (printableRatio < 0.5) {
        logger.warn('Text contains too many non-printable characters, likely corrupted');
        return '';
      }
      
      return cleaned;
      
    } catch (error) {
      logger.error('Error cleaning text for database:', error);
      return '';
    }
  }

  /**
   * 读取文本文件
   */
  private async readTextFile(filePath: string, encoding: string = 'utf-8'): Promise<string> {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
      logger.info(`Read text file: ${filePath}, size: ${content.length} characters`);
      return content;
    } catch (error) {
      logger.error(`Failed to read text file: ${filePath}`, error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理HTML内容
   */
  private processHTMLContent(html: string): FileProcessResult {
    try {
      const { parse } = require('node-html-parser');
      const root = parse(html);
      
      // 移除脚本和样式
      root.querySelectorAll('script, style').forEach((el: any) => el.remove());
      
      // 提取文本内容
      let text = root.text;
      
      // 基本清理
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      return {
        rawText: text,
        metadata: { format: 'html', contentLength: text.length }
      };
    } catch (error) {
      logger.warn('Failed to parse HTML, using fallback method:', error);
      return this.processPlainText(html.replace(/<[^>]+>/g, ' '));
    }
  }

  /**
   * 处理Markdown内容
   */
  private processMarkdownContent(markdown: string): FileProcessResult {
    try {
      let processed = markdown;
      
      // 转换标题
      processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '\n\n$1\n\n');
      
      // 转换列表
      processed = processed.replace(/^\s*[-*+]\s+(.+)$/gm, '• $1');
      processed = processed.replace(/^\s*\d+\.\s+(.+)$/gm, '• $1');
      
      // 移除代码块但保留内联代码
      processed = processed.replace(/```[\s\S]*?```/g, '[代码块]');
      processed = processed.replace(/`([^`]+)`/g, '$1');
      
      // 移除链接但保留文本
      processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      
      // 移除强调标记
      processed = processed.replace(/\*\*([^*]+)\*\*/g, '$1');
      processed = processed.replace(/\*([^*]+)\*/g, '$1');
      processed = processed.replace(/__([^_]+)__/g, '$1');
      processed = processed.replace(/_([^_]+)_/g, '$1');
      
      // 清理空白
      processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

      return {
        rawText: processed,
        metadata: { format: 'markdown', contentLength: processed.length }
      };
    } catch (error) {
      logger.warn('Failed to process Markdown content:', error);
      return this.processPlainText(markdown);
    }
  }

  /**
   * 处理CSV内容
   */
  private processCSVContent(csv: string): FileProcessResult {
    try {
      const lines = csv.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        return this.processPlainText(csv);
      }
      
      const headers = this.parseCSVLine(lines[0]);
      const rows = lines.slice(1);
      
      let processed = `表格数据：\n`;
      processed += `列名：${headers.join(', ')}\n\n`;
      
      rows.forEach((row, index) => {
        const values = this.parseCSVLine(row);
        const rowData = headers.map((header, i) => 
          `${header}: ${values[i] || ''}`
        ).join(', ');
        processed += `第${index + 1}行：${rowData}\n`;
      });
      
      return {
        rawText: processed,
        metadata: {
          format: 'csv',
          rowCount: rows.length,
          columnCount: headers.length,
          columns: headers,
          contentLength: processed.length
        }
      };
    } catch (error) {
      logger.warn('Failed to process CSV content:', error);
      return this.processPlainText(csv);
    }
  }

  /**
   * 解析CSV行
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  /**
   * 处理JSON内容
   */
  private processJSONContent(json: string): FileProcessResult {
    try {
      const parsed = JSON.parse(json);
      const text = this.convertObjectToText(parsed);
      
      return {
        rawText: text,
        metadata: { format: 'json', contentLength: text.length }
      };
    } catch (error) {
      logger.warn('Failed to process JSON content:', error);
      return this.processPlainText(json);
    }
  }

  /**
   * 将对象转换为可读文本
   */
  private convertObjectToText(obj: any, prefix: string = ''): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj === null || obj === undefined) return '';
    
    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this.convertObjectToText(item, `${prefix}[${index}]`)
      ).join('\n');
    }
    
    if (typeof obj === 'object') {
      return Object.entries(obj)
        .map(([key, value]) => {
          const newPrefix = prefix ? `${prefix}.${key}` : key;
          const valueText = this.convertObjectToText(value, newPrefix);
          return valueText ? `${key}: ${valueText}` : '';
        })
        .filter(Boolean)
        .join('\n');
    }
    
    return String(obj);
  }

  /**
   * 处理纯文本
   */
  private processPlainText(text: string): FileProcessResult {
    const processed = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      rawText: processed,
      metadata: { format: 'text', contentLength: processed.length }
    };
  }

  /**
   * 检测文本语言
   */
  private detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 'en';
    
    const chineseRatio = chineseChars / totalChars;
    
    if (chineseRatio > 0.3) return 'zh';
    if (chineseRatio > 0.05) return 'mixed';
    return 'en';
  }

  /**
   * 将文本分割成块 - 使用FastGPT-2的文本分割器
   */
  private async splitTextIntoChunks(options: SplitTextOptions): Promise<ChunkResult[]> {
    const { text, chunkSize, chunkOverlap, preserveStructure, language } = options;

    try {
      // 使用FastGPT-2的splitText2Chunks函数
      const splitProps: SplitProps = {
        text,
        chunkSize,
        paragraphChunkDeep: preserveStructure ? 5 : 0,
        paragraphChunkMinSize: 100,
        maxSize: 16000,
        overlapRatio: (chunkOverlap || 50) / chunkSize,
        customReg: []
      };

      const result = splitText2Chunks(splitProps);
      
      return result.chunks.map((chunk, index) => ({
        text: chunk,
        index,
        metadata: { 
          chunkIndex: index, 
          splitMethod: 'fastgpt2',
          totalChunks: result.chunks.length,
          chars: result.chars
        }
      }));

    } catch (error) {
      logger.warn('Failed to split text with FastGPT-2 splitter, falling back to simple split:', error);
      return await this.simpleSplit(text, chunkSize, chunkOverlap || 50);
    }
  }

  /**
   * 结构化文本分割
   */
  private async structuralSplit(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    language: string
  ): Promise<ChunkResult[]> {
    const chunks: ChunkResult[] = [];
    
    // 按段落分割
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // 如果添加此段落会超过块大小
      if (currentChunk && (currentChunk.length + trimmedParagraph.length) > chunkSize) {
        // 保存当前块
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex,
            metadata: { chunkIndex, splitMethod: 'structural' }
          });
          chunkIndex++;
        }
        
        // 开始新块并考虑重叠
        if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
          const overlapText = currentChunk.slice(-chunkOverlap);
          currentChunk = overlapText + '\n\n' + trimmedParagraph;
        } else {
          currentChunk = trimmedParagraph;
        }
      } else {
        // 添加段落到当前块
        if (currentChunk) {
          currentChunk += '\n\n' + trimmedParagraph;
        } else {
          currentChunk = trimmedParagraph;
        }
      }
      
      // 如果段落本身太长，进行简单分割
      if (trimmedParagraph.length > chunkSize) {
        const subChunks = await this.simpleSplit(trimmedParagraph, chunkSize, chunkOverlap);
        for (const subChunk of subChunks) {
          chunks.push({
            text: subChunk.text,
            index: chunkIndex,
            metadata: { chunkIndex, splitMethod: 'paragraph-overflow' }
          });
          chunkIndex++;
        }
        currentChunk = '';
      }
    }
    
    // 添加最后一个块
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        metadata: { chunkIndex, splitMethod: 'structural' }
      });
    }
    
    return chunks;
  }

  /**
   * 简单文本分割
   */
  private async simpleSplit(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<ChunkResult[]> {
    const chunks: ChunkResult[] = [];
    
    if (text.length <= chunkSize) {
      return [{ 
        text, 
        index: 0,
        metadata: { splitMethod: 'none' } 
      }];
    }
    
    let start = 0;
    let chunkIndex = 0;
    
    while (start < text.length) {
      let end = start + chunkSize;
      
      // 如果不是最后一个块，尝试找到好的断点
      if (end < text.length) {
        // 查找句子结尾
        const sentenceEnd = text.lastIndexOf('。', end);
        const sentenceEndEn = text.lastIndexOf('.', end);
        const newlineEnd = text.lastIndexOf('\n', end);
        
        const bestEnd = Math.max(sentenceEnd, sentenceEndEn, newlineEnd);
        
        if (bestEnd > start + chunkSize * 0.5) {
          end = bestEnd + 1;
        }
      }
      
      const chunkText = text.slice(start, end).trim();
      
      if (chunkText) {
        chunks.push({
          text: chunkText,
          index: chunkIndex,
          metadata: { 
            chunkIndex, 
            splitMethod: 'simple',
            start,
            end: end
          }
        });
        chunkIndex++;
      }
      
      // 移动起始位置并考虑重叠
      start = Math.max(start + chunkSize - chunkOverlap, end);
    }
    
    return chunks;
  }
}

// 导出实例
export const fileProcessManager = new FileProcessManager();

// 向后兼容的导出
export const processFileContent = fileProcessManager.processFileContent.bind(fileProcessManager);

// 估算处理时间
export function estimateProcessingTime(contentLength: number, fileType: string): number {
  const baseTime = 100; // 基础时间（毫秒）
  const charRate = fileType === 'pdf' ? 0.5 : 0.1; // 每字符处理时间
  
  return baseTime + contentLength * charRate;
}

// 验证文件内容
export function validateFileContent(content: string, type: string): {
  isValid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { isValid: false, error: 'Content is empty' };
  }
  
  if (content.length > 10 * 1024 * 1024) { // 10MB限制
    return { isValid: false, error: 'Content too large (>10MB)' };
  }
  
  // 类型特定验证
  switch (type) {
    case 'json':
      try {
        JSON.parse(content);
      } catch (error) {
        return { isValid: false, error: 'Invalid JSON format' };
      }
      break;
  }
  
  return { isValid: true };
}

// 获取文件信息
export function getFileInfo(file: Express.Multer.File): FileInfo {
  const fullExt = path.extname(file.originalname);
  const extension = fullExt.toLowerCase().slice(1);
  
  logger.info(`File extension extraction: "${file.originalname}" -> fullExt: "${fullExt}" -> extension: "${extension}"`);
  
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    extension
  };
}