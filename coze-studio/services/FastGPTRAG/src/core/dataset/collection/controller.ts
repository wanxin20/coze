import { Types } from 'mongoose';
import { MongoDatasetCollection } from './schema.js';
import { MongoDataset } from '../schema.js';
import { MongoDatasetData } from '../data/schema.js';
import {
  CreateCollectionParams,
  DatasetCollectionSchemaType,
  DatasetCollectionTypeEnum,
  DatasetCollectionDataProcessModeEnum,
  TrainingModeEnum
} from '@/types/dataset.js';
import { AuthContext, PaginationParams, PaginationResponse } from '@/types/common.js';
import { logger } from '@/utils/logger.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { fileProcessManager, getFileInfo } from '@/core/file/index.js';
import { startTrainingJob } from '@/jobs/newTraining.js';
import { hashText } from '@/utils/text.js';

/**
 * 将文件扩展名映射到支持的文件类型
 */
function mapFileExtensionToType(extension: string): any {
  // 移除可能的前导点并转为小写
  const ext = extension.toLowerCase().replace(/^\./, '');
  
  const typeMap: Record<string, any> = {
    'txt': 'txt',
    'md': 'md',
    'markdown': 'markdown', 
    'html': 'html',
    'htm': 'html',
    'pdf': 'pdf',
    'docx': 'docx',
    'doc': 'docx', // 将DOC文件当作DOCX处理
    'xlsx': 'xlsx',
    'xls': 'xlsx', // 将XLS文件当作XLSX处理
    'csv': 'csv',
    'json': 'json',
    // 图片类型映射
    'jpg': 'jpg',
    'jpeg': 'jpeg',
    'png': 'png',
    'gif': 'gif',
    'webp': 'webp',
    'bmp': 'bmp'
  };
  
  return typeMap[ext] || 'txt'; // 默认当作文本处理
}


// Collection CRUD operations
export async function createCollection(
  params: CreateCollectionParams,
  authContext: AuthContext
): Promise<DatasetCollectionSchemaType> {
  try {
    // Validate IDs using safer validation
    if (!isValidObjectId(params.datasetId)) {
      throw new Error(`Invalid datasetId format: ${params.datasetId}`);
    }
    
    // Use safeObjectId for better validation
    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');
    
    // Verify dataset exists and user has access
    const dataset = await MongoDataset.findOne({
      _id: safeObjectId(params.datasetId),
      teamId: teamId
    });

    if (!dataset) {
      throw new Error('Dataset not found or access denied');
    }

    // Use safeObjectId for tmbId
    const tmbId = safeObjectId(authContext.tmbId, '000000000000000000000002');

    // If parentId is provided, verify it exists
    if (params.parentId && isValidObjectId(params.parentId)) {
      const parentCollection = await MongoDatasetCollection.findOne({
        _id: safeObjectId(params.parentId),
        datasetId: safeObjectId(params.datasetId),
        teamId: teamId
      });

      if (!parentCollection) {
        throw new Error('Parent collection not found');
      }
    }

    // Create collection
    const collection = await MongoDatasetCollection.create({
      ...params,
      datasetId: safeObjectId(params.datasetId),
      parentId: params.parentId && isValidObjectId(params.parentId) ? safeObjectId(params.parentId) : null,
      teamId: teamId,
      tmbId: tmbId,
      trainingType: params.trainingType || DatasetCollectionDataProcessModeEnum.chunk,
      chunkSize: params.chunkSize || 512,
      chunkSplitter: params.chunkSplitter || '\n',
      qaPrompt: params.qaPrompt || '',
      metadata: params.metadata || {},
      status: 'ready', // 设置初始状态
      updateTime: new Date()
    });

    // If rawText is provided, start processing
    if (params.rawText && params.type !== DatasetCollectionTypeEnum.folder) {
      // 更新状态为processing
      await MongoDatasetCollection.findByIdAndUpdate(
        collection._id,
        { status: 'processing', updateTime: new Date() }
      );
      
      await processCollectionContent(collection._id.toString(), params.rawText, authContext);
    }

    logger.info(`Collection created: ${collection._id}`);
    return collection;
  } catch (error) {
    logger.error('Failed to create collection:', error);
    throw error;
  }
}

