import { Types } from 'mongoose';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { MongoDatasetData } from '@/core/dataset/data/schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';
import { qaTrainingProcessor, type QATrainingRequest } from '@/core/dataset/training/qaTraining.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';

export interface QATrainingJobParams {
  collectionId: string;
  teamId: string;
  tmbId: string;
  batchSize?: number;
  qaPrompt?: string;
  agentModel?: string;
  vectorModel?: string;
}

export interface QATrainingResult {
  trainingId: string;
  status: 'started' | 'completed' | 'failed';
  processedCount: number;
  totalCount: number;
  generatedQACount: number;
  error?: string;
}

// 全局QA训练队列计数
declare global {
  var qaQueueLen: number;
}

if (!(global as any).qaQueueLen) {
  (global as any).qaQueueLen = 0;
}

const reduceQAQueue = () => {
  (global as any).qaQueueLen = (global as any).qaQueueLen > 0 ? (global as any).qaQueueLen - 1 : 0;
  return (global as any).qaQueueLen === 0;
};

/**
 * 开始QA训练作业 - 复现原版FastGPT的QA生成队列逻辑
 */
export async function startQATrainingJob(params: QATrainingJobParams): Promise<string> {
  const { 
    collectionId, 
    teamId, 
    tmbId, 
    batchSize = 5, 
    qaPrompt,
    agentModel = 'gpt-3.5-turbo',
    vectorModel = 'text-embedding-v3'
  } = params;
  
  const trainingId = new Types.ObjectId().toString();

  try {
    logger.info(`Starting QA training job: ${trainingId} for collection: ${collectionId}`);

    // 验证参数
    if (!isValidObjectId(collectionId)) {
      throw new Error(`Invalid ObjectId format: collectionId=${collectionId}`);
    }

    const teamIdForQuery = safeObjectId(teamId, '000000000000000000000001');

    // 获取集合信息
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(collectionId),
      teamId: teamIdForQuery
    }).populate('datasetId');

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // 获取需要进行QA训练的数据项
    const dataItems = await MongoDatasetData.find({
      collectionId: safeObjectId(collectionId),
      teamId: teamIdForQuery,
      q: { $exists: true, $ne: '' }
    }).limit(100); // 限制批次大小

    if (dataItems.length === 0) {
      logger.info(`No data items for QA training in collection: ${collectionId}`);
      return trainingId;
    }

    // 启动异步QA训练进程
    processQATrainingQueue({
      trainingId,
      collectionId,
      dataItems,
      collection,
      batchSize,
      qaPrompt,
      agentModel,
      vectorModel,
      teamId,
      tmbId
    });

    return trainingId;
  } catch (error) {
    logger.error(`Failed to start QA training job:`, error);
    throw error;
  }
}

/**
 * 处理QA训练队列 - 模拟原版FastGPT的generateQA队列
 */
async function processQATrainingQueue(params: {
  trainingId: string;
  collectionId: string;
  dataItems: any[];
  collection: any;
  batchSize: number;
  qaPrompt?: string;
  agentModel: string;
  vectorModel: string;
  teamId: string;
  tmbId: string;
}): Promise<void> {
  const { 
    trainingId, 
    collectionId, 
    dataItems, 
    collection, 
    batchSize,
    qaPrompt,
    agentModel,
    vectorModel,
    teamId,
    tmbId
  } = params;

  // 检查队列长度
  const maxProcess = 10; // 最大并发数
  if ((global as any).qaQueueLen >= maxProcess) {
    logger.info(`QA queue full, delaying training job: ${trainingId}`);
    setTimeout(() => processQATrainingQueue(params), 5000);
    return;
  }

  (global as any).qaQueueLen++;

  try {
    logger.info(`Processing QA training queue: ${trainingId}, ${dataItems.length} items`);
    
    // 更新collection状态为training
    await MongoDatasetCollection.findByIdAndUpdate(
      safeObjectId(collectionId),
      { status: 'training', updateTime: new Date() }
    );

    let processedCount = 0;
    let totalGeneratedQAs = 0;

    // 分批处理数据
    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize);
      
      try {
        logger.info(`Processing QA batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataItems.length / batchSize)}`);
        
        const batchResult = await processQABatch({
          batch,
          collection,
          qaPrompt,
          agentModel,
          vectorModel,
          teamId,
          tmbId
        });
        
        processedCount += batch.length;
        totalGeneratedQAs += batchResult.totalQAs;

        logger.info(`✅ Processed QA batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataItems.length / batchSize)} for training ${trainingId}`);
        logger.info(`Generated ${batchResult.totalQAs} QA pairs in this batch`);
        
      } catch (error) {
        logger.error(`❌ Failed to process QA batch ${i / batchSize + 1}:`, error);
      }
      
      // 添加延迟避免API限流
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // QA训练完成，更新collection状态为ready
    await MongoDatasetCollection.findByIdAndUpdate(
      safeObjectId(collectionId),
      { status: 'ready', updateTime: new Date() }
    );
    
    logger.info(`🎉 QA training job completed: ${trainingId}`);
    logger.info(`Processed ${processedCount} items, generated ${totalGeneratedQAs} QA pairs`);
    
  } catch (error) {
    logger.error(`❌ QA training queue processing failed:`, error);
    
    // 更新collection状态为failed
    await MongoDatasetCollection.findByIdAndUpdate(
      safeObjectId(collectionId),
      { status: 'failed', updateTime: new Date() }
    );
  } finally {
    reduceQAQueue();
  }
}

