import express from 'express';
import { Types } from 'mongoose';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import { 
  startQATrainingJob, 
  getQATrainingStatus, 
  cancelQATrainingJob,
  estimateQATrainingCost,
  generateQA
} from '@/jobs/qaTraining.js';
import { qaTrainingProcessor } from '@/core/dataset/training/qaTraining.js';
import { authMiddleware } from '@/middleware/auth.js';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { safeObjectId } from '@/utils/objectId.js';

const router = express.Router();

/**
 * 开始QA训练作业
 * POST /api/qa-training/start
 */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { 
      collectionId, 
      batchSize = 5,
      qaPrompt,
      agentModel = config.defaultLlmModel,
      vectorModel = 'text-embedding-v3'
    } = req.body;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Collection ID is required'
      });
    }

    // 验证集合存在
    const collection = await MongoDatasetCollection.findById(safeObjectId(collectionId));
    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // 开始QA训练
    const trainingId = await startQATrainingJob({
      collectionId,
      teamId: req.user?.teamId || 'system',
      tmbId: req.user?.tmbId || 'system',
      batchSize,
      qaPrompt,
      agentModel,
      vectorModel
    });

    logger.info(`QA training started: ${trainingId} for collection: ${collectionId}`);

    res.json({
      success: true,
      data: {
        trainingId,
        status: 'started',
        message: 'QA training job started successfully'
      }
    });

  } catch (error) {
    logger.error('Failed to start QA training:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取QA训练状态
 * GET /api/qa-training/status/:trainingId
 */
router.get('/status/:trainingId', authMiddleware, async (req, res) => {
  try {
    const { trainingId } = req.params;

    if (!Types.ObjectId.isValid(trainingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid training ID'
      });
    }

    const status = await getQATrainingStatus(trainingId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get QA training status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 取消QA训练作业
 * POST /api/qa-training/cancel/:trainingId
 */
router.post('/cancel/:trainingId', authMiddleware, async (req, res) => {
  try {
    const { trainingId } = req.params;

    if (!Types.ObjectId.isValid(trainingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid training ID'
      });
    }

    await cancelQATrainingJob(trainingId);

    logger.info(`QA training cancelled: ${trainingId}`);

    res.json({
      success: true,
      message: 'QA training job cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel QA training:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 估算QA训练成本
 * POST /api/qa-training/estimate
 */
router.post('/estimate', authMiddleware, async (req, res) => {
  try {
    const { collectionId } = req.body;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Collection ID is required'
      });
    }

    const estimate = await estimateQATrainingCost(collectionId);

    res.json({
      success: true,
      data: estimate
    });

  } catch (error) {
    logger.error('Failed to estimate QA training cost:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 手动触发QA训练队列
 * POST /api/qa-training/trigger-queue
 */
router.post('/trigger-queue', authMiddleware, async (req, res) => {
  try {
    // 触发QA训练队列
    generateQA();

    logger.info('QA training queue triggered manually');

    res.json({
      success: true,
      message: 'QA training queue triggered successfully'
    });

  } catch (error) {
    logger.error('Failed to trigger QA training queue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 验证QA训练请求
 * POST /api/qa-training/validate
 */
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { 
      text,
      datasetId,
      collectionId,
      teamId
    } = req.body;

    const validation = qaTrainingProcessor.validateQATrainingRequest({
      text,
      datasetId,
      collectionId,
      teamId: teamId || req.user?.teamId || 'system',
      tmbId: req.user?.tmbId || 'system',
      chunkIndex: 0
    });

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        error: validation.error
      }
    });

  } catch (error) {
    logger.error('Failed to validate QA training request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取QA训练统计信息
 * GET /api/qa-training/stats
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // 获取当前队列状态
    const queueLength = (global as any).qaQueueLen || 0;
    
    // 获取正在训练的集合数量
    const trainingCollections = await MongoDatasetCollection.countDocuments({
      status: 'training',
      trainingType: 'qa'
    });

    // 获取等待训练的集合数量
    const pendingCollections = await MongoDatasetCollection.countDocuments({
      status: 'pending',
      trainingType: 'qa'
    });

    res.json({
      success: true,
      data: {
        queueLength,
        trainingCollections,
        pendingCollections,
        maxConcurrency: 10
      }
    });

  } catch (error) {
    logger.error('Failed to get QA training stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 处理单个文本的QA生成（测试用）
 * POST /api/qa-training/generate-single
 */
router.post('/generate-single', authMiddleware, async (req, res) => {
  try {
    const {
      text,
      datasetId,
      collectionId,
      qaPrompt,
      agentModel = config.defaultLlmModel,
      vectorModel = 'text-embedding-v3'
    } = req.body;

    if (!text || !datasetId || !collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Text, dataset ID, and collection ID are required'
      });
    }

    const result = await qaTrainingProcessor.processQATraining({
      text,
      datasetId,
      collectionId,
      teamId: req.user?.teamId || 'system',
      tmbId: req.user?.tmbId || 'system',
      chunkIndex: 0,
      qaPrompt,
      agentModel,
      vectorModel
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to generate single QA:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