export async function getCollections(
  authContext: AuthContext,
  params: {
    datasetId: string;
    parentId?: string;
    type?: DatasetCollectionTypeEnum;
    searchKey?: string;
  },
  pagination: PaginationParams = {}
): Promise<PaginationResponse<DatasetCollectionSchemaType>> {
  try {
    const { datasetId, parentId, type, searchKey } = params;
    const { current = 1, pageSize = 20 } = pagination;
    
    // Validate IDs
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new Error('Invalid datasetId format');
    }
    
    const teamId = Types.ObjectId.isValid(authContext.teamId) 
      ? authContext.teamId 
      : '000000000000000000000001';
    
    const filter: any = {
      datasetId: new Types.ObjectId(datasetId),
      teamId: new Types.ObjectId(teamId)
    };

    if (parentId !== undefined) {
      filter.parentId = (parentId && Types.ObjectId.isValid(parentId)) ? new Types.ObjectId(parentId) : null;
    }

    if (type) {
      filter.type = type;
    }

    if (searchKey) {
      filter.$or = [
        { name: { $regex: searchKey, $options: 'i' } }
      ];
    }

    const skip = (current - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      MongoDatasetCollection
        .find(filter)
        .sort({ updateTime: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      MongoDatasetCollection.countDocuments(filter)
    ]);

    return {
      list,
      total,
      current,
      pageSize
    };
  } catch (error) {
    logger.error('Failed to get collections:', error);
    throw error;
  }
}

export async function getCollectionById(
  collectionId: string,
  authContext: AuthContext
): Promise<DatasetCollectionSchemaType | null> {
  try {
    if (!Types.ObjectId.isValid(collectionId)) {
      throw new Error('Invalid collectionId format');
    }
    
    const teamId = Types.ObjectId.isValid(authContext.teamId) 
      ? authContext.teamId 
      : '000000000000000000000001';
    
    const collection = await MongoDatasetCollection.findOne({
      _id: new Types.ObjectId(collectionId),
      teamId: new Types.ObjectId(teamId)
    }).lean();

    return collection;
  } catch (error) {
    logger.error('Failed to get collection:', error);
    throw error;
  }
}

export async function updateCollection(
  collectionId: string,
  updates: Partial<DatasetCollectionSchemaType>,
  authContext: AuthContext
): Promise<DatasetCollectionSchemaType | null> {
  try {
    const collection = await MongoDatasetCollection.findOneAndUpdate(
      {
        _id: new Types.ObjectId(collectionId),
        teamId: new Types.ObjectId(authContext.teamId)
      },
      {
        ...updates,
        updateTime: new Date()
      },
      { new: true }
    ).lean();

    if (collection) {
      logger.info(`Collection updated: ${collectionId}`);
    }

    return collection;
  } catch (error) {
    logger.error('Failed to update collection:', error);
    throw error;
  }
}

export async function deleteCollection(
  collectionId: string,
  authContext: AuthContext
): Promise<void> {
  try {
    // Validate ObjectId
    if (!isValidObjectId(collectionId)) {
      throw new Error(`Invalid collectionId format: ${collectionId}`);
    }

    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');

    // Find collection and verify access
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(collectionId),
      teamId: teamId
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Find all child collections recursively
    const allCollections = await findCollectionAndAllChildren(collectionId, teamId.toString());
    const collectionIds = allCollections.map(c => c._id);

    // Delete all related data
    const dataItems = await MongoDatasetData.find({
      collectionId: { $in: collectionIds }
    }).lean();

    if (dataItems.length > 0) {
      // Delete vectors from vector store
      const vectorStore = await getVectorStore();
      const vectorIds = dataItems.flatMap(item => 
        item.indexes.map(index => index.dataId)
      );
      
      if (vectorIds.length > 0) {
        await vectorStore.deleteVectors(vectorIds);
      }

      // Delete data records
      await MongoDatasetData.deleteMany({
        collectionId: { $in: collectionIds }
      });
    }

    // Delete collections
    await MongoDatasetCollection.deleteMany({
      _id: { $in: collectionIds }
    });

    logger.info(`Deleted ${collectionIds.length} collections and related data`);
  } catch (error) {
    logger.error('Failed to delete collection:', error);
    throw error;
  }
}

export async function syncCollection(
  collectionId: string,
  authContext: AuthContext
): Promise<{ message: string }> {
  try {
    const collection = await getCollectionById(collectionId, authContext);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // For link-type collections, re-fetch content
    if (collection.type === DatasetCollectionTypeEnum.link && collection.rawLink) {
      // TODO: Implement web content fetching
      logger.info(`Syncing link collection: ${collectionId}`);
      return { message: 'Link sync initiated' };
    }

    // For file-type collections, check for file updates
    if (collection.type === DatasetCollectionTypeEnum.file && collection.fileId) {
      // TODO: Implement file update checking
      logger.info(`Syncing file collection: ${collectionId}`);
      return { message: 'File sync initiated' };
    }

    return { message: 'No sync needed for this collection type' };
  } catch (error) {
    logger.error('Failed to sync collection:', error);
    throw error;
  }
}

