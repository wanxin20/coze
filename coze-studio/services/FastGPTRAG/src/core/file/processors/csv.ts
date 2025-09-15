import { logger } from '../../../utils/logger.js';
import { FileProcessResult } from '../types.js';

/**
 * CSV文件处理器 - 复刻FastGPT-2的实现
 * 解析CSV文件并转换为结构化文本
 */
export class CsvProcessor {

  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    try {
      logger.info('Starting CSV processing');
      
      const csvContent = buffer.toString('utf-8');
      const rawText = this.processCsvContent(csvContent);
      
      logger.info(`CSV processed successfully: ${rawText.length} characters`);

      return {
        rawText,
        imageList: [],
        metadata: {
          format: 'csv',
          contentLength: rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process CSV file:', error);
      throw new Error('Cannot read CSV file, please check the file format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      return this.processFromBuffer(buffer);
    } catch (error) {
      logger.error('Failed to read CSV file from path:', error);
      throw error;
    }
  }

  /**
   * 处理CSV内容 - 复刻FastGPT-2逻辑
   */
  private processCsvContent(csvContent: string): string {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return '';
      }
      
      // 解析表头
      const headers = this.parseCSVLine(lines[0]);
      const dataRows = lines.slice(1);
      
      let result = '';
      
      // 添加表头信息
      result += `CSV数据表格\n`;
      result += `列数: ${headers.length}\n`;
      result += `行数: ${dataRows.length}\n`;
      result += `列名: ${headers.join(', ')}\n`;
      result += `${'='.repeat(50)}\n\n`;
      
      // 处理数据行
      dataRows.forEach((row, rowIndex) => {
        const values = this.parseCSVLine(row);
        
        if (values.some(value => value.trim())) { // 只处理非空行
          result += `第${rowIndex + 1}行数据:\n`;
          
          headers.forEach((header, colIndex) => {
            const value = values[colIndex] || '';
            if (value.trim()) {
              result += `  ${header}: ${value.trim()}\n`;
            }
          });
          
          result += '\n';
        }
      });
      
      // 如果是问答格式的CSV，特别处理
      if (this.isQAFormat(headers)) {
        result += this.formatAsQA(headers, dataRows);
      }
      
      return result.trim();
      
    } catch (error) {
      logger.warn('Failed to process CSV with structured parsing, using simple parsing:', error);
      return this.simpleCSVParse(csvContent);
    }
  }
  
  /**
   * 解析CSV行 - 处理引号和逗号
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // 转义的引号
          current += '"';
          i += 2;
          continue;
        } else if (!inQuotes) {
          // 开始引号
          inQuotes = true;
        } else {
          // 结束引号
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        // 分隔符
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
      
      i++;
    }
    
    // 添加最后一个字段
    result.push(current.trim());
    
    return result;
  }
  
  /**
   * 检查是否为问答格式
   */
  private isQAFormat(headers: string[]): boolean {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    // 检查是否包含常见的问答列名
    const qaPatterns = [
      ['question', 'answer'],
      ['q', 'a'],
      ['问题', '答案'],
      ['问', '答'],
      ['query', 'response']
    ];
    
    return qaPatterns.some(pattern => 
      pattern.every(col => lowerHeaders.some(header => header.includes(col)))
    );
  }
  
  /**
   * 格式化为问答对
   */
  private formatAsQA(headers: string[], dataRows: string[]): string {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    // 找到问题和答案列的索引
    let questionIndex = -1;
    let answerIndex = -1;
    
    // 查找问题列
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (header.includes('question') || header.includes('q') || 
          header.includes('问题') || header.includes('问') || 
          header.includes('query')) {
        questionIndex = i;
        break;
      }
    }
    
    // 查找答案列
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (header.includes('answer') || header.includes('a') || 
          header.includes('答案') || header.includes('答') || 
          header.includes('response')) {
        answerIndex = i;
        break;
      }
    }
    
    if (questionIndex === -1 || answerIndex === -1) {
      return '';
    }
    
    let qaResult = '\n问答对格式:\n';
    qaResult += '=' .repeat(30) + '\n\n';
    
    dataRows.forEach((row, index) => {
      const values = this.parseCSVLine(row);
      const question = values[questionIndex]?.trim();
      const answer = values[answerIndex]?.trim();
      
      if (question && answer) {
        qaResult += `Q${index + 1}: ${question}\n`;
        qaResult += `A${index + 1}: ${answer}\n\n`;
      }
    });
    
    return qaResult;
  }
  
  /**
   * 简单CSV解析（回退方法）
   */
  private simpleCSVParse(csvContent: string): string {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return '';
    }
    
    let result = 'CSV文件内容:\n';
    
    lines.forEach((line, index) => {
      const cleanLine = line.replace(/,/g, ' | ').trim();
      if (cleanLine) {
        result += `第${index + 1}行: ${cleanLine}\n`;
      }
    });
    
    return result;
  }
}

export const csvProcessor = new CsvProcessor();
