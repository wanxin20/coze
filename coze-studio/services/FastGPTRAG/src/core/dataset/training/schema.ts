import { Schema, model, Types } from 'mongoose';
import { TrainingModeEnum } from '@/types/dataset.js';

/**
 * 训练任务状态枚举
 */
export enum TrainingTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

/**
 * 训练任务优先级
 */
export enum TrainingTaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * 训练任务接口
 */
export interface TrainingTaskSchemaType {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  tmbId: Types.ObjectId;
  datasetId: Types.ObjectId;
  collectionId: Types.ObjectId;
  mode: TrainingModeEnum;
  
  // 任务状态管理
  status: TrainingTaskStatus;
  priority: TrainingTaskPriority;
  
  // 重试机制
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  
  // 时间管理
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  lockTime: Date;
  expireAt: Date;
  
  // 进度追踪
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  
  // 训练数据
  q?: string;
  a?: string;
  imageId?: string;
  imageDescMap?: Record<string, string>;
  chunkIndex: number;
  indexSize?: number;
  weight: number;
  dataId?: Types.ObjectId;
  indexes: Array<{
    type: 'summary' | 'custom';
    text: string;
  }>;
  
  // 配置参数
  config?: {
    qaPrompt?: string;
    agentModel?: string;
    vectorModel?: string;
    vlmModel?: string;
    batchSize?: number;
  };
  
  // 结果统计
  result?: {
    processedCount: number;
    generatedQACount: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    executionTime: number;
  };
  
  // 计费信息
  billId?: string;
}

/**
 * 训练任务Schema
 */
const TrainingTaskSchema = new Schema<TrainingTaskSchemaType>({
  teamId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  tmbId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  datasetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  collectionId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  mode: {
    type: String,
    enum: Object.values(TrainingModeEnum),
    required: true,
    index: true
  },
  
  // 任务状态管理
  status: {
    type: String,
    enum: Object.values(TrainingTaskStatus),
    default: TrainingTaskStatus.PENDING,
    index: true
  },
  priority: {
    type: Number,
    enum: Object.values(TrainingTaskPriority),
    default: TrainingTaskPriority.NORMAL,
    index: true
  },
  
  // 重试机制
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  lastError: {
    type: String
  },
  
  // 时间管理
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  lockTime: {
    type: Date,
    default: () => new Date('2000/1/1'),
    index: true
  },
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
    index: { expireAfterSeconds: 0 }
  },
  
  // 进度追踪
  progress: {
    total: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  
  // 训练数据
  q: {
    type: String,
    default: ''
  },
  a: {
    type: String,
    default: ''
  },
  imageId: {
    type: String
  },
  imageDescMap: {
    type: Schema.Types.Mixed
  },
  chunkIndex: {
    type: Number,
    default: 0
  },
  indexSize: {
    type: Number
  },
  weight: {
    type: Number,
    default: 0
  },
  dataId: {
    type: Schema.Types.ObjectId
  },
  indexes: {
    type: [{
      type: {
        type: String,
        enum: ['summary', 'custom']
      },
      text: {
        type: String
      }
    }],
    default: []
  },
  
  // 配置参数
  config: {
    qaPrompt: String,
    agentModel: String,
    vectorModel: String,
    vlmModel: String,
    batchSize: Number
  },
  
  // 结果统计
  result: {
    processedCount: {
      type: Number,
      default: 0
    },
    generatedQACount: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    inputTokens: {
      type: Number,
      default: 0
    },
    outputTokens: {
      type: Number,
      default: 0
    },
    executionTime: {
      type: Number,
      default: 0
    }
  },
  
  // 计费信息
  billId: {
    type: String
  }
});

// 索引优化
TrainingTaskSchema.index({ status: 1, priority: -1, createdAt: 1 }); // 任务调度
TrainingTaskSchema.index({ mode: 1, status: 1 }); // 按模式和状态查询
TrainingTaskSchema.index({ lockTime: 1, retryCount: 1 }); // 重试查询
TrainingTaskSchema.index({ teamId: 1, status: 1 }); // 团队任务查询

// 更新时间中间件
TrainingTaskSchema.pre('save', function() {
  this.updatedAt = new Date();
});

TrainingTaskSchema.pre(['updateOne', 'findOneAndUpdate'], function() {
  this.set({ updatedAt: new Date() });
});

export const MongoTrainingTask = model<TrainingTaskSchemaType>('TrainingTask', TrainingTaskSchema);
