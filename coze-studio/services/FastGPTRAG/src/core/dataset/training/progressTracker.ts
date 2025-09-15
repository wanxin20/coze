import { logger } from '@/utils/logger.js';
import { MongoTrainingTask, TrainingTaskStatus, type TrainingTaskSchemaType } from './schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { EventEmitter } from 'events';

/**
 * 训练进度追踪器 - 提供实时进度监控和通知
 */
export class TrainingProgressTracker extends EventEmitter {
  private static instance: TrainingProgressTracker;
  private progressCache: Map<string, TrainingProgress> = new Map();
  private updateInterval?: NodeJS.Timeout;

  static getInstance(): TrainingProgressTracker {
    if (!TrainingProgressTracker.instance) {
      TrainingProgressTracker.instance = new TrainingProgressTracker();
    }
    return TrainingProgressTracker.instance;
  }

  /**
   * 启动进度追踪
   */
  start(intervalMs: number = 2000): void {
    if (this.updateInterval) {
      return;
    }

    this.updateInterval = setInterval(async () => {
      await this.updateProgressCache();
    }, intervalMs);

    logger.info(`Training progress tracker started with ${intervalMs}ms interval`);
  }

  /**
   * 停止进度追踪
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.progressCache.clear();
    logger.info('Training progress tracker stopped');
  }

  /**
   * 获取任务进度
   */
  async getTaskProgress(taskId: string): Promise<TrainingProgress | null> {
    try {
      // 先从缓存获取
      const cached = this.progressCache.get(taskId);
      if (cached) {
        return cached;
      }

      // 从数据库获取
      const task = await MongoTrainingTask.findById(taskId);
      if (!task) {
        return null;
      }

      const progress = this.convertTaskToProgress(task);
      this.progressCache.set(taskId, progress);
      
      return progress;
    } catch (error) {
      logger.error(`Failed to get task progress for ${taskId}:`, error);
      return null;
    }
  }

