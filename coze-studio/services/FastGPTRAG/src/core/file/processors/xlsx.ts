import * as XLSX from 'node-xlsx';
import { logger } from '@/utils/logger.js';
import { FileProcessResult } from '../types.js';

/**
 * Excel文件处理器 - 复刻FastGPT-2的实现
 * 支持XLSX、XLS格式
 */
export class XlsxProcessor {

  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    try {
      logger.info('Starting XLSX processing with node-xlsx');
      
      const workbook = XLSX.parse(buffer);
      let fullText = '';
      
      // 处理每个工作表
      workbook.forEach((worksheet, index) => {
        const sheetName = worksheet.name || `Sheet${index + 1}`;
        fullText += `\n\n工作表: ${sheetName}\n`;
        fullText += '=' .repeat(50) + '\n';
        
        const data = worksheet.data;
        if (data && data.length > 0) {
          // 检测表头
          const headers = data[0] as any[];
          if (headers && headers.length > 0) {
            fullText += `表头: ${headers.join(' | ')}\n`;
            fullText += '-'.repeat(50) + '\n';
          }
          
          // 处理数据行
          for (let i = 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (row && row.length > 0) {
              // 过滤空值并格式化
              const rowData = row.map((cell, cellIndex) => {
                const header = headers[cellIndex] || `列${cellIndex + 1}`;
                const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
                return value ? `${header}: ${value}` : '';
              }).filter(Boolean);
              
              if (rowData.length > 0) {
                fullText += `第${i}行 - ${rowData.join(', ')}\n`;
              }
            }
          }
        } else {
          fullText += '(空工作表)\n';
        }
      });

      const cleanedText = this.cleanExcelText(fullText);

      logger.info(`XLSX processed successfully: ${cleanedText.length} characters from ${workbook.length} sheets`);

      return {
        rawText: cleanedText,
        imageList: [],
        metadata: {
          format: 'xlsx',
          sheetCount: workbook.length,
          contentLength: cleanedText.length,
          sheets: workbook.map(sheet => ({
            name: sheet.name,
            rowCount: sheet.data?.length || 0
          }))
        }
      };
    } catch (error) {
      logger.error('Failed to process XLSX file:', error);
      throw new Error('Cannot read Excel file, please check the file format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      return this.processFromBuffer(buffer);
    } catch (error) {
      logger.error('Failed to read XLSX file from path:', error);
      throw error;
    }
  }

  /**
   * 清理Excel提取的文本
   */
  private cleanExcelText(text: string): string {
    return text
      // 移除多余空格
      .replace(/\s+/g, ' ')
      // 处理换行符
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 移除特殊字符但保留中文
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
  }
}

export const xlsxProcessor = new XlsxProcessor();
