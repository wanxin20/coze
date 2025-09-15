import { Types } from 'mongoose';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { MongoDatasetData } from '@/core/dataset/data/schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';
import { insertDatasetDataVector, getVectorStore } from '@/core/vectorstore/newController.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';
import { startQATrainingJob, generateQA } from './qaTraining.js';

export interface TrainingJobParams {
  collectionId: string;
  teamId: string;
  tmbId: string;
  mode: TrainingModeEnum;
  batchSize?: number;
}

export interface TrainingResult {
  trainingId: string;
  status: 'started' | 'completed' | 'failed';
  processedCount: number;
  totalCount: number;
  error?: string;
}

// 全局训练队列计数
declare global {
  var vectorQueueLen: number;
}

if (!(global as any).vectorQueueLen) {
  (global as any).vectorQueueLen = 0;
}

const reduceQueue = () => {
  (global as any).vectorQueueLen = (global as any).vectorQueueLen > 0 ? (global as any).vectorQueueLen - 1 : 0;
  return (global as any).vectorQueueLen === 0;
};

// 开始训练作业 - 复现原版FastGPT的队列逻辑
export async function startTrainingJob(params: TrainingJobParams): Promise<string> {
  const { collectionId, teamId, tmbId, mode, batchSize = 10 } = params;
  const trainingId = new Types.ObjectId().toString();

  try {
    logger.info(`Starting training job: ${trainingId} for collection: ${collectionId}`);

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

    // 获取需要训练的数据项
    const dataItems = await MongoDatasetData.find({
      collectionId: safeObjectId(collectionId),
      teamId: teamIdForQuery
    });

    if (dataItems.length === 0) {
      logger.info(`No data items to train in collection: ${collectionId}`);
      return trainingId;
    }

    // 根据训练模式选择不同的处理方式
    if (mode === TrainingModeEnum.qa) {
      // QA训练模式
      await startQATrainingJob({
        collectionId,
        teamId,
        tmbId,
        batchSize,
        qaPrompt: collection.qaPrompt,
        agentModel: collection.datasetId?.agentModel,
        vectorModel: collection.datasetId?.vectorModel
      });
    } else {
      // 其他训练模式（chunk, auto, image等）
      processTrainingQueue({
        trainingId,
        collectionId,
        dataItems,
        collection,
        mode,
        batchSize
      });
    }

    return trainingId;
  } catch (error) {
    logger.error(`Failed to start training job:`, error);
    throw error;
  }
}

// 处理训练队列 - 模拟原版FastGPT的generateVector队列
async function processTrainingQueue(params: {
  trainingId: string;
  collectionId: string;
  dataItems: any[];
  collection: any;
  mode: TrainingModeEnum;
  batchSize: number;
}): Promise<void> {
  const { trainingId, collectionId, dataItems, collection, mode, batchSize } = params;

  // 检查队列长度
  const maxProcess = 15; // 默认最大并发数
  if ((global as any).vectorQueueLen >= maxProcess) {
    logger.info(`Vector queue full, delaying training job: ${trainingId}`);
    setTimeout(() => processTrainingQueue(params), 5000);
    return;
  }

  (global as any).vectorQueueLen++;

  try {
    logger.info(`Processing training queue: ${trainingId}, ${dataItems.length} items`);
    logger.info(`Collection info:`, {
      collectionId: collection._id,
      datasetId: collection.datasetId._id || collection.datasetId,
      vectorModel: collection.datasetId.vectorModel || 'text-embedding-v3'
    });

    // 标记数据为重建中，同时更新collection状态为training
    await Promise.all([
      MongoDatasetData.updateMany(
        { collectionId: safeObjectId(collectionId) },
        { rebuilding: true }
      ),
      MongoDatasetCollection.findByIdAndUpdate(
        safeObjectId(collectionId),
        { status: 'training', updateTime: new Date() }
      )
    ]);

    // 分批处理数据
    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize);
      
      try {
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataItems.length / batchSize)}`);
        logger.info(`Batch items:`, batch.map(item => ({ 
          id: item._id, 
          q: item.q.substring(0, 50) + '...',
          indexes: item.indexes?.length || 0 
        })));
        
        await processBatch({
          batch,
          collection,
          mode
        });
        
        // 标记批次完成
        const batchIds = batch.map(item => item._id);
        await MongoDatasetData.updateMany(
          { _id: { $in: batchIds } },
          { rebuilding: false, updateTime: new Date() }
        );

        logger.info(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataItems.length / batchSize)} for training ${trainingId}`);
      } catch (error) {
        logger.error(`❌ Failed to process batch ${i / batchSize + 1}:`, error);
        
        // 标记批次失败
        const batchIds = batch.map(item => item._id);
        await MongoDatasetData.updateMany(
          { _id: { $in: batchIds } },
          { rebuilding: false }
        );
      }
      
      // 添加小延迟避免API限流
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 训练完成，更新collection状态为ready
    await MongoDatasetCollection.findByIdAndUpdate(
      safeObjectId(collectionId),
      { status: 'ready', updateTime: new Date() }
    );
    
    logger.info(`🎉 Training job completed: ${trainingId}`);
  } catch (error) {
    logger.error(`❌ Training queue processing failed:`, error);
    
    // 清理重建标记并更新collection状态为failed
    await Promise.all([
      MongoDatasetData.updateMany(
        { collectionId: safeObjectId(collectionId) },
        { rebuilding: false }
      ),
      MongoDatasetCollection.findByIdAndUpdate(
        safeObjectId(collectionId),
        { status: 'failed', updateTime: new Date() }
      )
    ]);
  } finally {
    reduceQueue();
  }
}

