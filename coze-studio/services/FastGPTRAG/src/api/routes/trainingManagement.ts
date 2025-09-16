import express from 'express';
import { Types } from 'mongoose';
import { logger } from '@/utils/logger.js';
import { authMiddleware } from '@/middleware/auth.js';
import { 
  trainingTaskScheduler,
  TrainingTaskScheduler 
} from '@/core/dataset/training/taskScheduler.js';
import { 
  trainingProgressTracker,
  TrainingProgressTracker 
} from '@/core/dataset/training/progressTracker.js';
import { 
  MongoTrainingTask, 
  TrainingTaskStatus, 
  TrainingTaskPriority 
} from '@/core/dataset/training/schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { safeObjectId } from '@/utils/objectId.js';

const router = express.Router();

/**
 * 创建训练任务
 * POST /api/training/create
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      datasetId,
      collectionId,
      mode,
      priority = TrainingTaskPriority.NORMAL,
      config = {}
    } = req.body;

    if (!datasetId || !collectionId || !mode) {
      return res.status(400).json({
        success: false,
        error: 'Dataset ID, Collection ID, and mode are required'
      });
    }

    if (!Object.values(TrainingModeEnum).includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid training mode: ${mode}`
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

    // 创建训练任务
    const taskId = await trainingTaskScheduler.createTask({
      teamId: req.user?.teamId || 'system',
      tmbId: req.user?.tmbId || 'system',
      datasetId,
      collectionId,
      mode,
      priority,
      config
    });

    logger.info(`Training task created: ${taskId}`);

    res.json({
      success: true,
      data: {
        taskId,
        status: 'created',
        message: 'Training task created successfully'
      }
    });

  } catch (error) {
    logger.error('Failed to create training task:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取任务状态
 * GET /api/training/task/:taskId
 */
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID'
      });
    }

    const task = await MongoTrainingTask.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // 获取详细进度信息
    const progress = await trainingProgressTracker.getTaskProgress(taskId);

    res.json({
      success: true,
      data: {
        task,
        progress
      }
    });

  } catch (error) {
    logger.error('Failed to get task status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取集合训练进度
 * GET /api/training/collection/:collectionId/progress
 */
router.get('/collection/:collectionId/progress', authMiddleware, async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (!Types.ObjectId.isValid(collectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }

    const progress = await trainingProgressTracker.getCollectionProgress(collectionId);

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('Failed to get collection progress:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取团队训练进度
 * GET /api/training/team/progress
 */
router.get('/team/progress', authMiddleware, async (req, res) => {
  try {
    const teamId = req.user?.teamId || 'system';
    const progress = await trainingProgressTracker.getTeamProgress(teamId);

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('Failed to get team progress:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 取消训练任务
 * POST /api/training/task/:taskId/cancel
 */
router.post('/task/:taskId/cancel', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID'
      });
    }

    await trainingTaskScheduler.cancelTask(taskId);

    logger.info(`Training task cancelled: ${taskId}`);

    res.json({
      success: true,
      message: 'Training task cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel training task:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 重试失败的任务
 * POST /api/training/task/:taskId/retry
 */
router.post('/task/:taskId/retry', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID'
      });
    }

    const task = await MongoTrainingTask.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== TrainingTaskStatus.FAILED) {
      return res.status(400).json({
        success: false,
        error: 'Only failed tasks can be retried'
      });
    }

    // 重置任务状态
    await MongoTrainingTask.findByIdAndUpdate(taskId, {
      status: TrainingTaskStatus.PENDING,
      retryCount: 0,
      lastError: undefined,
      lockTime: new Date('2000/1/1')
    });

    logger.info(`Training task reset for retry: ${taskId}`);

    res.json({
      success: true,
      message: 'Training task reset for retry successfully'
    });

  } catch (error) {
    logger.error('Failed to retry training task:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取任务列表
 * GET /api/training/tasks
 */
router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      mode,
      collectionId,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    const filter: any = {
      teamId: safeObjectId(req.user?.teamId || 'system')
    };

    if (status) {
      filter.status = status;
    }

    if (mode) {
      filter.mode = mode;
    }

    if (collectionId) {
      filter.collectionId = safeObjectId(collectionId as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [tasks, total] = await Promise.all([
      MongoTrainingTask.find(filter)
        .sort(sort as string)
        .skip(skip)
        .limit(Number(limit))
        .populate('collectionId', 'name')
        .lean(),
      MongoTrainingTask.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get task list:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取实时统计
 * GET /api/training/stats
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [
      schedulerStatus,
      taskStats,
      realTimeStats
    ] = await Promise.all([
      trainingTaskScheduler.getStatus(),
      trainingTaskScheduler.getTaskStats(),
      trainingProgressTracker.getRealTimeStats()
    ]);

    res.json({
      success: true,
      data: {
        scheduler: schedulerStatus,
        taskStats,
        realTime: realTimeStats
      }
    });

  } catch (error) {
    logger.error('Failed to get training stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 更新任务进度（内部API）
 * POST /api/training/task/:taskId/progress
 */
router.post('/task/:taskId/progress', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completed, failed, total, customData } = req.body;

    if (!Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID'
      });
    }

    await trainingProgressTracker.updateTaskProgress(taskId, {
      completed,
      failed,
      total,
      customData
    });

    res.json({
      success: true,
      message: 'Task progress updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update task progress:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 批量操作任务
 * POST /api/training/batch
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { action, taskIds } = req.body;

    if (!action || !Array.isArray(taskIds)) {
      return res.status(400).json({
        success: false,
        error: 'Action and task IDs are required'
      });
    }

    const validTaskIds = taskIds.filter(id => Types.ObjectId.isValid(id));
    if (validTaskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid task IDs provided'
      });
    }

    let result;

    switch (action) {
      case 'cancel':
        result = await MongoTrainingTask.updateMany(
          { 
            _id: { $in: validTaskIds },
            status: { $in: [TrainingTaskStatus.PENDING, TrainingTaskStatus.RUNNING] }
          },
          { 
            status: TrainingTaskStatus.CANCELLED,
            completedAt: new Date()
          }
        );
        break;

      case 'retry':
        result = await MongoTrainingTask.updateMany(
          { 
            _id: { $in: validTaskIds },
            status: TrainingTaskStatus.FAILED
          },
          { 
            status: TrainingTaskStatus.PENDING,
            retryCount: 0,
            lastError: undefined,
            lockTime: new Date('2000/1/1')
          }
        );
        break;

      case 'delete':
        result = await MongoTrainingTask.deleteMany({
          _id: { $in: validTaskIds },
          status: { $in: [TrainingTaskStatus.COMPLETED, TrainingTaskStatus.FAILED, TrainingTaskStatus.CANCELLED] }
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported action: ${action}`
        });
    }

    const affectedCount = 'modifiedCount' in result ? result.modifiedCount : result.deletedCount;
    logger.info(`Batch ${action} operation completed: ${affectedCount} tasks affected`);

    res.json({
      success: true,
      data: {
        action,
        affected: affectedCount || 0
      }
    });

  } catch (error) {
    logger.error('Failed to perform batch operation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 启动/停止调度器
 * POST /api/training/scheduler/:action
 */
router.post('/scheduler/:action', authMiddleware, async (req, res) => {
  try {
    const { action } = req.params;
    const { intervalMs } = req.body;

    if (action === 'start') {
      await trainingTaskScheduler.start(intervalMs);
      trainingProgressTracker.start();
      
      logger.info('Training scheduler and progress tracker started');
      
      res.json({
        success: true,
        message: 'Training scheduler started successfully'
      });
    } else if (action === 'stop') {
      await trainingTaskScheduler.stop();
      trainingProgressTracker.stop();
      
      logger.info('Training scheduler and progress tracker stopped');
      
      res.json({
        success: true,
        message: 'Training scheduler stopped successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"'
      });
    }

  } catch (error) {
    logger.error('Failed to control scheduler:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
