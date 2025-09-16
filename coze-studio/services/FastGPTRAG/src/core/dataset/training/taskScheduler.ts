import { logger } from '@/utils/logger.js';
import { 
  MongoTrainingTask, 
  TrainingTaskStatus, 
  TrainingTaskPriority,
  type TrainingTaskSchemaType 
} from './schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { Types } from 'mongoose';
import { addMinutes, addSeconds } from 'date-fns';

/**
 * 训练任务调度器 - 复现FastGPT的完整调度逻辑
 * 支持优先级调度、负载均衡、错误重试、进度追踪
 */
export class TrainingTaskScheduler {
  private static instance: TrainingTaskScheduler;
  private isRunning = false;
  private schedulerInterval?: NodeJS.Timeout;
  private readonly maxConcurrentTasks: Record<TrainingModeEnum, number> = {
    [TrainingModeEnum.chunk]: 15,
    [TrainingModeEnum.qa]: 10,
    [TrainingModeEnum.auto]: 8,
    [TrainingModeEnum.image]: 5,
    [TrainingModeEnum.imageParse]: 3
  };

  // 当前运行的任务计数
  private runningTasks: Record<TrainingModeEnum, number> = {
    [TrainingModeEnum.chunk]: 0,
    [TrainingModeEnum.qa]: 0,
    [TrainingModeEnum.auto]: 0,
    [TrainingModeEnum.image]: 0,
    [TrainingModeEnum.imageParse]: 0
  };

  static getInstance(): TrainingTaskScheduler {
    if (!TrainingTaskScheduler.instance) {
      TrainingTaskScheduler.instance = new TrainingTaskScheduler();
    }
    return TrainingTaskScheduler.instance;
  }

  /**
   * 启动任务调度器
   */
  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      logger.warn('Training task scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting training task scheduler');

    // 清理遗留的锁定任务
    await this.cleanupStaleTasks();

