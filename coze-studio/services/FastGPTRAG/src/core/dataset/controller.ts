import { Types } from 'mongoose';
import { MongoDataset } from './schema.js';
import { MongoDatasetCollection } from './collection/schema.js';
import { MongoDatasetData } from './data/schema.js';
import {
  CreateDatasetParams,
  DatasetSchemaType,
  DatasetCollectionSchemaType,
  DatasetDataSchemaType,
  DatasetTypeEnum,
  SearchDatasetParams,
  DatasetSearchResult
} from '@/types/dataset.js';
import { AuthContext, PaginationParams, PaginationResponse } from '@/types/common.js';
import { logger } from '@/utils/logger.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';

// Dataset CRUD operations
export async function createDataset(
  params: CreateDatasetParams,
  authContext: AuthContext
): Promise<DatasetSchemaType> {
  try {
    const dataset = await MongoDataset.create({
      ...params,
      teamId: safeObjectId(authContext.teamId),
      tmbId: safeObjectId(authContext.tmbId),
      updateTime: new Date()
    });

    logger.info(`Dataset created: ${dataset._id}`);
    return dataset;
  } catch (error) {
    logger.error('Failed to create dataset:', error);
    throw error;
  }
}

export async function getDatasets(
  authContext: AuthContext,
  params: {
    parentId?: string;
    type?: DatasetTypeEnum;
    searchKey?: string;
  } = {},
  pagination: PaginationParams = {}
): Promise<PaginationResponse<DatasetSchemaType>> {
  try {
    const { parentId, type, searchKey } = params;
    const { current = 1, pageSize = 20 } = pagination;
    
    const filter: any = {
      teamId: safeObjectId(authContext.teamId)
    };

    if (parentId !== undefined) {
      filter.parentId = parentId ? safeObjectId(parentId) : null;
    }

    if (type) {
      filter.type = type;
    }

    if (searchKey) {
      filter.$or = [
        { name: { $regex: searchKey, $options: 'i' } },
        { intro: { $regex: searchKey, $options: 'i' } }
      ];
    }

    const skip = (current - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      MongoDataset
        .find(filter)
        .sort({ updateTime: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      MongoDataset.countDocuments(filter)
    ]);

    return {
      list,
      total,
      current,
      pageSize
    };
  } catch (error) {
    logger.error('Failed to get datasets:', error);
    throw error;
  }
}

export async function getDatasetById(
  datasetId: string,
  authContext: AuthContext
): Promise<DatasetSchemaType | null> {
  try {
    // Validate ObjectId format before trying to create ObjectId
    if (!isValidObjectId(datasetId)) {
      throw new Error(`Invalid dataset ID format: ${datasetId}`);
    }
    
    // Use safeObjectId for team ID to handle default values
    const teamObjectId = safeObjectId(authContext.teamId);

    const dataset = await MongoDataset.findOne({
      _id: new Types.ObjectId(datasetId),
      teamId: teamObjectId
    }).lean();

    return dataset;
  } catch (error) {
    logger.error('Failed to get dataset:', error);
    throw error;
  }
}

export async function updateDataset(
  datasetId: string,
  updates: Partial<DatasetSchemaType>,
  authContext: AuthContext
): Promise<DatasetSchemaType | null> {
  try {
    const dataset = await MongoDataset.findOneAndUpdate(
      {
        _id: new Types.ObjectId(datasetId),
        teamId: new Types.ObjectId(authContext.teamId)
      },
      {
        ...updates,
        updateTime: new Date()
      },
      { new: true }
    ).lean();

    if (dataset) {
      logger.info(`Dataset updated: ${datasetId}`);
    }

    return dataset;
  } catch (error) {
    logger.error('Failed to update dataset:', error);
    throw error;
  }
}

export async function deleteDataset(
  datasetId: string,
  authContext: AuthContext
): Promise<void> {
  try {
    // Find all datasets to delete (including children)
    const datasetsToDelete = await findDatasetAndAllChildren(datasetId, authContext.teamId);
    const datasetIds = datasetsToDelete.map(d => d._id);

    // Delete all related collections and data
    const collections = await MongoDatasetCollection.find({
      datasetId: { $in: datasetIds }
    }).lean();

    // 检查是否有正在处理或训练的集合
    const busyCollections = collections.filter(c => 
      c.status === 'processing' || c.status === 'training'
    );
    
    if (busyCollections.length > 0) {
      const busyNames = busyCollections.map(c => c.name).join(', ');
      throw new Error(`Cannot delete dataset: collections [${busyNames}] are currently being processed or trained. Please wait for completion or cancel the training first.`);
    }
    
    const collectionIds = collections.map(c => c._id);

    if (collectionIds.length > 0) {
      // Delete all data
      await MongoDatasetData.deleteMany({
        collectionId: { $in: collectionIds }
      });

      // Delete vectors from vector store
      const vectorStore = await getVectorStore();
      const dataItems = await MongoDatasetData.find({
        collectionId: { $in: collectionIds }
      }, { 'indexes.dataId': 1 }).lean();
      
      const vectorIds = dataItems.flatMap(item => 
        item.indexes.map(index => index.dataId)
      );
      
      if (vectorIds.length > 0) {
        await vectorStore.deleteVectors(vectorIds);
      }

      // Delete collections
      await MongoDatasetCollection.deleteMany({
        _id: { $in: collectionIds }
      });
    }

    // Delete datasets
    await MongoDataset.deleteMany({
      _id: { $in: datasetIds }
    });

    logger.info(`Deleted ${datasetIds.length} datasets and related data`);
  } catch (error) {
    logger.error('Failed to delete dataset:', error);
    throw error;
  }
}

export async function findDatasetAndAllChildren(
  datasetId: string,
  teamId: string
): Promise<DatasetSchemaType[]> {
  const datasets: DatasetSchemaType[] = [];
  const toProcess = [datasetId];

  while (toProcess.length > 0) {
    const currentId = toProcess.pop()!;
    
    // Validate ObjectId
    if (!Types.ObjectId.isValid(currentId)) {
      continue;
    }
    
    const safeTeamId = Types.ObjectId.isValid(teamId) 
      ? teamId 
      : '000000000000000000000001';
    
    const dataset = await MongoDataset.findOne({
      _id: new Types.ObjectId(currentId),
      teamId: new Types.ObjectId(safeTeamId)
    }).lean();

    if (dataset) {
      datasets.push(dataset);

      // Find children
      const children = await MongoDataset.find({
        parentId: dataset._id,
        teamId: new Types.ObjectId(safeTeamId)
      }).lean();

      toProcess.push(...children.map(c => c._id.toString()));
    }
  }

  return datasets;
}

// Dataset search functionality
export async function searchDataset(
  params: SearchDatasetParams,
  authContext: AuthContext
): Promise<DatasetSearchResult[]> {
  try {
    const {
      datasetId,
      text,
      limit = 10,
      similarity = 0.5,
      searchMode = 'embedding'
    } = params;

    // Verify dataset access
    const dataset = await getDatasetById(datasetId, authContext);
    if (!dataset) {
      throw new Error('Dataset not found or access denied');
    }

    if (searchMode === 'embedding') {
      return await searchByEmbedding({
        datasetId,
        text,
        limit,
        similarity,
        teamId: authContext.teamId,
        vectorModel: dataset.vectorModel
      });
    } else {
      // Implement full-text search or mixed search
      return await searchByFullText({
        datasetId,
        text,
        limit,
        teamId: authContext.teamId
      });
    }
  } catch (error) {
    logger.error('Failed to search dataset:', error);
    throw error;
  }
}

async function searchByEmbedding(params: {
  datasetId: string;
  text: string;
  limit: number;
  similarity: number;
  teamId: string;
  vectorModel: string;
}): Promise<DatasetSearchResult[]> {
  const { datasetId, text, limit, similarity, teamId, vectorModel } = params;

  // Get text embedding
  const embeddingModel = getEmbeddingModel(vectorModel);
  const { vectors } = await getVectorsByText({
    model: embeddingModel,
    input: text,
    type: 'query' as any
  });

  const queryVector = vectors[0];

  // Search vectors
  const vectorStore = await getVectorStore();
  const vectorResults = await vectorStore.searchVectors(
    queryVector,
    limit * 2, // Get more results to filter by similarity
    {
      teamId,
      datasetId
    }
  );

  // Filter by similarity threshold
  const filteredResults = vectorResults.filter(result => result.score >= similarity);

  // Get data details
  const dataIds = filteredResults.map(result => result.id);
  const dataItems = await MongoDatasetData.find({
    'indexes.dataId': { $in: dataIds },
    teamId: new Types.ObjectId(teamId),
    datasetId: new Types.ObjectId(datasetId)
  }).lean();

  // Map results
  const results: DatasetSearchResult[] = [];
  for (const vectorResult of filteredResults.slice(0, limit)) {
    const dataItem = dataItems.find(item => 
      item.indexes.some(index => index.dataId === vectorResult.id)
    );

    if (dataItem) {
      const index = dataItem.indexes.find(idx => idx.dataId === vectorResult.id);
      results.push({
        id: dataItem._id.toString(),
        q: dataItem.q,
        a: dataItem.a || '',
        score: vectorResult.score,
        indexes: dataItem.indexes
      });
    }
  }

  return results;
}

async function searchByFullText(params: {
  datasetId: string;
  text: string;
  limit: number;
  teamId: string;
}): Promise<DatasetSearchResult[]> {
  const { datasetId, text, limit, teamId } = params;

  // Simple text search using MongoDB text search
  const dataItems = await MongoDatasetData.find({
    $text: { $search: text },
    teamId: new Types.ObjectId(teamId),
    datasetId: new Types.ObjectId(datasetId)
  }, {
    score: { $meta: 'textScore' }
  })
  .sort({ score: { $meta: 'textScore' } })
  .limit(limit)
  .lean();

  return dataItems.map(item => ({
    id: item._id.toString(),
    q: item.q,
    a: item.a || '',
    score: (item as any).score || 0,
    indexes: item.indexes
  }));
}
