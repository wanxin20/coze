import { Types } from 'mongoose';
import { MongoDatasetData } from './schema.js';
import { MongoDatasetCollection } from '../collection/schema.js';
import { MongoDataset } from '../schema.js';
import {
  DatasetDataSchemaType,
  DatasetDataIndexTypeEnum,
  PushDatasetDataParams,
  TrainingModeEnum
} from '@/types/dataset.js';
import { AuthContext, PaginationParams, PaginationResponse } from '@/types/common.js';
import { logger } from '@/utils/logger.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { startTrainingJob } from '@/jobs/newTraining.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';

// Data CRUD operations
export async function insertData(
  params: {
    collectionId: string;
    q: string;
    a?: string;
    indexes?: Array<{
      type: DatasetDataIndexTypeEnum;
      text: string;
    }>;
    chunkIndex?: number;
  },
  authContext: AuthContext
): Promise<DatasetDataSchemaType> {
  try {
    // Validate IDs using safer validation
    if (!isValidObjectId(params.collectionId)) {
      throw new Error(`Invalid collectionId format: ${params.collectionId}`);
    }
    
    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');
    const tmbId = safeObjectId(authContext.tmbId, '000000000000000000000002');
    
    // Verify collection exists and user has access
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(params.collectionId),
      teamId: teamId
    }).populate('datasetId');

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Generate indexes if not provided
    let indexes = params.indexes || [];
    if (indexes.length === 0) {
      const dataId = new Types.ObjectId().toString();
      indexes = [{
        type: DatasetDataIndexTypeEnum.custom,
        text: params.q
      }];
    }

    // Add dataId to indexes
    const indexesWithId = indexes.map((index, i) => ({
      ...index,
      dataId: `${params.collectionId}_${Date.now()}_${i}`
    }));

    // Create data item
    const dataItem = await MongoDatasetData.create({
      teamId: teamId,
      tmbId: tmbId,
      datasetId: collection.datasetId,
      collectionId: safeObjectId(params.collectionId),
      q: params.q,
      a: params.a || '',
      indexes: indexesWithId,
      chunkIndex: params.chunkIndex || 0,
      updateTime: new Date()
    });

    // Start vectorization if needed
    await startTrainingJob({
      collectionId: params.collectionId,
      teamId: teamId.toString(),
      tmbId: tmbId.toString(),
      mode: TrainingModeEnum.chunk
    });

    logger.info(`Data item created: ${dataItem._id}`);
    return dataItem;
  } catch (error) {
    logger.error('Failed to insert data:', error);
    throw error;
  }
}

export async function pushDatasetData(
  params: PushDatasetDataParams,
  authContext: AuthContext
): Promise<{ insertedCount: number; trainingId?: string }> {
  try {
    // Validate IDs using safer validation
    if (!isValidObjectId(params.collectionId)) {
      throw new Error(`Invalid collectionId format: ${params.collectionId}`);
    }
    
    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');
    const tmbId = safeObjectId(authContext.tmbId, '000000000000000000000002');
    
    // Verify collection exists and user has access
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(params.collectionId),
      teamId: teamId
    }).populate('datasetId');

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Prepare data items
    const dataItems = params.data.map((item, index) => {
      // Generate indexes if not provided
      let indexes = item.indexes || [];
      if (indexes.length === 0) {
        indexes = [{
          type: DatasetDataIndexTypeEnum.custom,
          text: item.q
        }];
      }

      // Add dataId to indexes
      const indexesWithId = indexes.map((idx, i) => ({
        ...idx,
        dataId: `${params.collectionId}_${Date.now()}_${index}_${i}`
      }));

      return {
        teamId: teamId,
        tmbId: tmbId,
        datasetId: collection.datasetId,
        collectionId: safeObjectId(params.collectionId),
        q: item.q,
        a: item.a || '',
        indexes: indexesWithId,
        chunkIndex: index,
        updateTime: new Date()
      };
    });

    // Insert data items
    const insertedItems = await MongoDatasetData.insertMany(dataItems);

    // Start training job for vectorization
    const trainingId = await startTrainingJob({
      collectionId: params.collectionId,
      teamId: teamId.toString(),
      tmbId: tmbId.toString(),
      mode: params.mode || TrainingModeEnum.chunk
    });

    logger.info(`Pushed ${insertedItems.length} data items to collection: ${params.collectionId}`);
    
    return {
      insertedCount: insertedItems.length,
      trainingId
    };
  } catch (error) {
    logger.error('Failed to push dataset data:', error);
    throw error;
  }
}