    // 启动调度循环
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.scheduleNextTasks();
      } catch (error) {
        logger.error('Error in scheduler loop:', error);
      }
    }, intervalMs);

    logger.info(`Training task scheduler started with ${intervalMs}ms interval`);
  }

  /**
   * 停止任务调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }

    logger.info('Training task scheduler stopped');
  }

  /**
   * 创建训练任务
   */
  async createTask(params: {
    teamId: string;
    tmbId: string;
    datasetId: string;
    collectionId: string;
    mode: TrainingModeEnum;
    priority?: TrainingTaskPriority;
    config?: any;
    data?: any;
  }): Promise<string> {
    const {
      teamId,
      tmbId,
      datasetId,
      collectionId,
      mode,
      priority = TrainingTaskPriority.NORMAL,
      config = {},
      data = {}
    } = params;

    try {
      const task = new MongoTrainingTask({
        teamId: new Types.ObjectId(teamId),
        tmbId: new Types.ObjectId(tmbId),
        datasetId: new Types.ObjectId(datasetId),
        collectionId: new Types.ObjectId(collectionId),
        mode,
        priority,
        config,
        ...data,
        status: TrainingTaskStatus.PENDING,
        progress: {
          total: data.total || 1,
          completed: 0,
          failed: 0,
          percentage: 0
        }
      });

      await task.save();
      
      logger.info(`Created training task: ${task._id}, mode: ${mode}, priority: ${priority}`);
      return task._id.toString();

    } catch (error) {
      logger.error('Failed to create training task:', error);
      throw error;
    }
  }

  /**
   * 调度下一批任务
   */
  private async scheduleNextTasks(): Promise<void> {
    try {
      // 更新运行任务计数
      await this.updateRunningTaskCounts();

      // 为每种训练模式调度任务
      for (const mode of Object.values(TrainingModeEnum)) {
        const availableSlots = this.maxConcurrentTasks[mode] - this.runningTasks[mode];
        
        if (availableSlots > 0) {
          await this.scheduleTasksForMode(mode, availableSlots);
        }
      }

      // 处理重试任务
      await this.handleRetryTasks();

      // 清理过期任务
      await this.cleanupExpiredTasks();

    } catch (error) {
      logger.error('Error in scheduleNextTasks:', error);
    }
  }

  /**
   * 为特定模式调度任务
   */
  private async scheduleTasksForMode(mode: TrainingModeEnum, maxTasks: number): Promise<void> {
    try {
      // 按优先级和创建时间查找待处理任务
      const tasks = await MongoTrainingTask.find({
        mode,
        status: TrainingTaskStatus.PENDING,
        lockTime: { $lte: addMinutes(new Date(), -5) } // 5分钟前的锁定任务可以重新调度
      })
      .sort({ priority: -1, createdAt: 1 })
      .limit(maxTasks);

      for (const task of tasks) {
        try {
          await this.startTask(task);
        } catch (error) {
          logger.error(`Failed to start task ${task._id}:`, error);
          await this.markTaskFailed(task._id.toString(), error instanceof Error ? error.message : 'Unknown error');
        }
      }

    } catch (error) {
      logger.error(`Error scheduling tasks for mode ${mode}:`, error);
    }
  }

  /**
   * 启动单个任务
   */
  private async startTask(task: TrainingTaskSchemaType): Promise<void> {
    const taskId = task._id.toString();
    
    try {
      // 锁定任务
      const updatedTask = await MongoTrainingTask.findOneAndUpdate(
        { 
          _id: task._id,
          status: TrainingTaskStatus.PENDING 
        },
        {
          status: TrainingTaskStatus.RUNNING,
          startedAt: new Date(),
          lockTime: new Date(),
          $inc: { retryCount: 1 }
        },
        { new: true }
      );

      if (!updatedTask) {
        logger.warn(`Task ${taskId} was already taken by another process`);
        return;
      }

      logger.info(`Starting task ${taskId}, mode: ${task.mode}`);
      this.runningTasks[task.mode]++;

      // 根据训练模式执行不同的处理逻辑
      this.executeTask(updatedTask);

    } catch (error) {
      logger.error(`Failed to start task ${taskId}:`, error);
      await this.markTaskFailed(taskId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: TrainingTaskSchemaType): Promise<void> {
    const taskId = task._id.toString();
    const startTime = Date.now();

    try {
      let result;

      switch (task.mode) {
        case TrainingModeEnum.qa:
          result = await this.executeQATraining(task);
          break;
        case TrainingModeEnum.chunk:
          result = await this.executeChunkTraining(task);
          break;
        case TrainingModeEnum.auto:
          result = await this.executeAutoTraining(task);
          break;
        case TrainingModeEnum.image:
          result = await this.executeImageTraining(task);
          break;
        case TrainingModeEnum.imageParse:
          result = await this.executeImageParseTraining(task);
          break;
        default:
          throw new Error(`Unsupported training mode: ${task.mode}`);
      }

      const executionTime = Date.now() - startTime;

      // 标记任务完成
      await this.markTaskCompleted(taskId, {
        ...result,
        executionTime
      });

    } catch (error) {
      logger.error(`Task ${taskId} execution failed:`, error);
      await this.handleTaskError(task, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.runningTasks[task.mode]--;
    }
  }

  /**
   * 执行QA训练
   */
  private async executeQATraining(task: TrainingTaskSchemaType): Promise<any> {
    const { startQATrainingJob } = await import('@/jobs/qaTraining.js');
    
    return await startQATrainingJob({
      collectionId: task.collectionId.toString(),
      teamId: task.teamId.toString(),
      tmbId: task.tmbId.toString(),
      batchSize: task.config?.batchSize || 5,
      qaPrompt: task.config?.qaPrompt,
      agentModel: task.config?.agentModel,
      vectorModel: task.config?.vectorModel
    });
  }

  /**
   * 执行向量训练
   */
  private async executeChunkTraining(task: TrainingTaskSchemaType): Promise<any> {
    const { startTrainingJob } = await import('@/jobs/newTraining.js');
    
    return await startTrainingJob({
      collectionId: task.collectionId.toString(),
      teamId: task.teamId.toString(),
      tmbId: task.tmbId.toString(),
      mode: TrainingModeEnum.chunk,
      batchSize: task.config?.batchSize || 10
    });
  }

  /**
   * 执行自动训练
   */
  private async executeAutoTraining(task: TrainingTaskSchemaType): Promise<any> {
    const { startTrainingJob } = await import('@/jobs/newTraining.js');
    
    return await startTrainingJob({
      collectionId: task.collectionId.toString(),
      teamId: task.teamId.toString(),
      tmbId: task.tmbId.toString(),
      mode: TrainingModeEnum.auto,
      batchSize: task.config?.batchSize || 8
    });
  }

  /**
   * 执行图片训练
   */
  private async executeImageTraining(task: TrainingTaskSchemaType): Promise<any> {
    const { imageTrainingProcessor } = await import('./imageTraining.js');
    
    return await imageTrainingProcessor.processImageTraining({
      mode: 'image' as any,
      imageList: [], // 需要从任务数据中获取
      vlmModel: task.config?.vlmModel,
      datasetId: task.datasetId.toString(),
      collectionId: task.collectionId.toString(),
      chunkIndex: task.chunkIndex || 0
    });
  }

  /**
   * 执行图片解析训练
   */
  private async executeImageParseTraining(task: TrainingTaskSchemaType): Promise<any> {
    const { imageTrainingProcessor } = await import('./imageTraining.js');
    
    return await imageTrainingProcessor.processImageTraining({
      mode: 'imageParse' as any,
      imageList: [], // 需要从任务数据中获取
      vlmModel: task.config?.vlmModel,
      datasetId: task.datasetId.toString(),
      collectionId: task.collectionId.toString(),
      chunkIndex: task.chunkIndex || 0
    });
  }

  /**
   * 处理任务错误
   */
  private async handleTaskError(task: TrainingTaskSchemaType, error: string): Promise<void> {
    const taskId = task._id.toString();
    
    if (task.retryCount < task.maxRetries) {
      // 标记为重试状态
      await MongoTrainingTask.findByIdAndUpdate(task._id, {
        status: TrainingTaskStatus.RETRYING,
        lastError: error,
        lockTime: addMinutes(new Date(), -10) // 10分钟后可以重试
      });
      
      logger.info(`Task ${taskId} will be retried (${task.retryCount}/${task.maxRetries})`);
    } else {
      // 重试次数耗尽，标记为失败
      await this.markTaskFailed(taskId, `Max retries exceeded. Last error: ${error}`);
    }
  }

  /**
   * 处理重试任务
   */
  private async handleRetryTasks(): Promise<void> {
    try {
      // 查找需要重试的任务
      const retryTasks = await MongoTrainingTask.find({
        status: TrainingTaskStatus.RETRYING,
        lockTime: { $lte: addMinutes(new Date(), -10) }, // 10分钟前的重试任务
        retryCount: { $lt: 3 } // 还有重试机会
      }).limit(10);

      for (const task of retryTasks) {
        // 重置为待处理状态
        await MongoTrainingTask.findByIdAndUpdate(task._id, {
          status: TrainingTaskStatus.PENDING,
          lockTime: new Date('2000/1/1')
        });
        
        logger.info(`Reset task ${task._id} for retry`);
      }

    } catch (error) {
      logger.error('Error handling retry tasks:', error);
    }
  }

  /**
   * 更新运行任务计数
   */
  private async updateRunningTaskCounts(): Promise<void> {
    try {
      const counts = await MongoTrainingTask.aggregate([
        {
          $match: {
            status: TrainingTaskStatus.RUNNING
          }
        },
        {
          $group: {
            _id: '$mode',
            count: { $sum: 1 }
          }
        }
      ]);

      // 重置计数
      for (const mode of Object.values(TrainingModeEnum)) {
        this.runningTasks[mode] = 0;
      }

      // 更新计数
      for (const item of counts) {
        const mode = item._id as TrainingModeEnum;
        if (mode in this.runningTasks) {
          this.runningTasks[mode] = item.count;
        }
      }

    } catch (error) {
      logger.error('Error updating running task counts:', error);
    }
  }

  /**
   * 标记任务完成
   */
  async markTaskCompleted(taskId: string, result: any): Promise<void> {
    try {
      await MongoTrainingTask.findByIdAndUpdate(taskId, {
        status: TrainingTaskStatus.COMPLETED,
        completedAt: new Date(),
        result,
        progress: {
          total: result.total || 1,
          completed: result.total || 1,
          failed: 0,
          percentage: 100
        }
      });

      logger.info(`Task ${taskId} completed successfully`);
    } catch (error) {
      logger.error(`Failed to mark task ${taskId} as completed:`, error);
    }
  }

  /**
   * 标记任务失败
   */
  async markTaskFailed(taskId: string, error: string): Promise<void> {
    try {
      await MongoTrainingTask.findByIdAndUpdate(taskId, {
        status: TrainingTaskStatus.FAILED,
        completedAt: new Date(),
        lastError: error
      });

      logger.error(`Task ${taskId} failed: ${error}`);
    } catch (err) {
      logger.error(`Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: string, progress: {
    completed?: number;
    failed?: number;
    total?: number;
  }): Promise<void> {
    try {
      const task = await MongoTrainingTask.findById(taskId);
      if (!task) return;

      const newProgress = {
        total: progress.total ?? task.progress.total,
        completed: progress.completed ?? task.progress.completed,
        failed: progress.failed ?? task.progress.failed,
        percentage: 0
      };

      if (newProgress.total > 0) {
        newProgress.percentage = Math.round((newProgress.completed / newProgress.total) * 100);
      }

      await MongoTrainingTask.findByIdAndUpdate(taskId, {
        progress: newProgress
      });

    } catch (error) {
      logger.error(`Failed to update task progress for ${taskId}:`, error);
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      await MongoTrainingTask.findByIdAndUpdate(taskId, {
        status: TrainingTaskStatus.CANCELLED,
        completedAt: new Date()
      });

      logger.info(`Task ${taskId} cancelled`);
    } catch (error) {
      logger.error(`Failed to cancel task ${taskId}:`, error);
    }
  }

  /**
   * 清理过期任务
   */
  private async cleanupExpiredTasks(): Promise<void> {
    try {
      const result = await MongoTrainingTask.deleteMany({
        expireAt: { $lt: new Date() }
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired tasks`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired tasks:', error);
    }
  }

  /**
   * 清理遗留的锁定任务
   */
  private async cleanupStaleTasks(): Promise<void> {
    try {
      const result = await MongoTrainingTask.updateMany(
        {
          status: TrainingTaskStatus.RUNNING,
          lockTime: { $lt: addMinutes(new Date(), -30) } // 30分钟前的运行任务
        },
        {
          status: TrainingTaskStatus.PENDING,
          lockTime: new Date('2000/1/1')
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Reset ${result.modifiedCount} stale running tasks`);
      }
    } catch (error) {
      logger.error('Error cleaning up stale tasks:', error);
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      runningTasks: { ...this.runningTasks },
      maxConcurrentTasks: { ...this.maxConcurrentTasks }
    };
  }

  /**
   * 获取任务统计
   */
  async getTaskStats() {
    try {
      const stats = await MongoTrainingTask.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result: Record<string, number> = {};
      for (const stat of stats) {
        result[stat._id] = stat.count;
      }

      return result;
    } catch (error) {
      logger.error('Error getting task stats:', error);
      return {};
    }
  }
}

// 导出单例
export const trainingTaskScheduler = TrainingTaskScheduler.getInstance();
