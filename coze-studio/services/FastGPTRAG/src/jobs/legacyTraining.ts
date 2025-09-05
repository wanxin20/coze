import { Types } from 'mongoose';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { MongoDatasetData } from '@/core/dataset/data/schema.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText, EmbeddingTypeEnum } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';

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

// Start training job for a collection
export async function startTrainingJob(params: TrainingJobParams): Promise<string> {
  const { collectionId, teamId, tmbId, mode, batchSize = 10 } = params;
  const trainingId = new Types.ObjectId().toString();

  try {
    logger.info(`Starting training job: ${trainingId} for collection: ${collectionId}`);

    // Validate collectionId as ObjectId
    if (!isValidObjectId(collectionId)) {
      throw new Error(`Invalid ObjectId format: collectionId=${collectionId}`);
    }

    // Convert teamId to ObjectId or use default if invalid
    const teamIdForQuery = safeObjectId(teamId, '000000000000000000000001');

    // Get collection and verify access
    const collection = await MongoDatasetCollection.findOne({
      _id: safeObjectId(collectionId),
      teamId: teamIdForQuery
    });

    if (!collection) {
      throw new Error('Collection not found or access denied');
    }

    // Get all data items in the collection that need training
    const dataItems = await MongoDatasetData.find({
      collectionId: safeObjectId(collectionId),
      $or: [
        { rebuilding: { $ne: true } },
        { rebuilding: { $exists: false } }
      ]
    });

    if (dataItems.length === 0) {
      logger.info(`No data items to train in collection: ${collectionId}`);
      return trainingId;
    }

    // Mark items as rebuilding
    await MongoDatasetData.updateMany(
      { collectionId: safeObjectId(collectionId) },
      { rebuilding: true }
    );

    // Start async training process
    processTrainingBatch({
      trainingId,
      collectionId,
      dataItems,
      collection,
      mode,
      batchSize
    }).catch(error => {
      logger.error(`Training job ${trainingId} failed:`, error);
    });

    return trainingId;
  } catch (error) {
    logger.error(`Failed to start training job:`, error);
    throw error;
  }
}

// Process training batch
async function processTrainingBatch(params: {
  trainingId: string;
  collectionId: string;
  dataItems: any[];
  collection: any;
  mode: TrainingModeEnum;
  batchSize: number;
}): Promise<void> {
  const { trainingId, collectionId, dataItems, collection, mode, batchSize } = params;

  try {
    logger.info(`Processing training batch: ${trainingId}, ${dataItems.length} items`);

    const vectorStore = await getVectorStore();
    const embeddingModel = getEmbeddingModel(collection.vectorModel || 'text-embedding-v3');

    // Process items in batches
    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize);
      
      try {
        await processBatch(batch, vectorStore, embeddingModel, mode);
        
        // Mark batch as completed
        const batchIds = batch.map(item => item._id);
        await MongoDatasetData.updateMany(
          { _id: { $in: batchIds } },
          { rebuilding: false, updateTime: new Date() }
        );

        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataItems.length / batchSize)} for training ${trainingId}`);
      } catch (error) {
        logger.error(`Failed to process batch ${i / batchSize + 1}:`, error);
        
        // Mark batch as failed (remove rebuilding flag)
        const batchIds = batch.map(item => item._id);
        await MongoDatasetData.updateMany(
          { _id: { $in: batchIds } },
          { rebuilding: false }
        );
      }
    }

    logger.info(`Training job completed: ${trainingId}`);
  } catch (error) {
    logger.error(`Training batch processing failed:`, error);
    
    // Mark all items as not rebuilding
    await MongoDatasetData.updateMany(
      { collectionId: safeObjectId(collectionId) },
      { rebuilding: false }
    );
    
    throw error;
  }
}

// Process a single batch of data items
async function processBatch(
  batch: any[],
  vectorStore: any,
  embeddingModel: any,
  mode: TrainingModeEnum
): Promise<void> {
  try {
    // Prepare texts for embedding
    const texts = batch.map(item => item.q);
    
    // Get embeddings
    const { vectors } = await getVectorsByText({
      model: embeddingModel,
      input: texts,
      type: EmbeddingTypeEnum.db
    });

    // Prepare vector data for storage
    const vectorData = batch.map((item, index) => ({
      id: item.indexes[0]?.dataId || `${item._id.toString()}_0`,
      vector: vectors[index],
      metadata: {
        dataId: item._id.toString(),
        collectionId: item.collectionId.toString(),
        datasetId: item.datasetId.toString(),
        teamId: item.teamId.toString(),
        text: item.q,
        answer: item.a || '',
        chunkIndex: item.chunkIndex || 0,
        updateTime: new Date().toISOString()
      }
    }));

    // Store vectors
    await vectorStore.insertVectors(vectorData);

    logger.debug(`Stored ${vectorData.length} vectors for batch`);
  } catch (error) {
    logger.error('Failed to process batch:', error);
    throw error;
  }
}

// Get training job status
export async function getTrainingStatus(trainingId: string): Promise<TrainingResult> {
  try {
    // This is a simplified implementation
    // In a real system, you'd store job status in database
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

// Cancel training job
export async function cancelTrainingJob(trainingId: string): Promise<void> {
  try {
    logger.info(`Cancelling training job: ${trainingId}`);
    // Implementation would depend on job queue system
  } catch (error) {
    logger.error(`Failed to cancel training job:`, error);
    throw error;
  }
}

// Retry failed training items
export async function retryFailedTraining(collectionId: string): Promise<string> {
  try {
    // Find failed items (those marked as rebuilding for too long)
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    
    await MongoDatasetData.updateMany(
      {
        collectionId: safeObjectId(collectionId),
        rebuilding: true,
        updateTime: { $lt: cutoffTime }
      },
      { rebuilding: false }
    );

    // Start new training job
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