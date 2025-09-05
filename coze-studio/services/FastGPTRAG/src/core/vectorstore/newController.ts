/* 
 * 向量数据库控制器 - 复现原版FastGPT逻辑
 */
import { getVectorsByText } from '../embedding/index.js';
import { getEmbeddingModel } from '../embedding/index.js';
import { logger } from '@/utils/logger.js';
import type { EmbeddingModel } from '@/types/common.js';

// 向量插入参数
export interface InsertVectorProps {
  teamId: string;
  datasetId: string;
  collectionId: string;
  vectors: number[][];
  metadata: Array<{
    dataId: string;
    q: string;
    a?: string;
    chunkIndex?: number;
    updateTime?: string;
  }>;
}

// 向量召回参数
export interface EmbeddingRecallCtrlProps {
  teamId: string;
  datasetIds: string[];
  vector: number[];
  limit: number;
  forbidCollectionIdList?: string[];
  filterCollectionIdList?: string[];
}

// 向量搜索结果
export interface VectorSearchResult {
  id: string;
  score: number;
  datasetId: string;
  collectionId: string;
  metadata?: any;
}

// 获取向量存储实例
let vectorStoreInstance: any = null;

export async function getVectorStore() {
  if (!vectorStoreInstance) {
    const { getVectorStore: getStore } = await import('./index.js');
    vectorStoreInstance = await getStore();
  }
  return vectorStoreInstance;
}

// 重试函数
async function retryFn<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Retry ${i + 1}/${maxRetries} failed:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}

// 向量召回 - 复现原版逻辑
export async function recallFromVectorStore(props: EmbeddingRecallCtrlProps): Promise<VectorSearchResult[]> {
  return retryFn(async () => {
    const vectorStore = await getVectorStore();
    
    const { teamId, datasetIds, vector, limit, forbidCollectionIdList = [], filterCollectionIdList = [] } = props;
    
    // 构建过滤条件
    const filter: any = {
      teamId
    };
    
    // 如果指定了数据集ID，添加过滤
    if (datasetIds.length > 0) {
      filter.datasetId = { $in: datasetIds };
    }
    
    // 如果有禁止的集合ID列表
    if (forbidCollectionIdList.length > 0) {
      filter.collectionId = { $nin: forbidCollectionIdList };
    }
    
    // 如果有指定的集合ID列表
    if (filterCollectionIdList.length > 0) {
      filter.collectionId = { $in: filterCollectionIdList };
    }
    
    // 执行向量搜索
    const results = await vectorStore.searchVectors(vector, limit, filter);
    
    return results.map((result: any) => ({
      id: result.id,
      score: result.score,
      datasetId: result.metadata?.datasetId || '',
      collectionId: result.metadata?.collectionId || '',
      metadata: result.metadata
    }));
  });
}

// 插入向量数据
export async function insertDatasetDataVector(props: {
  inputs: string[];
  model: EmbeddingModel;
  teamId: string;
  datasetId: string;
  collectionId: string;
  metadata?: Array<{
    dataId: string;
    q: string;
    a?: string;
    chunkIndex?: number;
  }>;
}): Promise<{
  tokens: number;
  insertIds: string[];
}> {
  const { inputs, model, teamId, datasetId, collectionId, metadata = [] } = props;
  
  try {
    // 获取向量
    const { vectors, tokens } = await getVectorsByText({
      model,
      input: inputs,
      type: 'db' as any
    });
    
    // 准备向量数据
    const vectorData = vectors.map((vector, index) => ({
      id: metadata[index]?.dataId || `${collectionId}_${Date.now()}_${index}`,
      vector,
      metadata: {
        teamId,
        datasetId,
        collectionId,
        dataId: metadata[index]?.dataId || `${collectionId}_${Date.now()}_${index}`,
        text: inputs[index],
        q: metadata[index]?.q || inputs[index],
        a: metadata[index]?.a || '',
        chunkIndex: metadata[index]?.chunkIndex || 0,
        updateTime: new Date().toISOString()
      }
    }));
    
    // 插入向量
    const vectorStore = await getVectorStore();
    const insertIds = await retryFn(() => vectorStore.insertVectors(vectorData)) as string[];
    
    logger.info(`Inserted ${(insertIds as string[]).length} vectors for collection ${collectionId}`);
    
    return {
      tokens,
      insertIds: insertIds as string[]
    };
  } catch (error) {
    logger.error('Failed to insert dataset data vector:', error);
    throw error;
  }
}

// 删除向量数据
export async function deleteDatasetDataVector(props: {
  teamId: string;
  datasetId?: string;
  collectionId?: string;
  dataIds?: string[];
}): Promise<{ deletedCount: number }> {
  const { teamId, datasetId, collectionId, dataIds } = props;
  
  try {
    const vectorStore = await getVectorStore();
    
    // 构建删除条件
    const filter: any = { teamId };
    
    if (datasetId) {
      filter.datasetId = datasetId;
    }
    
    if (collectionId) {
      filter.collectionId = collectionId;
    }
    
    if (dataIds && dataIds.length > 0) {
      filter.dataId = { $in: dataIds };
    }
    
    const deletedCount = await retryFn(() => vectorStore.deleteVectors(filter)) as number;
    
    logger.info(`Deleted ${deletedCount} vectors`, filter);
    
    return { deletedCount: deletedCount as number };
  } catch (error) {
    logger.error('Failed to delete dataset data vector:', error);
    throw error;
  }
}

// 获取向量数量
export async function getVectorCountByTeamId(teamId: string): Promise<number> {
  try {
    const vectorStore = await getVectorStore();
    return await vectorStore.countVectors({ teamId });
  } catch (error) {
    logger.error('Failed to get vector count by team id:', error);
    return 0;
  }
}

export async function getVectorCountByDatasetId(datasetId: string): Promise<number> {
  try {
    const vectorStore = await getVectorStore();
    return await vectorStore.countVectors({ datasetId });
  } catch (error) {
    logger.error('Failed to get vector count by dataset id:', error);
    return 0;
  }
}

export async function getVectorCountByCollectionId(collectionId: string): Promise<number> {
  try {
    const vectorStore = await getVectorStore();
    return await vectorStore.countVectors({ collectionId });
  } catch (error) {
    logger.error('Failed to get vector count by collection id:', error);
    return 0;
  }
}

// 初始化向量存储
export async function initVectorStore() {
  try {
    const vectorStore = await getVectorStore();
    if (vectorStore.init) {
      await vectorStore.init();
      logger.info('Vector store initialized successfully');
    }
  } catch (error) {
    logger.error('Failed to initialize vector store:', error);
    throw error;
  }
}