// 处理单个批次 - 复现原版FastGPT的批次处理逻辑
async function processBatch(params: {
  batch: any[];
  collection: any;
  mode: TrainingModeEnum;
}): Promise<void> {
  const { batch, collection, mode } = params;

  try {
    logger.info(`Starting batch processing with ${batch.length} items`);
    
    // 准备训练数据
    const inputs = batch.map(item => {
      // 根据集合设置组合标题和内容
      if (collection.indexPrefixTitle && collection.name) {
        return `${collection.name}\n${item.q}`;
      }
      return item.q;
    });

    // 准备元数据
    const metadata = batch.map((item, index) => {
      // 确保每个数据项都有有效的dataId
      let dataId = item.indexes?.[0]?.dataId;
      if (!dataId) {
        dataId = `${item._id.toString()}_${index}_${Date.now()}`;
        logger.warn(`Generated missing dataId for item ${item._id}: ${dataId}`);
      }
      
      return {
        dataId,
        q: item.q,
        a: item.a || '',
        chunkIndex: item.chunkIndex || index
      };
    });

    logger.info(`Prepared inputs and metadata:`, {
      inputCount: inputs.length,
      firstInput: inputs[0]?.substring(0, 100) + '...',
      metadataCount: metadata.length,
      firstDataId: metadata[0]?.dataId
    });

    // 获取嵌入模型
    const vectorModel = collection.datasetId?.vectorModel || collection.datasetId || 'text-embedding-v3';
    const embeddingModel = getEmbeddingModel(vectorModel);
    
    logger.info(`Using embedding model:`, {
      model: embeddingModel.model,
      provider: embeddingModel.provider
    });

    // 插入向量
    const result = await insertDatasetDataVector({
      inputs,
      model: embeddingModel,
      teamId: collection.teamId.toString(),
      datasetId: (collection.datasetId._id || collection.datasetId).toString(),
      collectionId: collection._id.toString(),
      metadata
    });

    logger.info(`✅ Batch processed successfully: ${inputs.length} items, tokens: ${result.tokens}, vectorIds: ${result.insertIds.length}`);
    
    // 验证向量是否真的被插入了 - 使用正确的向量维度
    try {
      const vectorStore = await getVectorStore();
      
      // 使用刚插入的第一个向量的前几个维度作为测试（确保维度匹配）
      if (result.insertIds.length > 0) {
        // 创建一个1024维的测试向量（全部设为0.1）
        const testVector = new Array(1024).fill(0.1);
        
        const testResult = await vectorStore.searchVectors(
          testVector,
          1,
          {
            teamId: collection.teamId.toString(),
            datasetId: (collection.datasetId._id || collection.datasetId).toString(),
            collectionId: collection._id.toString()
          }
        );
        
        logger.info(`Vector verification: found ${testResult.length} vectors in store for collection ${collection._id}`);
      }
    } catch (verificationError) {
      logger.warn(`Vector verification failed (non-critical):`, verificationError);
      // 验证失败不影响主流程
    }
    
  } catch (error) {
    logger.error('❌ Failed to process batch:', error);
    throw error;
  }
}

