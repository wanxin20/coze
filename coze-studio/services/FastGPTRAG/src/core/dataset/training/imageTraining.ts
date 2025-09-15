import { logger } from '../../../utils/logger.js';
import { vlmService, type ImageDescriptionResponse } from '../../vlm/index.js';
import { ImageType } from '../../file/types.js';

/**
 * 图片训练模式处理器 - 复刻FastGPT的图片训练功能
 * 支持 imageParse 和 image 两种训练模式
 */

export enum ImageTrainingMode {
  IMAGE = 'image', // 图片索引模式：为文档中的图片生成额外的检索索引
  IMAGE_PARSE = 'imageParse' // 图片解析模式：深度解析图片内容并生成详细描述
}

export interface ImageTrainingRequest {
  mode: ImageTrainingMode;
  imageList: ImageType[];
  vlmModel?: string;
  customPrompt?: string;
  datasetId: string;
  collectionId: string;
  chunkIndex: number;
}

export interface ImageTrainingResult {
  processedImages: number;
  generatedDescriptions: Array<{
    imageId: string;
    description: string;
    tokens: number;
  }>;
  imageDescMap: Record<string, string>;
  totalTokens: number;
  success: boolean;
  error?: string;
}

export class ImageTrainingProcessor {

  /**
   * 处理图片训练任务
   */
  async processImageTraining(request: ImageTrainingRequest): Promise<ImageTrainingResult> {
    const {
      mode,
      imageList,
      vlmModel,
      customPrompt,
      datasetId,
      collectionId,
      chunkIndex
    } = request;

    logger.info(`Starting image training: mode=${mode}, images=${imageList.length}, collection=${collectionId}`);

    try {
      if (imageList.length === 0) {
        return {
          processedImages: 0,
          generatedDescriptions: [],
          imageDescMap: {},
          totalTokens: 0,
          success: true
        };
      }

      const result: ImageTrainingResult = {
        processedImages: 0,
        generatedDescriptions: [],
        imageDescMap: {},
        totalTokens: 0,
        success: true
      };

      // 根据训练模式选择不同的处理策略
      switch (mode) {
        case ImageTrainingMode.IMAGE:
          await this.processImageIndexMode(imageList, vlmModel, result);
          break;
        case ImageTrainingMode.IMAGE_PARSE:
          await this.processImageParseMode(imageList, vlmModel, customPrompt, result);
          break;
        default:
          throw new Error(`Unsupported image training mode: ${mode}`);
      }

      logger.info(`Image training completed: ${result.processedImages}/${imageList.length} images processed, ${result.totalTokens} tokens used`);

      return result;

    } catch (error) {
      logger.error('Image training failed:', error);
      return {
        processedImages: 0,
        generatedDescriptions: [],
        imageDescMap: {},
        totalTokens: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 图片索引模式 - 为图片生成基础描述用于检索
   */
  private async processImageIndexMode(
    imageList: ImageType[],
    vlmModel: string | undefined,
    result: ImageTrainingResult
  ): Promise<void> {
    logger.info('Processing images in INDEX mode');

    const prompt = this.getImageIndexPrompt();

    // 批量处理图片以提高效率
    const batchSize = 3;
    for (let i = 0; i < imageList.length; i += batchSize) {
      const batch = imageList.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (image) => {
        try {
          const descResult = await vlmService.generateImageDescription({
            imageBase64: image.base64,
            imageMime: image.mime,
            prompt,
            model: vlmModel
          });

          result.generatedDescriptions.push({
            imageId: image.uuid,
            description: descResult.description,
            tokens: descResult.inputTokens + descResult.outputTokens
          });

          result.imageDescMap[image.uuid] = descResult.description;
          result.totalTokens += descResult.inputTokens + descResult.outputTokens;
          result.processedImages++;

          logger.debug(`Generated index description for image ${image.uuid}: ${descResult.description.substring(0, 100)}...`);

        } catch (error) {
          logger.warn(`Failed to process image ${image.uuid} in INDEX mode:`, error);
          // 为失败的图片提供默认描述
          const fallbackDesc = '图片内容';
          result.imageDescMap[image.uuid] = fallbackDesc;
          result.generatedDescriptions.push({
            imageId: image.uuid,
            description: fallbackDesc,
            tokens: 0
          });
        }
      });

      await Promise.all(batchPromises);

      // 添加延迟以避免API限制
      if (i + batchSize < imageList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * 图片解析模式 - 深度解析图片内容
   */
  private async processImageParseMode(
    imageList: ImageType[],
    vlmModel: string | undefined,
    customPrompt: string | undefined,
    result: ImageTrainingResult
  ): Promise<void> {
    logger.info('Processing images in PARSE mode');

    const prompt = customPrompt || this.getImageParsePrompt();

    // 逐个处理以获得更详细的分析
    for (const image of imageList) {
      try {
        const descResult = await vlmService.generateImageDescription({
          imageBase64: image.base64,
          imageMime: image.mime,
          prompt,
          model: vlmModel
        });

        // 对解析结果进行后处理
        const enhancedDescription = this.enhanceImageDescription(descResult.description);

        result.generatedDescriptions.push({
          imageId: image.uuid,
          description: enhancedDescription,
          tokens: descResult.inputTokens + descResult.outputTokens
        });

        result.imageDescMap[image.uuid] = enhancedDescription;
        result.totalTokens += descResult.inputTokens + descResult.outputTokens;
        result.processedImages++;

        logger.debug(`Generated detailed description for image ${image.uuid}: ${enhancedDescription.substring(0, 150)}...`);

        // 添加延迟以避免API限制
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        logger.warn(`Failed to process image ${image.uuid} in PARSE mode:`, error);
        // 为失败的图片提供默认描述
        const fallbackDesc = '图片解析失败，请检查图片格式或网络连接';
        result.imageDescMap[image.uuid] = fallbackDesc;
        result.generatedDescriptions.push({
          imageId: image.uuid,
          description: fallbackDesc,
          tokens: 0
        });
      }
    }
  }

  /**
   * 获取图片索引模式的提示词
   */
  private getImageIndexPrompt(): string {
    return `请简洁地描述这张图片的主要内容，用于搜索索引。包括：
1. 主要对象或主题
2. 重要的文字信息（如果有）
3. 图片类型（如图表、照片、截图等）
请用中文回答，保持简洁明了，50字以内。`;
  }

  /**
   * 获取图片解析模式的提示词
   */
  private getImageParsePrompt(): string {
    return `请详细分析这张图片的内容，提供全面的描述：

1. **主要内容**：描述图片的核心内容和主题
2. **视觉元素**：颜色、构图、风格等视觉特征
3. **文字信息**：准确识别并转录图片中的所有文字
4. **技术细节**：如果是图表、界面截图等，描述其结构和数据
5. **上下文信息**：推测图片的用途、来源或背景
6. **关键词**：提取5-10个最重要的关键词

请用中文回答，描述要详细准确，便于后续的信息检索和理解。`;
  }

  /**
   * 增强图片描述 - 添加结构化信息
   */
  private enhanceImageDescription(description: string): string {
    // 添加时间戳
    const timestamp = new Date().toISOString();
    
    // 提取关键词
    const keywords = this.extractKeywordsFromDescription(description);
    
    // 构建增强描述
    const enhanced = [
      description,
      '',
      `解析时间: ${timestamp}`,
      `关键词: ${keywords.join(', ')}`
    ].join('\n');

    return enhanced;
  }

  /**
   * 从描述中提取关键词
   */
  private extractKeywordsFromDescription(description: string): string[] {
    // 简化的关键词提取逻辑
    const stopWords = ['的', '是', '有', '在', '和', '与', '或', '但', '这', '那', '一个', '一些', '可以', '能够', '包括', '显示', '表示'];
    
    const words = description
      .replace(/[^\u4e00-\u9fff\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 8);

    return words;
  }

  /**
   * 估算图片训练成本
   */
  estimateTrainingCost(
    imageCount: number,
    mode: ImageTrainingMode,
    vlmModel?: string
  ): {
    estimatedTokens: number;
    estimatedCost: number;
    estimatedTime: number; // 秒
  } {
    let tokensPerImage: number;
    let timePerImage: number; // 秒

    switch (mode) {
      case ImageTrainingMode.IMAGE:
        tokensPerImage = 800; // 索引模式使用较少token
        timePerImage = 3;
        break;
      case ImageTrainingMode.IMAGE_PARSE:
        tokensPerImage = 1500; // 解析模式使用更多token
        timePerImage = 5;
        break;
      default:
        tokensPerImage = 1000;
        timePerImage = 4;
    }

    const cost = vlmService.estimateProcessingCost(imageCount, vlmModel);

    return {
      estimatedTokens: imageCount * tokensPerImage,
      estimatedCost: cost.estimatedCost,
      estimatedTime: imageCount * timePerImage
    };
  }

  /**
   * 验证图片训练请求
   */
  validateTrainingRequest(request: ImageTrainingRequest): { valid: boolean; error?: string } {
    if (!request.imageList || request.imageList.length === 0) {
      return { valid: false, error: 'No images provided for training' };
    }

    if (!Object.values(ImageTrainingMode).includes(request.mode)) {
      return { valid: false, error: `Invalid training mode: ${request.mode}` };
    }

    // 检查图片格式
    for (const image of request.imageList) {
      if (!vlmService.constructor.isSupportedImageFormat(image.mime)) {
        return { valid: false, error: `Unsupported image format: ${image.mime}` };
      }
    }

    return { valid: true };
  }
}

export const imageTrainingProcessor = new ImageTrainingProcessor();
