import { logger } from '../../../utils/logger.js';
import { FileProcessResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import decompress from 'decompress';
import { DOMParser } from '@xmldom/xmldom';
import { v4 as uuidv4 } from 'uuid';

/**
 * PPTX文件处理器 - 完全复刻FastGPT-2的实现
 * 解压PPTX文件并提取幻灯片文本内容
 */
export class PptxProcessor {
  private readonly tempDir = '/tmp';

  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    try {
      logger.info('Starting PPTX processing');
      
      const rawText = await this.parsePowerPoint(buffer);
      
      logger.info(`PPTX processed successfully: ${rawText.length} characters`);

      return {
        rawText,
        imageList: [],
        metadata: {
          format: 'pptx',
          contentLength: rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process PPTX file:', error);
      throw new Error('Cannot read PPTX file, please check the file format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return this.processFromBuffer(buffer);
    } catch (error) {
      logger.error('Failed to read PPTX file from path:', error);
      throw error;
    }
  }

  /**
   * 解析PowerPoint文件 - 完全复刻FastGPT-2逻辑
   */
  private async parsePowerPoint(buffer: Buffer): Promise<string> {
    // 文件正则表达式，用于匹配我们感兴趣的内容
    const allFilesRegex = /ppt\/(notesSlides|slides)\/(notesSlide|slide)\d+.xml/g;
    const slidesRegex = /ppt\/slides\/slide\d+.xml/g;

    // 创建临时目录
    const tempSubDir = path.join(this.tempDir, uuidv4());
    if (!fs.existsSync(tempSubDir)) {
      fs.mkdirSync(tempSubDir, { recursive: true });
    }

    // 创建临时文件
    const tempFilePath = path.join(tempSubDir, `${uuidv4()}.pptx`);
    const decompressPath = path.join(tempSubDir, 'extracted');

    try {
      // 写入临时文件
      fs.writeFileSync(tempFilePath, buffer);

      // 解压文件
      const files = await decompress(tempFilePath, decompressPath, {
        filter: (file: any) => !!file.path.match(allFilesRegex)
      });

      // 验证是否至少存在幻灯片XML文件
      if (
        files.length === 0 ||
        !files.map((file: any) => file.path).some((filename: string) => filename.match(slidesRegex))
      ) {
        throw new Error('解析 PPTX 失败：未找到有效的幻灯片内容');
      }

      // 读取所有XML内容
      const xmlContentArray = await Promise.all(
        files.map(async (file: any) => {
          try {
            return await fs.promises.readFile(
              path.join(decompressPath, file.path),
              'utf-8'
            );
          } catch (err) {
            logger.warn(`Failed to read file ${file.path}, trying with utf-8:`, err);
            return await fs.promises.readFile(
              path.join(decompressPath, file.path),
              'utf-8'
            );
          }
        })
      );

      const responseArr: string[] = [];

      xmlContentArray.forEach((xmlContent: string) => {
        // 查找带有 a:p 标签的文本节点
        const xmlParagraphNodesList = this.parseString(xmlContent).getElementsByTagName('a:p');

        // 存储所有文本内容
        responseArr.push(
          Array.from(xmlParagraphNodesList)
            // 过滤没有任何文本节点的段落节点（通过 a:t 标签标识）
            .filter((paragraphNode: any) => paragraphNode.getElementsByTagName('a:t').length !== 0)
            .map((paragraphNode: any) => {
              // 查找带有 a:t 标签的文本节点
              const xmlTextNodeList = paragraphNode.getElementsByTagName('a:t');
              return Array.from(xmlTextNodeList)
                .filter((textNode: any) => textNode.childNodes[0] && textNode.childNodes[0].nodeValue)
                .map((textNode: any) => textNode.childNodes[0].nodeValue)
                .join('');
            })
            .join('\n')
        );
      });

      return responseArr.join('\n');
    } finally {
      // 清理临时文件和目录
      this.cleanupTempFiles(tempSubDir);
    }
  }

  /**
   * 解析XML字符串
   */
  private parseString(xml: string) {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'text/xml');
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFiles(dirPath: string) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp files:', error);
    }
  }
}

export const pptxProcessor = new PptxProcessor();