export async function retrainCollection(
  collectionId: string,
  authContext: AuthContext
): Promise<{ message: string; trainingId?: string }> {
  try {
    const collection = await getCollectionById(collectionId, authContext);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Start retraining job
    const trainingId = await startTrainingJob({
      collectionId,
      teamId: authContext.teamId,
      tmbId: authContext.tmbId,
      mode: TrainingModeEnum.chunk
    });

    logger.info(`Started retraining for collection: ${collectionId}`);
    return { 
      message: 'Retraining initiated',
      trainingId 
    };
  } catch (error) {
    logger.error('Failed to retrain collection:', error);
    throw error;
  }
}

export async function getCollectionTrainingDetail(
  collectionId: string,
  authContext: AuthContext
): Promise<{
  total: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const collection = await getCollectionById(collectionId, authContext);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Count data items by status
    const [total, rebuilding] = await Promise.all([
      MongoDatasetData.countDocuments({ 
        collectionId: new Types.ObjectId(collectionId) 
      }),
      MongoDatasetData.countDocuments({ 
        collectionId: new Types.ObjectId(collectionId),
        rebuilding: true 
      })
    ]);

    return {
      total,
      processing: rebuilding,
      completed: total - rebuilding,
      failed: 0 // TODO: Implement failed tracking
    };
  } catch (error) {
    logger.error('Failed to get training detail:', error);
    throw error;
  }
}

export async function exportCollection(
  collectionId: string,
  authContext: AuthContext
): Promise<{
  name: string;
  data: Array<{
    q: string;
    a?: string;
    indexes: Array<{ text: string }>;
  }>;
}> {
  try {
    const collection = await getCollectionById(collectionId, authContext);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const dataItems = await MongoDatasetData.find({
      collectionId: new Types.ObjectId(collectionId)
    }).lean();

    const exportData = dataItems.map(item => ({
      q: item.q,
      a: item.a || '',
      indexes: item.indexes.map(index => ({ text: index.text }))
    }));

    return {
      name: collection.name,
      data: exportData
    };
  } catch (error) {
    logger.error('Failed to export collection:', error);
    throw error;
  }
}

// Helper functions
export async function findCollectionAndAllChildren(
  collectionId: string,
  teamId: string
): Promise<DatasetCollectionSchemaType[]> {
  const collections: DatasetCollectionSchemaType[] = [];
  const toProcess = [collectionId];

  // Validate inputs
  if (!isValidObjectId(collectionId)) {
    throw new Error(`Invalid collectionId format: ${collectionId}`);
  }

  const teamObjectId = safeObjectId(teamId, '000000000000000000000001');

  while (toProcess.length > 0) {
    const currentId = toProcess.pop()!;
    
    if (!isValidObjectId(currentId)) {
      continue; // Skip invalid IDs
    }
    
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(currentId),
      teamId: teamObjectId
    }).lean();

    if (collection) {
      collections.push(collection);

      // Find children
      const children = await MongoDatasetCollection.find({
        parentId: collection._id,
        teamId: teamObjectId
      }).lean();

      toProcess.push(...children.map(c => c._id.toString()));
    }
  }

  return collections;
}

// Create collection from file upload
export async function createCollectionFromFile(
  params: CreateCollectionParams & {
    file: {
      originalName: string;
      filename: string;
      path: string;
      size: number;
      mimetype: string;
      extension: string;
    };
  },
  authContext: AuthContext
): Promise<{ collectionId: string }> {
  try {
    logger.info(`Processing file upload: ${params.file.originalName} (${params.file.extension})`);
    
    // 确定文件类型
    const fileType = mapFileExtensionToType(params.file.extension);
    logger.info(`Mapped file type: ${params.file.extension} -> ${fileType}`);
    
    // 使用新的文件处理系统
    const processResult = await fileProcessManager.processFileContent({
      filePath: params.file.path,
      type: fileType,
      chunkSize: params.chunkSize || 512,
      chunkOverlap: 50,
      preserveStructure: true,
      extractImages: true,
      filename: params.file.originalName,
      enableParagraphOptimization: params.enableParagraphOptimization || false,  // 从参数中获取，默认关闭
      agentModel: params.agentModel,
      paragraphChunkAIMode: params.paragraphChunkAIMode
    });

    // 创建集合并直接处理内容
    const collection = await createCollection({
      ...params,
      type: DatasetCollectionTypeEnum.file,
      rawText: processResult.rawText,
      metadata: {
        ...params.metadata,
        fileName: params.file.originalName,
        fileSize: params.file.size,
        fileMimeType: params.file.mimetype,
        fileType: fileType,
        imageCount: processResult.imageList?.length || 0,
        processedChunks: processResult.metadata?.totalChunks || 0,
        language: processResult.metadata?.language || 'mixed'
      }
    }, authContext);

    logger.info(`File processed successfully: ${collection._id}, chunks: ${processResult.metadata?.totalChunks}`);
    return { collectionId: collection._id.toString() };
  } catch (error) {
    logger.error('Failed to create collection from file:', error);
    throw error;
  }
}

