import { logger } from '../../../utils/logger.js';
import { FileProcessResult, ImageType } from '../types.js';
import { vlmService } from '../../vlm/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

/**
 * 图片文件处理器 - 复刻FastGPT的图片解析功能
 * 支持图片内容识别和描述生成，用于图片数据集构建
 */
export class ImageProcessor {

  async processFromBuffer(buffer: Buffer, options?: {
    filename?: string;
    generateDescription?: boolean;
    vlmModel?: string;
    customPrompt?: string;
  }): Promise<FileProcessResult> {
    try {
      logger.info('Starting image processing');
      
      const {
        filename = 'image',
        generateDescription = true,
        vlmModel,
        customPrompt
      } = options || {};

      // 检测图片格式
      const mimeType = this.detectImageMimeType(buffer, filename);
      if (!mimeType) {
        throw new Error('Unsupported image format');
      }

      // 验证图片格式是否支持VLM
      if (generateDescription && !vlmService.constructor.isSupportedImageFormat(mimeType)) {
        logger.warn(`Image format ${mimeType} not supported for VLM processing`);
      }

      // 转换为Base64
      const base64 = buffer.toString('base64');
      const uuid = uuidv4();

      // 创建图片对象
      const imageItem: ImageType = {
        uuid,
        base64,
        mime: mimeType
      };

      let description = '';
      let imageDescMap: Record<string, string> = {};

      // 使用VLM生成图片描述
      if (generateDescription && vlmService.constructor.isSupportedImageFormat(mimeType)) {
        try {
          const descResult = await vlmService.generateImageDescription({
            imageBase64: base64,
            imageMime: mimeType,
            prompt: customPrompt || this.getDefaultImagePrompt(),
            model: vlmModel
          });
          
          description = descResult.description;
          imageDescMap[uuid] = description;
          
          logger.info(`Generated image description: ${description.substring(0, 100)}...`);
        } catch (error) {
          logger.warn('Failed to generate image description:', error);
          description = `图片文件: ${filename}`;
          imageDescMap[uuid] = description;
        }
      } else {
        description = `图片文件: ${filename}`;
        imageDescMap[uuid] = description;
      }

      // 构建可搜索的文本内容
      const rawText = this.buildSearchableText(filename, description, mimeType);

      logger.info(`Image processed successfully: ${rawText.length} characters`);

      return {
        rawText,
        imageList: [imageItem],
        metadata: {
          format: 'image',
          mimeType,
          imageCount: 1,
          contentLength: rawText.length,
          filename,
          hasVLMDescription: !!description && description !== `图片文件: ${filename}`,
          imageDescMap
        }
      };
    } catch (error) {
      logger.error('Failed to process image file:', error);
      throw new Error(`Cannot process image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processFromPath(filePath: string, options?: {
    generateDescription?: boolean;
    vlmModel?: string;
    customPrompt?: string;
  }): Promise<FileProcessResult> {
    try {
      const buffer = await fs.promises.readFile(filePath);
      const filename = filePath.split('/').pop() || 'image';
      
      return this.processFromBuffer(buffer, {
        ...options,
        filename
      });
    } catch (error) {
      logger.error('Failed to read image file from path:', error);
      throw error;
    }
  }

  /**
   * 批量处理图片集合
   */
  async processBatchImages(
    images: Array<{ buffer: Buffer; filename: string }>,
    options?: {
      generateDescription?: boolean;
      vlmModel?: string;
      customPrompt?: string;
      concurrency?: number;
    }
  ): Promise<FileProcessResult> {
    const {
      generateDescription = true,
      vlmModel,
      customPrompt,
      concurrency = 3
    } = options || {};

    logger.info(`Processing batch of ${images.length} images`);

    const imageList: ImageType[] = [];
    const imageDescMap: Record<string, string> = {};
    const textParts: string[] = [];

    // 准备图片数据
    const imageData = images.map(({ buffer, filename }) => {
      const mimeType = this.detectImageMimeType(buffer, filename);
      if (!mimeType) {
        logger.warn(`Skipping unsupported image: ${filename}`);
        return null;
      }

      const uuid = uuidv4();
      const base64 = buffer.toString('base64');

      imageList.push({
        uuid,
        base64,
        mime: mimeType
      });

      return {
        id: uuid,
        base64,
        mime: mimeType,
        filename
      };
    }).filter(Boolean);

    // 批量生成描述
    if (generateDescription && imageData.length > 0) {
      try {
        const descriptions = await vlmService.batchGenerateImageDescriptions(
          imageData,
          customPrompt || this.getDefaultImagePrompt(),
          vlmModel,
          concurrency
        );

        descriptions.forEach(({ id, description, error }, index) => {
          const filename = imageData[index]?.filename || 'image';
          if (error) {
            logger.warn(`Failed to describe image ${filename}: ${error}`);
            imageDescMap[id] = `图片文件: ${filename}`;
          } else {
            imageDescMap[id] = description || `图片文件: ${filename}`;
          }
        });
      } catch (error) {
        logger.warn('Batch image description failed:', error);
        // 回退到默认描述
        imageData.forEach(({ id, filename }) => {
          imageDescMap[id] = `图片文件: ${filename}`;
        });
      }
    }

    // 构建文本内容
    imageList.forEach((image) => {
      const description = imageDescMap[image.uuid] || '图片内容';
      const filename = imageData.find(d => d.id === image.uuid)?.filename || 'image';
      textParts.push(this.buildSearchableText(filename, description, image.mime));
    });

    const rawText = textParts.join('\n\n');

    logger.info(`Batch image processing completed: ${imageList.length} images, ${rawText.length} characters`);

    return {
      rawText,
      imageList,
      metadata: {
        format: 'image_batch',
        imageCount: imageList.length,
        contentLength: rawText.length,
        hasVLMDescription: Object.values(imageDescMap).some(desc => !desc.startsWith('图片文件:')),
        imageDescMap
      }
    };
  }

  /**
   * 检测图片MIME类型
   */
  private detectImageMimeType(buffer: Buffer, filename?: string): string | null {
    // 通过文件头检测
    if (buffer.length < 8) return null;

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return 'image/png';
    }

    // GIF
    if (buffer.subarray(0, 6).equals(Buffer.from('GIF87a')) || 
        buffer.subarray(0, 6).equals(Buffer.from('GIF89a'))) {
      return 'image/gif';
    }

    // WebP
    if (buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && 
        buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) {
      return 'image/webp';
    }

    // BMP
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return 'image/bmp';
    }

    // 通过文件扩展名回退检测
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'bmp':
          return 'image/bmp';
      }
    }

    return null;
  }

  /**
   * 获取默认的图片描述提示词
   */
  private getDefaultImagePrompt(): string {
    return `请详细描述这张图片的内容，包括：
1. 主要对象和场景
2. 图片中的文字信息（如果有）
3. 颜色、构图等视觉特征
4. 图片可能的用途或含义
请用中文回答，描述要准确详细，便于后续检索。`;
  }

  /**
   * 构建可搜索的文本内容
   */
  private buildSearchableText(filename: string, description: string, mimeType: string): string {
    const parts = [
      `图片文件: ${filename}`,
      `文件类型: ${mimeType}`,
      `图片描述: ${description}`
    ];

    // 如果描述包含有用信息，添加更多上下文
    if (description && !description.startsWith('图片文件:')) {
      parts.push(`内容关键词: ${this.extractKeywords(description)}`);
    }

    return parts.join('\n');
  }

  /**
   * 从描述中提取关键词
   */
  private extractKeywords(description: string): string {
    // 简单的关键词提取逻辑
    const commonWords = ['的', '是', '有', '在', '和', '与', '或', '但', '这', '那', '一个', '一些', '可以', '能够'];
    
    return description
      .replace(/[^\u4e00-\u9fff\w\s]/g, ' ') // 保留中文、英文和数字
      .split(/\s+/)
      .filter(word => word.length > 1 && !commonWords.includes(word))
      .slice(0, 10) // 取前10个关键词
      .join(', ');
  }

  /**
   * 验证图片文件
   */
  static isValidImageFile(buffer: Buffer, filename?: string): boolean {
    const processor = new ImageProcessor();
    return processor.detectImageMimeType(buffer, filename) !== null;
  }

  /**
   * 获取支持的图片格式
   */
  static getSupportedFormats(): string[] {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  }
}

export const imageProcessor = new ImageProcessor();