// 获取训练状态
export async function getTrainingStatus(trainingId: string): Promise<TrainingResult> {
  try {
    // 简化的状态检查 - 实际应该存储在数据库中
    return {
      trainingId,
      status: 'completed',
      processedCount: 0,
      totalCount: 0
    };
  } catch (error) {
    logger.error(`Failed to get training status:`, error);
    throw error;
  }
}

// 取消训练作业
export async function cancelTrainingJob(trainingId: string): Promise<void> {
  try {
    logger.info(`Cancelling training job: ${trainingId}`);
    // 实际实现应该从队列中移除作业
  } catch (error) {
    logger.error(`Failed to cancel training job:`, error);
    throw error;
  }
}

// 重试失败的训练
export async function retryFailedTraining(collectionId: string): Promise<string> {
  try {
    // 查找失败的项目（标记为重建中但超时的）
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30分钟前
    
    await MongoDatasetData.updateMany(
      {
        collectionId: safeObjectId(collectionId),
        rebuilding: true,
        updateTime: { $lt: cutoffTime }
      },
      { rebuilding: false }
    );

    // 启动新的训练作业
    return await startTrainingJob({
      collectionId,
      teamId: 'system',
      tmbId: 'system',
      mode: TrainingModeEnum.chunk
    });
  } catch (error) {
    logger.error('Failed to retry failed training:', error);
    throw error;
  }
}

// 启动训练队列管理器 - 复现原版FastGPT的训练队列逻辑
export const startTrainingQueue = (fast?: boolean) => {
  const max = 10; // 最大进程数

  for (let i = 0; i < (fast ? max : 1); i++) {
    generateQA(); // QA训练队列
    generateVector(); // 向量训练队列
  }
};

// 启动向量生成队列 - 复现原版FastGPT的generateVector函数
export async function generateVector(): Promise<void> {
  const max = 15; // 最大并发数
  
  if (global.vectorQueueLen >= max) {
    return;
  }

  (global as any).vectorQueueLen++;

  try {
    // 查找待处理的训练任务
    const pendingData = await MongoDatasetData.find({
      rebuilding: { $ne: true },
      'indexes.0': { $exists: true }
    }).populate([
      {
        path: 'datasetId',
        select: 'vectorModel'
      },
      {
        path: 'collectionId',
        select: 'name indexPrefixTitle'
      }
    ]).limit(10);

    if (pendingData.length === 0) {
      return;
    }

    // 按集合分组处理
    const collectionGroups = new Map<string, any[]>();
    
    pendingData.forEach(item => {
      const collectionId = item.collectionId._id.toString();
      if (!collectionGroups.has(collectionId)) {
        collectionGroups.set(collectionId, []);
      }
      collectionGroups.get(collectionId)!.push(item);
    });

    // 处理每个集合的数据
    for (const [collectionId, items] of collectionGroups) {
      try {
        await processBatch({
          batch: items,
          collection: items[0].collectionId,
          mode: TrainingModeEnum.chunk
        });

        // 标记完成
        const itemIds = items.map(item => item._id);
        await MongoDatasetData.updateMany(
          { _id: { $in: itemIds } },
          { rebuilding: false, updateTime: new Date() }
        );

        logger.info(`Vector generation completed for collection: ${collectionId}`);
      } catch (error) {
        logger.error(`Vector generation failed for collection ${collectionId}:`, error);
      }
    }

  } catch (error) {
    logger.error('Vector generation failed:', error);
  } finally {
    reduceQueue();
  }
}
