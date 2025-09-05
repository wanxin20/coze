import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
import { logger } from '../../../utils/logger.js';
import { FileProcessResult, ImageType } from '../types.js';

/**
 * PDF文件处理器 - 完全复刻FastGPT-2的实现
 * 使用pdfjs-dist legacy版本进行PDF处理
 */

type TokenType = {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
};

export class PdfProcessor {

  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    try {
      logger.info('Starting PDF processing with pdfjs legacy');
      
      const rawText = await this.readPdfFile(buffer);
      
      logger.info(`PDF processed successfully: ${rawText.length} characters`);

      return {
        rawText,
        imageList: [],
        metadata: {
          format: 'pdf',
          contentLength: rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process PDF file:', error);
      throw new Error('Cannot read PDF file, please check the file format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      return this.processFromBuffer(buffer);
    } catch (error) {
      logger.error('Failed to read PDF file from path:', error);
      throw error;
    }
  }

  /**
   * 完全复刻FastGPT-2的PDF读取逻辑
   */
  private async readPdfFile(buffer: Buffer): Promise<string> {
    const readPDFPage = async (doc: any, pageNo: number) => {
      try {
        const page = await doc.getPage(pageNo);
        const tokenizedText = await page.getTextContent();
        
        logger.info(`Page ${pageNo}: Found ${tokenizedText.items.length} text items`);

        const viewport = page.getViewport({ scale: 1 });
        const pageHeight = viewport.height;
        const headerThreshold = pageHeight * 0.95;
        const footerThreshold = pageHeight * 0.05;

        const pageTexts: TokenType[] = tokenizedText.items.filter((token: TokenType) => {
          return (
            !token.transform ||
            (token.transform[5] < headerThreshold && token.transform[5] > footerThreshold)
          );
        });

        // concat empty string 'hasEOL'
        for (let i = 0; i < pageTexts.length; i++) {
          const item = pageTexts[i];
          if (item.str === '' && pageTexts[i - 1]) {
            pageTexts[i - 1].hasEOL = item.hasEOL;
            pageTexts.splice(i, 1);
            i--;
          }
        }

        page.cleanup();

        const pageText = pageTexts
          .map((token) => {
            const paragraphEnd = token.hasEOL && /([。？！.?!\n\r]|(\r\n))$/.test(token.str);

            return paragraphEnd ? `${token.str}\n` : token.str;
          })
          .join('');
          
        logger.info(`Page ${pageNo}: Extracted text length: ${pageText.length}, preview: "${pageText.substring(0, 100)}..."`);
        return pageText;
      } catch (error) {
        logger.error('PDF page read error:', error);
        return '';
      }
    };

    // Create a completely new ArrayBuffer to avoid SharedArrayBuffer transferList issues
    const uint8Array = new Uint8Array(buffer.byteLength);
    uint8Array.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    
    // Configure pdfjs with proper character mapping support
    const loadingTask = pdfjs.getDocument({ 
      data: uint8Array,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      enableXfa: false,
      verbosity: 0 // Reduce verbose warnings
    });
    const doc = await loadingTask.promise;

    const pageArr = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const result = (
      await Promise.all(pageArr.map(async (page) => await readPDFPage(doc, page)))
    ).join('');

    loadingTask.destroy();

    return result;
  }
}

export const pdfProcessor = new PdfProcessor();
