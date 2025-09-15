import express from 'express';
import multer from 'multer';
import { imageProcessor } from '@/core/file/processors/image.js';
import { imageTrainingProcessor, ImageTrainingMode } from '@/core/dataset/training/imageTraining.js';
import { vlmService } from '@/core/vlm/index.js';
import { logger } from '@/utils/logger.js';
import { authMiddleware } from '@/middleware/auth.js';

const router = express.Router();

// 配置multer用于图片上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image format'));
    }
  }
});

/**
 * POST /api/image/process
 * 处理单个图片文件
 */
router.post('/process', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const {
      generateDescription = 'true',
      vlmModel,
      customPrompt
    } = req.body;

    const result = await imageProcessor.processFromBuffer(req.file.buffer, {
      filename: req.file.originalname,
      generateDescription: generateDescription === 'true',
      vlmModel,
      customPrompt
    });

    logger.info(`Image processed: ${req.file.originalname}, ${result.rawText.length} chars`);

    res.json({
      success: true,
      data: {
        rawText: result.rawText,
        imageList: result.imageList,
        metadata: result.metadata
      }
    });

  } catch (error) {
    logger.error('Image processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Image processing failed'
    });
  }
});

/**
 * POST /api/image/batch-process
 * 批量处理图片文件
 */
router.post('/batch-process', authMiddleware, upload.array('images', 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    const {
      generateDescription = 'true',
      vlmModel,
      customPrompt,
      concurrency = '3'
    } = req.body;

    const images = files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname
    }));

    const result = await imageProcessor.processBatchImages(images, {
      generateDescription: generateDescription === 'true',
      vlmModel,
      customPrompt,
      concurrency: parseInt(concurrency)
    });

    logger.info(`Batch processed: ${files.length} images, ${result.rawText.length} chars`);

    res.json({
      success: true,
      data: {
        rawText: result.rawText,
        imageList: result.imageList,
        metadata: result.metadata
      }
    });

  } catch (error) {
    logger.error('Batch image processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch image processing failed'
    });
  }
});

/**
 * POST /api/image/train
 * 图片训练接口
 */
router.post('/train', authMiddleware, async (req, res) => {
  try {
    const {
      mode,
      imageList,
      vlmModel,
      customPrompt,
      datasetId,
      collectionId,
      chunkIndex
    } = req.body;

    // 验证请求参数
    if (!mode || !imageList || !datasetId || !collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: mode, imageList, datasetId, collectionId'
      });
    }

    // 验证训练模式
    if (!Object.values(ImageTrainingMode).includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid training mode: ${mode}`
      });
    }

    const trainingRequest = {
      mode,
      imageList,
      vlmModel,
      customPrompt,
      datasetId,
      collectionId,
      chunkIndex: chunkIndex || 0
    };

    // 验证请求
    const validation = imageTrainingProcessor.validateTrainingRequest(trainingRequest);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // 执行训练
    const result = await imageTrainingProcessor.processImageTraining(trainingRequest);

    logger.info(`Image training completed: mode=${mode}, processed=${result.processedImages}/${imageList.length}, tokens=${result.totalTokens}`);

    res.json({
      success: result.success,
      data: result,
      error: result.error
    });

  } catch (error) {
    logger.error('Image training failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Image training failed'
    });
  }
});

/**
 * GET /api/image/vlm-models
 * 获取可用的VLM模型列表
 */
router.get('/vlm-models', authMiddleware, async (req, res) => {
  try {
    const models = vlmService.getAvailableModels();
    const modelConfigs = models.map(modelName => {
      const config = vlmService.getModelConfig(modelName);
      return {
        name: modelName,
        displayName: config?.name || modelName,
        provider: config?.provider,
        vision: config?.vision || false
      };
    });

    res.json({
      success: true,
      data: {
        models: modelConfigs,
        defaultModel: models[0] || null
      }
    });

  } catch (error) {
    logger.error('Failed to get VLM models:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get VLM models'
    });
  }
});

/**
 * POST /api/image/estimate-cost
 * 估算图片处理成本
 */
router.post('/estimate-cost', authMiddleware, async (req, res) => {
  try {
    const { imageCount, mode, vlmModel } = req.body;

    if (!imageCount || !mode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: imageCount, mode'
      });
    }

    const cost = imageTrainingProcessor.estimateTrainingCost(
      parseInt(imageCount),
      mode,
      vlmModel
    );

    res.json({
      success: true,
      data: cost
    });

  } catch (error) {
    logger.error('Cost estimation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Cost estimation failed'
    });
  }
});

/**
 * POST /api/image/generate-description
 * 为单张图片生成描述
 */
router.post('/generate-description', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const { vlmModel, customPrompt } = req.body;
    const base64 = req.file.buffer.toString('base64');

    const result = await vlmService.generateImageDescription({
      imageBase64: base64,
      imageMime: req.file.mimetype,
      prompt: customPrompt,
      model: vlmModel
    });

    logger.info(`Generated description for image: ${req.file.originalname}`);

    res.json({
      success: true,
      data: {
        description: result.description,
        model: result.model,
        tokens: {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.inputTokens + result.outputTokens
        }
      }
    });

  } catch (error) {
    logger.error('Description generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Description generation failed'
    });
  }
});

/**
 * GET /api/image/supported-formats
 * 获取支持的图片格式
 */
router.get('/supported-formats', (req, res) => {
  try {
    const formats = imageProcessor.constructor.getSupportedFormats();
    
    res.json({
      success: true,
      data: {
        formats,
        mimeTypes: [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp'
        ]
      }
    });

  } catch (error) {
    logger.error('Failed to get supported formats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported formats'
    });
  }
});

export default router;