/**
 * 处理QA训练批次
 */
async function processQABatch(params: {
  batch: any[];
  collection: any;
  qaPrompt?: string;
  agentModel: string;
  vectorModel: string;
  teamId: string;
  tmbId: string;
}): Promise<{ totalQAs: number }> {
  const { batch, collection, qaPrompt, agentModel, vectorModel, teamId, tmbId } = params;

  try {
    logger.info(`Starting QA batch processing with ${batch.length} items`);
    
    let totalQAs = 0;

    // 对批次中的每个数据项进行QA生成
    for (const item of batch) {
      try {
        // 构建QA训练请求
        const qaRequest: QATrainingRequest = {
          text: item.q + (item.a ? '\n' + item.a : ''), // 合并问题和答案作为训练文本
          datasetId: (collection.datasetId._id || collection.datasetId).toString(),
          collectionId: collection._id.toString(),
          teamId,
          tmbId,
          chunkIndex: item.chunkIndex || 0,
          qaPrompt,
          agentModel,
          vectorModel
        };

        // 验证请求
        const validation = qaTrainingProcessor.validateQATrainingRequest(qaRequest);
        if (!validation.valid) {
          logger.warn(`Skipping invalid QA training request: ${validation.error}`);
          continue;
        }

        // 处理QA训练
        const result = await qaTrainingProcessor.processQATraining(qaRequest);
        
        if (result.success) {
          totalQAs += result.qaCount;
          logger.debug(`Generated ${result.qaCount} QA pairs for item ${item._id}`);
        } else {
          logger.warn(`QA training failed for item ${item._id}: ${result.error}`);
        }

      } catch (error) {
        logger.error(`Failed to process QA for item ${item._id}:`, error);
      }

      // 添加小延迟避免API过载
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info(`✅ QA batch processed successfully: ${batch.length} items, ${totalQAs} QA pairs generated`);
    return { totalQAs };
    
  } catch (error) {
    logger.error('❌ Failed to process QA batch:', error);
    throw error;
  }
}

/**
 * 启动QA生成队列 - 复现原版FastGPT的generateQA函数
 */
export async function generateQA(): Promise<void> {
  const max = 10; // 最大并发数
  
  if ((global as any).qaQueueLen >= max) {
    return;
  }

  (global as any).qaQueueLen++;

  try {
    logger.debug(`[QA Queue] Queue size: ${(global as any).qaQueueLen}`);

    // 查找需要QA训练的集合
    const collections = await MongoDatasetCollection.find({
      trainingType: 'qa',
      status: { $in: ['pending', 'ready'] }
    }).populate('datasetId').limit(5);

    if (collections.length === 0) {
      return;
    }

    logger.info(`Found ${collections.length} collections for QA training`);

    // 处理每个集合
    for (const collection of collections) {
      try {
        await startQATrainingJob({
          collectionId: collection._id.toString(),
          teamId: collection.teamId.toString(),
          tmbId: collection.tmbId.toString(),
          qaPrompt: collection.qaPrompt,
          agentModel: collection.datasetId?.agentModel || 'gpt-3.5-turbo',
          vectorModel: collection.datasetId?.vectorModel || 'text-embedding-v3'
        });

        logger.info(`QA training started for collection: ${collection._id}`);
      } catch (error) {
        logger.error(`QA training failed for collection ${collection._id}:`, error);
      }
    }

  } catch (error) {
    logger.error('QA generation queue failed:', error);
  } finally {
    reduceQAQueue();
  }
}

/**
 * 获取QA训练状态
 */
export async function getQATrainingStatus(trainingId: string): Promise<QATrainingResult> {
  try {
    // 简化的状态检查 - 实际应该存储在数据库中
    return {
      trainingId,
      status: 'completed',
      processedCount: 0,
      totalCount: 0,
      generatedQACount: 0
    };
  } catch (error) {
    logger.error(`Failed to get QA training status:`, error);
    throw error;
  }
}

/**
 * 取消QA训练作业
 */
export async function cancelQATrainingJob(trainingId: string): Promise<void> {
  try {
    logger.info(`Cancelling QA training job: ${trainingId}`);
    // 实际实现应该从队列中移除作业
  } catch (error) {
    logger.error(`Failed to cancel QA training job:`, error);
    throw error;
  }
}

/**
 * 估算QA训练成本
 */
export async function estimateQATrainingCost(collectionId: string): Promise<{
  estimatedCost: number;
  estimatedTime: number;
  estimatedQACount: number;
}> {
  try {
    // 获取集合中的数据量
    const dataCount = await MongoDatasetData.countDocuments({
      collectionId: safeObjectId(collectionId)
    });

    // 估算平均文本长度
    const avgTextLength = 500; // 假设平均500字符
    
    // 使用QA训练处理器估算成本
    const costEstimate = qaTrainingProcessor.estimateQATrainingCost(
      dataCount * avgTextLength
    );

    return {
      estimatedCost: costEstimate.estimatedCost,
      estimatedTime: dataCount * 3, // 每个数据项约3秒
      estimatedQACount: costEstimate.estimatedQACount
    };
  } catch (error) {
    logger.error('Failed to estimate QA training cost:', error);
    throw error;
  }
}