export async function getDataList(
  authContext: AuthContext,
  params: {
    collectionId?: string;
    datasetId?: string;
    searchText?: string;
  },
  pagination: PaginationParams = {}
): Promise<PaginationResponse<DatasetDataSchemaType>> {
  try {
    const { collectionId, datasetId, searchText } = params;
    const { current = 1, pageSize = 20 } = pagination;
    
    const filter: any = {
      teamId: safeObjectId(authContext.teamId, '000000000000000000000001')
    };

    if (collectionId && isValidObjectId(collectionId)) {
      filter.collectionId = safeObjectId(collectionId);
    } else if (datasetId && isValidObjectId(datasetId)) {
      filter.datasetId = safeObjectId(datasetId);
    }

    if (searchText) {
      filter.$or = [
        { q: { $regex: searchText, $options: 'i' } },
        { a: { $regex: searchText, $options: 'i' } }
      ];
    }

    const skip = (current - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      MongoDatasetData
        .find(filter)
        .sort({ chunkIndex: 1, updateTime: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      MongoDatasetData.countDocuments(filter)
    ]);

    return {
      list,
      total,
      current,
      pageSize
    };
  } catch (error) {
    logger.error('Failed to get data list:', error);
    throw error;
  }
}

export async function getDataById(
  dataId: string,
  authContext: AuthContext
): Promise<DatasetDataSchemaType | null> {
  try {
    const dataItem = await MongoDatasetData.findOne({
      _id: new Types.ObjectId(dataId),
      teamId: new Types.ObjectId(authContext.teamId)
    }).lean();

    return dataItem;
  } catch (error) {
    logger.error('Failed to get data:', error);
    throw error;
  }
}

export async function updateData(
  dataId: string,
  updates: Partial<DatasetDataSchemaType>,
  authContext: AuthContext
): Promise<DatasetDataSchemaType | null> {
  try {
    // Get original data item
    const originalData = await MongoDatasetData.findOne({
      _id: new Types.ObjectId(dataId),
      teamId: new Types.ObjectId(authContext.teamId)
    });

    if (!originalData) {
      throw new Error('Data not found or access denied');
    }

    // If content changed, regenerate indexes and vectors
    const contentChanged = updates.q && updates.q !== originalData.q;
    
    if (contentChanged) {
      // Delete old vectors
      const vectorStore = await getVectorStore();
      const oldVectorIds = originalData.indexes.map(index => index.dataId);
      if (oldVectorIds.length > 0) {
        await vectorStore.deleteVectors(oldVectorIds);
      }

      // Generate new indexes
      if (updates.q) {
        const newDataId = `${originalData.collectionId}_${Date.now()}`;
        updates.indexes = [{
          type: DatasetDataIndexTypeEnum.custom,
          dataId: newDataId,
          text: updates.q
        }];
      }
    }

    // Update data item
    const dataItem = await MongoDatasetData.findByIdAndUpdate(
      dataId,
      {
        ...updates,
        updateTime: new Date()
      },
      { new: true }
    ).lean();

    // If content changed, start re-vectorization
    if (contentChanged && dataItem) {
      await startTrainingJob({
        collectionId: dataItem.collectionId.toString(),
        teamId: authContext.teamId,
        tmbId: authContext.tmbId,
        mode: TrainingModeEnum.chunk
      });
    }

    if (dataItem) {
      logger.info(`Data item updated: ${dataId}`);
    }

    return dataItem;
  } catch (error) {
    logger.error('Failed to update data:', error);
    throw error;
  }
}

export async function deleteData(
  dataId: string,
  authContext: AuthContext
): Promise<void> {
  try {
    // Get data item first to get vector IDs
    const dataItem = await MongoDatasetData.findOne({
      _id: new Types.ObjectId(dataId),
      teamId: new Types.ObjectId(authContext.teamId)
    });

    if (!dataItem) {
      throw new Error('Data not found or access denied');
    }

    // Delete vectors from vector store
    const vectorStore = await getVectorStore();
    const vectorIds = dataItem.indexes.map(index => index.dataId);
    if (vectorIds.length > 0) {
      await vectorStore.deleteVectors(vectorIds);
    }

    // Delete data item
    await MongoDatasetData.findByIdAndDelete(dataId);

    logger.info(`Data item deleted: ${dataId}`);
  } catch (error) {
    logger.error('Failed to delete data:', error);
    throw error;
  }
}

export async function getDataPermission(
  dataId: string,
  authContext: AuthContext
): Promise<{
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}> {
  try {
    // Get data item and check ownership
    const dataItem = await MongoDatasetData.findOne({
      _id: new Types.ObjectId(dataId),
      teamId: new Types.ObjectId(authContext.teamId)
    });

    if (!dataItem) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false
      };
    }

    // Simple permission check - if user can access, they can do everything
    // TODO: Implement more granular permissions based on collection/dataset settings
    const isOwner = dataItem.tmbId.toString() === authContext.tmbId;
    const hasTeamAccess = dataItem.teamId.toString() === authContext.teamId;

    return {
      canRead: hasTeamAccess,
      canWrite: hasTeamAccess,
      canDelete: isOwner || hasTeamAccess
    };
  } catch (error) {
    logger.error('Failed to get data permission:', error);
    return {
      canRead: false,
      canWrite: false,
      canDelete: false
    };
  }
}

// Batch operations
export async function batchDeleteData(
  dataIds: string[],
  authContext: AuthContext
): Promise<{ deletedCount: number }> {
  try {
    // Get all data items
    const dataItems = await MongoDatasetData.find({
      _id: { $in: dataIds.map(id => new Types.ObjectId(id)) },
      teamId: new Types.ObjectId(authContext.teamId)
    }).lean();

    if (dataItems.length === 0) {
      return { deletedCount: 0 };
    }

    // Delete vectors from vector store
    const vectorStore = await getVectorStore();
    const vectorIds = dataItems.flatMap(item => 
      item.indexes.map(index => index.dataId)
    );
    
    if (vectorIds.length > 0) {
      await vectorStore.deleteVectors(vectorIds);
    }

    // Delete data items
    const result = await MongoDatasetData.deleteMany({
      _id: { $in: dataIds.map(id => new Types.ObjectId(id)) },
      teamId: new Types.ObjectId(authContext.teamId)
    });

    logger.info(`Batch deleted ${result.deletedCount} data items`);
    return { deletedCount: result.deletedCount };
  } catch (error) {
    logger.error('Failed to batch delete data:', error);
    throw error;
  }
}

export async function getDataQuoteUsage(
  dataId: string,
  authContext: AuthContext
): Promise<{
  total: number;
  recent: Array<{
    appId: string;
    appName: string;
    time: Date;
  }>;
}> {
  try {
    // TODO: Implement quote usage tracking
    // This would require a separate collection to track when data is used in chat
    
    return {
      total: 0,
      recent: []
    };
  } catch (error) {
    logger.error('Failed to get data quote usage:', error);
    throw error;
  }
}