// Create collection from link/URL
export async function createCollectionFromLink(
  params: CreateCollectionParams & {
    link: string;
  },
  authContext: AuthContext
): Promise<{ collectionId: string }> {
  try {
    // Fetch content from URL
    const content = await fetchUrlContent(params.link);

    // Create collection with link type
    const collection = await createCollection({
      ...params,
      type: DatasetCollectionTypeEnum.link,
      rawText: content,
      metadata: {
        ...params.metadata,
        sourceUrl: params.link,
        fetchTime: new Date().toISOString()
      }
    }, authContext);

    logger.info(`Collection created from link: ${collection._id}, url: ${params.link}`);
    return { collectionId: collection._id.toString() };
  } catch (error) {
    logger.error('Failed to create collection from link:', error);
    throw error;
  }
}

// Helper function to fetch URL content
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FastGPT-RAG/1.0; +https://github.com/fastgpt)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      // For HTML content, extract text using cheerio
      const html = await response.text();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      
      // Remove script and style elements
      $('script, style').remove();
      
      // Extract text content
      return $('body').text().replace(/\s+/g, ' ').trim();
    } else if (contentType.includes('text/')) {
      // For plain text content
      return await response.text();
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  } catch (error) {
    logger.error(`Failed to fetch URL content: ${url}`, error);
    throw new Error(`Failed to fetch content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processCollectionContent(
  collectionId: string,
  rawText: string,
  authContext: AuthContext
): Promise<void> {
  try {
    // Get collection
    const collection = await MongoDatasetCollection.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Update collection with text metadata
    const textHash = hashText(rawText);
    await MongoDatasetCollection.findByIdAndUpdate(collectionId, {
      rawTextLength: rawText.length,
      hashRawText: textHash,
      updateTime: new Date()
    });

    // Process file content and create data chunks
    const processResult = await fileProcessManager.processFileContent({
      content: rawText,
      type: 'txt',
      chunkSize: collection.chunkSize || 512,
      chunkOverlap: 50,
      enableParagraphOptimization: false  // 确保内容处理时也不启用段落优化
    });
    
    const chunks = processResult.chunks || [];

    // Save chunks as data items
    const dataItems = chunks.map((chunk, index) => ({
      teamId: collection.teamId,
      tmbId: collection.tmbId,
      datasetId: collection.datasetId,
      collectionId: collection._id,
      q: chunk.text,
      a: '',
      chunkIndex: chunk.index || index,
      indexes: [{
        type: 'custom' as const,
        dataId: `${collectionId}_${chunk.index || index}`,
        text: chunk.text
      }],
      updateTime: new Date()
    }));

    if (dataItems.length > 0) {
      await MongoDatasetData.insertMany(dataItems);
      
      // 根据集合的训练类型选择正确的训练模式
      let trainingMode = TrainingModeEnum.chunk; // 默认模式
      
      if (collection.trainingType === 'image') {
        trainingMode = TrainingModeEnum.image;
      } else if (collection.trainingType === 'imageParse') {
        trainingMode = TrainingModeEnum.imageParse;
      } else if (collection.trainingType === 'qa') {
        trainingMode = TrainingModeEnum.qa;
      } else if (collection.trainingType === 'auto') {
        trainingMode = TrainingModeEnum.auto;
      }
      
      logger.info(`Starting training with mode: ${trainingMode} for collection: ${collectionId}`);
      
      // Start vectorization training
      await startTrainingJob({
        collectionId,
        teamId: authContext.teamId,
        tmbId: authContext.tmbId,
        mode: trainingMode
      });
    }

    logger.info(`Processed ${chunks.length} chunks for collection: ${collectionId}`);
    
    // 处理完成，但不直接设置为ready，因为训练任务会管理状态
    // 训练任务完成后会自动设置为ready
    logger.info(`Collection content processing completed: ${collectionId}`);
    
  } catch (error) {
    logger.error('Failed to process collection content:', error);
    
    // 处理失败时设置错误状态
    await MongoDatasetCollection.findByIdAndUpdate(collectionId, {
      status: 'error',
      updateTime: new Date()
    });
    
    throw error;
  }
}
