import express from 'express';
import { logger } from '@/utils/logger.js';
import { authMiddleware } from '@/middleware/auth.js';
import { config } from '@/config/index.js';
import { 
  paragraphProcessor,
  ParagraphChunkAIModeEnum,
  type ParagraphProcessRequest 
} from '@/core/dataset/processing/paragraphProcessor.js';

const router = express.Router();

/**
 * LLM段落优化处理
 * POST /api/paragraph/optimize
 */
router.post('/optimize', authMiddleware, async (req, res) => {
  try {
    const {
      rawText,
      model = config.defaultLlmModel,
      paragraphChunkAIMode = ParagraphChunkAIModeEnum.enable,
      customPrompt,
      language = 'auto',
      preserveStructure = true
    } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Raw text is required and must be a string'
      });
    }

    if (rawText.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text too long (max 50,000 characters)'
      });
    }

    if (!Object.values(ParagraphChunkAIModeEnum).includes(paragraphChunkAIMode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid paragraph chunk AI mode: ${paragraphChunkAIMode}`
      });
    }

    const request: ParagraphProcessRequest = {
      rawText,
      model,
      paragraphChunkAIMode,
      customPrompt,
      language,
      preserveStructure
    };

    logger.info(`Processing paragraph optimization: ${rawText.length} chars, mode: ${paragraphChunkAIMode}`);

    const result = await paragraphProcessor.processLLMParagraph(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Paragraph optimization failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 智能文本清理
 * POST /api/paragraph/clean
 */
router.post('/clean', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      });
    }

    if (text.length > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Text too long (max 100,000 characters)'
      });
    }

    const startTime = Date.now();
    const originalLength = text.length;
    
    const cleanedText = paragraphProcessor.smartTextCleaning(text);
    const processingTime = Date.now() - startTime;

    logger.info(`Text cleaning completed: ${originalLength} -> ${cleanedText.length} chars in ${processingTime}ms`);

    res.json({
      success: true,
      data: {
        originalText: text,
        cleanedText,
        originalLength,
        cleanedLength: cleanedText.length,
        processingTime,
        reductionRatio: originalLength > 0 ? (originalLength - cleanedText.length) / originalLength : 0
      }
    });

  } catch (error) {
    logger.error('Text cleaning failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 估算处理成本
 * POST /api/paragraph/estimate
 */
router.post('/estimate', authMiddleware, async (req, res) => {
  try {
    const {
      textLength,
      paragraphChunkAIMode = ParagraphChunkAIModeEnum.enable
    } = req.body;

    if (typeof textLength !== 'number' || textLength <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Text length must be a positive number'
      });
    }

    if (!Object.values(ParagraphChunkAIModeEnum).includes(paragraphChunkAIMode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid paragraph chunk AI mode: ${paragraphChunkAIMode}`
      });
    }

    const estimate = paragraphProcessor.estimateProcessingCost(textLength, paragraphChunkAIMode);

    res.json({
      success: true,
      data: estimate
    });

  } catch (error) {
    logger.error('Cost estimation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 批量段落处理
 * POST /api/paragraph/batch
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const {
      texts,
      model = config.defaultLlmModel,
      paragraphChunkAIMode = ParagraphChunkAIModeEnum.enable,
      customPrompt,
      language = 'auto',
      preserveStructure = true
    } = req.body;

    if (!Array.isArray(texts)) {
      return res.status(400).json({
        success: false,
        error: 'Texts must be an array'
      });
    }

    if (texts.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 texts per batch'
      });
    }

    // 验证每个文本
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: `Text at index ${i} is invalid`
        });
      }
      if (text.length > 10000) {
        return res.status(400).json({
          success: false,
          error: `Text at index ${i} is too long (max 10,000 characters per text in batch)`
        });
      }
    }

    logger.info(`Processing batch paragraph optimization: ${texts.length} texts`);

    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const request: ParagraphProcessRequest = {
          rawText: texts[i],
          model,
          paragraphChunkAIMode,
          customPrompt,
          language,
          preserveStructure
        };

        const result = await paragraphProcessor.processLLMParagraph(request);
        results.push({
          index: i,
          success: true,
          result
        });

        // 添加延迟避免API限流
        if (i < texts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        logger.error(`Batch processing failed for text ${i}:`, error);
        results.push({
          index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info(`Batch processing completed: ${successCount} success, ${failureCount} failures`);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: texts.length,
          success: successCount,
          failures: failureCount
        }
      }
    });

  } catch (error) {
    logger.error('Batch paragraph processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 验证文本质量
 * POST /api/paragraph/validate
 */
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      });
    }

    // 使用内部方法验证文本质量
    const processor = paragraphProcessor as any;
    const validation = processor.validateTextQuality(text);

    // 检测语言
    const language = processor.detectLanguage(text);

    // 检查是否应该跳过自动处理
    const shouldSkipAuto = processor.shouldSkipAutoProcessing(text);

    res.json({
      success: true,
      data: {
        textLength: text.length,
        quality: validation,
        detectedLanguage: language,
        shouldSkipAutoProcessing: shouldSkipAuto,
        recommendations: generateRecommendations(text, validation, language)
      }
    });

  } catch (error) {
    logger.error('Text validation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取支持的处理模式
 * GET /api/paragraph/modes
 */
router.get('/modes', (req, res) => {
  res.json({
    success: true,
    data: {
      modes: Object.values(ParagraphChunkAIModeEnum).map(mode => ({
        value: mode,
        description: getModeDescription(mode)
      })),
      defaultMode: ParagraphChunkAIModeEnum.auto
    }
  });
});

/**
 * 获取处理统计
 * GET /api/paragraph/stats
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // 这里可以添加统计逻辑，比如从数据库获取处理历史
    res.json({
      success: true,
      data: {
        message: 'Statistics feature not implemented yet'
      }
    });

  } catch (error) {
    logger.error('Failed to get paragraph processing stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 生成处理建议
 */
function generateRecommendations(text: string, validation: any, language: string): string[] {
  const recommendations: string[] = [];

  if (validation.score < 70) {
    recommendations.push('文本质量较低，建议先进行基础清理');
  }

  if (text.length < 100) {
    recommendations.push('文本较短，可能不需要段落优化');
  } else if (text.length > 10000) {
    recommendations.push('文本较长，建议分段处理以提高效果');
  }

  if (validation.issues.includes('High content repetition')) {
    recommendations.push('检测到重复内容，建议先去重');
  }

  if (validation.issues.includes('Low readable character ratio')) {
    recommendations.push('包含较多特殊字符，建议先进行文本清理');
  }

  const paragraphCount = text.split(/\n\s*\n/).length;
  if (paragraphCount < 2) {
    recommendations.push('缺少段落分隔，建议启用段落优化');
  }

  if (language === 'zh') {
    recommendations.push('检测到中文内容，建议使用中文优化模式');
  }

  return recommendations;
}

/**
 * 获取模式描述
 */
function getModeDescription(mode: ParagraphChunkAIModeEnum): string {
  switch (mode) {
    case ParagraphChunkAIModeEnum.enable:
      return '启用AI段落优化，对所有文本进行优化处理';
    case ParagraphChunkAIModeEnum.disable:
      return '禁用AI段落优化，仅进行基础文本清理';
    case ParagraphChunkAIModeEnum.auto:
      return '自动模式，根据文本结构智能决定是否需要优化';
    case ParagraphChunkAIModeEnum.forbid:
      return '完全禁用处理，保持原文不变';
    default:
      return '未知模式';
  }
}

export default router;