  /**
   * 获取集合的训练进度
   */
  async getCollectionProgress(collectionId: string): Promise<CollectionTrainingProgress> {
    try {
      const tasks = await MongoTrainingTask.find({ collectionId });
      
      const progress: CollectionTrainingProgress = {
        collectionId,
        totalTasks: tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        runningTasks: 0,
        pendingTasks: 0,
        cancelledTasks: 0,
        overallProgress: 0,
        tasks: [],
        estimatedTimeRemaining: 0,
        startedAt: null,
        completedAt: null
      };

      let totalProgress = 0;
      let earliestStart: Date | null = null;
      let latestCompletion: Date | null = null;

      for (const task of tasks) {
        const taskProgress = this.convertTaskToProgress(task);
        progress.tasks.push(taskProgress);
        
        totalProgress += taskProgress.progress.percentage;
        
        // 统计各状态任务数量
        switch (task.status) {
          case TrainingTaskStatus.COMPLETED:
            progress.completedTasks++;
            break;
          case TrainingTaskStatus.FAILED:
            progress.failedTasks++;
            break;
          case TrainingTaskStatus.RUNNING:
            progress.runningTasks++;
            break;
          case TrainingTaskStatus.PENDING:
            progress.pendingTasks++;
            break;
          case TrainingTaskStatus.CANCELLED:
            progress.cancelledTasks++;
            break;
        }

        // 计算时间范围
        if (task.startedAt) {
          if (!earliestStart || task.startedAt < earliestStart) {
            earliestStart = task.startedAt;
          }
        }
        
        if (task.completedAt) {
          if (!latestCompletion || task.completedAt > latestCompletion) {
            latestCompletion = task.completedAt;
          }
        }
      }

      // 计算整体进度
      if (tasks.length > 0) {
        progress.overallProgress = Math.round(totalProgress / tasks.length);
      }

      progress.startedAt = earliestStart;
      progress.completedAt = latestCompletion;

      // 估算剩余时间
      progress.estimatedTimeRemaining = this.estimateRemainingTime(progress);

      return progress;
    } catch (error) {
      logger.error(`Failed to get collection progress for ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * 获取团队的训练进度
   */
  async getTeamProgress(teamId: string): Promise<TeamTrainingProgress> {
    try {
      const tasks = await MongoTrainingTask.find({ teamId });
      
      const modeStats: Record<TrainingModeEnum, ModeStatistics> = {
        [TrainingModeEnum.chunk]: { total: 0, completed: 0, failed: 0, running: 0 },
        [TrainingModeEnum.qa]: { total: 0, completed: 0, failed: 0, running: 0 },
        [TrainingModeEnum.auto]: { total: 0, completed: 0, failed: 0, running: 0 },
        [TrainingModeEnum.image]: { total: 0, completed: 0, failed: 0, running: 0 },
        [TrainingModeEnum.imageParse]: { total: 0, completed: 0, failed: 0, running: 0 }
      };

      let totalTokens = 0;
      let totalExecutionTime = 0;

      for (const task of tasks) {
        const mode = task.mode;
        modeStats[mode].total++;

        switch (task.status) {
          case TrainingTaskStatus.COMPLETED:
            modeStats[mode].completed++;
            if (task.result) {
              totalTokens += task.result.totalTokens || 0;
              totalExecutionTime += task.result.executionTime || 0;
            }
            break;
          case TrainingTaskStatus.FAILED:
            modeStats[mode].failed++;
            break;
          case TrainingTaskStatus.RUNNING:
            modeStats[mode].running++;
            break;
        }
      }

      return {
        teamId,
        totalTasks: tasks.length,
        modeStatistics: modeStats,
        totalTokensUsed: totalTokens,
        totalExecutionTime,
        averageTaskTime: tasks.length > 0 ? totalExecutionTime / tasks.length : 0
      };
    } catch (error) {
      logger.error(`Failed to get team progress for ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: string, update: {
    completed?: number;
    failed?: number;
    total?: number;
    customData?: any;
  }): Promise<void> {
    try {
      const task = await MongoTrainingTask.findById(taskId);
      if (!task) {
        logger.warn(`Task ${taskId} not found for progress update`);
        return;
      }

      const newProgress = {
        total: update.total ?? task.progress.total,
        completed: update.completed ?? task.progress.completed,
        failed: update.failed ?? task.progress.failed,
        percentage: 0
      };

      if (newProgress.total > 0) {
        newProgress.percentage = Math.round(
          ((newProgress.completed + newProgress.failed) / newProgress.total) * 100
        );
      }

      await MongoTrainingTask.findByIdAndUpdate(taskId, {
        progress: newProgress,
        ...(update.customData && { customData: update.customData })
      });

      // 更新缓存
      const updatedTask = await MongoTrainingTask.findById(taskId);
      if (updatedTask) {
        const progress = this.convertTaskToProgress(updatedTask);
        this.progressCache.set(taskId, progress);
        
        // 发送进度更新事件
        this.emit('progressUpdate', {
          taskId,
          progress,
          update
        });
      }

      logger.debug(`Updated progress for task ${taskId}: ${newProgress.percentage}%`);
    } catch (error) {
      logger.error(`Failed to update task progress for ${taskId}:`, error);
    }
  }

  /**
   * 批量更新进度
   */
  async batchUpdateProgress(updates: Array<{
    taskId: string;
    completed?: number;
    failed?: number;
    total?: number;
  }>): Promise<void> {
    try {
      const bulkOps = [];
      
      for (const update of updates) {
        const task = await MongoTrainingTask.findById(update.taskId);
        if (!task) continue;

        const newProgress = {
          total: update.total ?? task.progress.total,
          completed: update.completed ?? task.progress.completed,
          failed: update.failed ?? task.progress.failed,
          percentage: 0
        };

        if (newProgress.total > 0) {
          newProgress.percentage = Math.round(
            ((newProgress.completed + newProgress.failed) / newProgress.total) * 100
          );
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: update.taskId },
            update: { progress: newProgress }
          }
        });
      }

      if (bulkOps.length > 0) {
        await MongoTrainingTask.bulkWrite(bulkOps);
        logger.debug(`Batch updated progress for ${bulkOps.length} tasks`);
      }
    } catch (error) {
      logger.error('Failed to batch update progress:', error);
    }
  }

  /**
   * 获取实时统计
   */
  async getRealTimeStats(): Promise<RealTimeStats> {
    try {
      const stats = await MongoTrainingTask.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const modeStats = await MongoTrainingTask.aggregate([
        {
          $group: {
            _id: '$mode',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusCounts: Record<string, number> = {};
      const modeCounts: Record<string, number> = {};

      for (const stat of stats) {
        statusCounts[stat._id] = stat.count;
      }

      for (const stat of modeStats) {
        modeCounts[stat._id] = stat.count;
      }

      return {
        totalTasks: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        statusCounts,
        modeCounts,
        queueLength: statusCounts[TrainingTaskStatus.PENDING] || 0,
        runningTasks: statusCounts[TrainingTaskStatus.RUNNING] || 0,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get real-time stats:', error);
      throw error;
    }
  }

  /**
   * 更新进度缓存
   */
  private async updateProgressCache(): Promise<void> {
    try {
      const runningTasks = await MongoTrainingTask.find({
        status: { $in: [TrainingTaskStatus.RUNNING, TrainingTaskStatus.RETRYING] }
      });

      for (const task of runningTasks) {
        const progress = this.convertTaskToProgress(task);
        this.progressCache.set(task._id.toString(), progress);
      }

      // 清理已完成任务的缓存
      const completedTaskIds = Array.from(this.progressCache.keys()).filter(taskId => {
        const progress = this.progressCache.get(taskId);
        return progress && [
          TrainingTaskStatus.COMPLETED,
          TrainingTaskStatus.FAILED,
          TrainingTaskStatus.CANCELLED
        ].includes(progress.status as TrainingTaskStatus);
      });

      for (const taskId of completedTaskIds) {
        this.progressCache.delete(taskId);
      }

    } catch (error) {
      logger.error('Failed to update progress cache:', error);
    }
  }

  /**
   * 转换任务为进度对象
   */
  private convertTaskToProgress(task: TrainingTaskSchemaType): TrainingProgress {
    return {
      taskId: task._id.toString(),
      teamId: task.teamId.toString(),
      datasetId: task.datasetId.toString(),
      collectionId: task.collectionId.toString(),
      mode: task.mode,
      status: task.status,
      priority: task.priority,
      progress: {
        total: task.progress.total,
        completed: task.progress.completed,
        failed: task.progress.failed,
        percentage: task.progress.percentage
      },
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt || null,
      completedAt: task.completedAt || null,
      executionTime: task.result?.executionTime || null,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      lastError: task.lastError || null,
      result: task.result || null
    };
  }

  /**
   * 估算剩余时间
   */
  private estimateRemainingTime(collectionProgress: CollectionTrainingProgress): number {
    const { completedTasks, runningTasks, pendingTasks, tasks } = collectionProgress;
    
    if (completedTasks === 0) {
      return 0; // 无法估算
    }

    // 计算平均完成时间
    const completedTasksData = tasks.filter(t => 
      t.status === TrainingTaskStatus.COMPLETED && t.executionTime
    );

    if (completedTasksData.length === 0) {
      return 0;
    }

    const averageTime = completedTasksData.reduce((sum, task) => 
      sum + (task.executionTime || 0), 0
    ) / completedTasksData.length;

    // 估算剩余时间 = (运行中任务数 + 待处理任务数) * 平均完成时间
    return (runningTasks + pendingTasks) * averageTime;
  }
}

// 接口定义
export interface TrainingProgress {
  taskId: string;
  teamId: string;
  datasetId: string;
  collectionId: string;
  mode: TrainingModeEnum;
  status: TrainingTaskStatus;
  priority: number;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  executionTime: number | null;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  result: any;
}

export interface CollectionTrainingProgress {
  collectionId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  cancelledTasks: number;
  overallProgress: number;
  tasks: TrainingProgress[];
  estimatedTimeRemaining: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface TeamTrainingProgress {
  teamId: string;
  totalTasks: number;
  modeStatistics: Record<TrainingModeEnum, ModeStatistics>;
  totalTokensUsed: number;
  totalExecutionTime: number;
  averageTaskTime: number;
}

export interface ModeStatistics {
  total: number;
  completed: number;
  failed: number;
  running: number;
}

export interface RealTimeStats {
  totalTasks: number;
  statusCounts: Record<string, number>;
  modeCounts: Record<string, number>;
  queueLength: number;
  runningTasks: number;
  timestamp: Date;
}

// 导出单例
export const trainingProgressTracker = TrainingProgressTracker.getInstance();
