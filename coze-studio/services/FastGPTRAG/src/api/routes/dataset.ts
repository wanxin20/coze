import express from 'express';
import {
  createDataset,
  getDatasets,
  getDatasetById,
  updateDataset,
  deleteDataset
} from '@/core/dataset/controller.js';
import { searchTest } from '@/core/dataset/search/legacyController.js';
import { SearchScoreTypeEnum } from '@/core/dataset/search/newController.js';
import { CreateDatasetParams, DatasetTypeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';

const router = express.Router();

// Create dataset
router.post('/', async (req, res, next) => {
  try {
    const params: CreateDatasetParams = req.body;
    
    // Use simplified auth context from middleware
    const authContext = req.authContext || {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!params.name) {
      return res.status(400).json({
        code: 400,
        message: 'Dataset name is required',
        data: null
      });
    }

    const dataset = await createDataset(params, authContext);

    res.json({
      code: 200,
      message: 'Dataset created successfully',
      data: dataset._id.toString()
    });
  } catch (error) {
    next(error);
  }
});

// List datasets
router.get('/', async (req, res, next) => {
  try {
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const {
      parentId,
      type,
      searchKey,
      current = '1',
      pageSize = '20'
    } = req.query;

    const result = await getDatasets(
      authContext,
      {
        parentId: parentId as string,
        type: type as DatasetTypeEnum,
        searchKey: searchKey as string
      },
      {
        current: parseInt(current as string),
        pageSize: parseInt(pageSize as string)
      }
    );

    res.json({
      code: 200,
      message: 'Success',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get dataset by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const dataset = await getDatasetById(id, authContext);

    if (!dataset) {
      return res.status(404).json({
        code: 404,
        message: 'Dataset not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Success',
      data: dataset
    });
  } catch (error) {
    next(error);
  }
});

// Update dataset
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const dataset = await updateDataset(id, updates, authContext);

    if (!dataset) {
      return res.status(404).json({
        code: 404,
        message: 'Dataset not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Dataset updated successfully',
      data: dataset
    });
  } catch (error) {
    next(error);
  }
});

// Delete dataset
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    await deleteDataset(id, authContext);

    res.json({
      code: 200,
      message: 'Dataset deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
});

// Search test endpoint - FastGPT compatible
router.post('/searchTest', async (req, res, next) => {
  try {
    const params = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!params.datasetId || !params.text) {
      return res.status(400).json({
        code: 400,
        message: 'datasetId and text are required',
        data: null
      });
    }

    const result = await searchTest(params, authContext);

    // Convert score arrays to single score values for coze backend compatibility
    const convertedResults = result.searchRes.map(item => {
      let finalScore = 0;
      
      // If rerank was used, prioritize rerank score
      if (result.usingReRank) {
        const rerankScore = item.score.find(s => s.type === SearchScoreTypeEnum.reRank);
        if (rerankScore) {
          finalScore = rerankScore.value;
        } else {
          // Fallback to embedding score if rerank score not found
          const embeddingScore = item.score.find(s => s.type === SearchScoreTypeEnum.embedding);
          finalScore = embeddingScore?.value || 0;
        }
      } else {
        // Use embedding score when rerank is not used
        const embeddingScore = item.score.find(s => s.type === SearchScoreTypeEnum.embedding);
        finalScore = embeddingScore?.value || 0;
      }
      
      return {
        ...item,
        score: finalScore  // Convert score array to single score value
      };
    });

    // Format response to match Go backend expectations
    const formattedResult = {
      list: convertedResults,  // Use converted results with single score values
      total: result.searchRes.length,
      searchMode: result.searchMode,
      limit: result.limit,
      similarity: result.similarity,
      usingReRank: result.usingReRank,
      embeddingTokens: result.embeddingTokens,
      reRankInputTokens: result.reRankInputTokens,
      duration: result.duration || '0s',
      queryExtensionResult: result.queryExtensionResult || '',
      deepSearchResult: result.deepSearchResult,
      datasetSearchUsingExtensionQuery: false,
      error: result.error
    };

    res.json({
      code: 200,
      message: 'Search test completed',
      data: formattedResult
    });
  } catch (error) {
    logger.error('Search test failed:', error);
    next(error);
  }
});

// Retrain dataset endpoint
router.post('/retrain', async (req, res, next) => {
  try {
    const { datasetId } = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'datasetId is required',
        data: null
      });
    }

    // Import training functions
    const { startTrainingJob } = await import('@/jobs/newTraining.js');
    const { TrainingModeEnum } = await import('@/types/dataset.js');
    const { MongoDatasetCollection } = await import('@/core/dataset/collection/schema.js');
    
    // Find collections in the dataset
    const collections = await MongoDatasetCollection.find({
      datasetId: datasetId,
      teamId: authContext.teamId
    });

    if (collections.length === 0) {
      return res.status(404).json({
        code: 404,
        message: 'No collections found for this dataset',
        data: null
      });
    }

    // Start training for each collection
    const trainingIds = [];
    for (const collection of collections) {
      const trainingId = await startTrainingJob({
        collectionId: collection._id.toString(),
        teamId: authContext.teamId,
        tmbId: authContext.tmbId,
        mode: TrainingModeEnum.chunk
      });
      trainingIds.push(trainingId);
    }

    res.json({
      code: 200,
      message: 'Retraining started successfully',
      data: {
        trainingIds,
        collectionsCount: collections.length
      }
    });
  } catch (error) {
    logger.error('Retrain failed:', error);
    next(error);
  }
});

export default router;
