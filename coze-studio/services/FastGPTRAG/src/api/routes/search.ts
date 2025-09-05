import express from 'express';
import { 
  searchDataset,
  defaultSearchDatasetData
} from '@/core/dataset/search/newController.js';
import { 
  searchTest,
  deepSearch,
  advancedSearch
} from '@/core/dataset/search/legacyController.js';
import { SearchDatasetParams } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';

const router = express.Router();

// Basic search dataset
router.post('/', async (req, res, next) => {
  try {
    const params: SearchDatasetParams = req.body;
    
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

    const results = await searchDataset(params, authContext);

    res.json({
      code: 200,
      message: 'Search completed',
      data: {
        list: results.searchRes,  // Use 'list' to match Go backend expectations
        total: results.searchRes.length,
        searchMode: results.searchMode,
        limit: results.limit,
        similarity: results.similarity,
        usingReRank: results.usingReRank,
        embeddingTokens: results.embeddingTokens,
        reRankInputTokens: results.reRankInputTokens,
        duration: results.duration || '0s',
        queryExtensionResult: results.queryExtensionResult,
        deepSearchResult: results.deepSearchResult
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search test endpoint
router.post('/test', async (req, res, next) => {
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

    // Format response to match Go backend expectations
    const formattedResult = {
      list: result.searchRes,
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
    next(error);
  }
});

// Deep search with query extension
router.post('/deep', async (req, res, next) => {
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

    const result = await deepSearch(params, authContext);

    // Format response to match Go backend expectations
    const formattedResult = {
      list: result.searchRes,
      total: result.searchRes.length,
      searchMode: result.searchMode,
      limit: result.limit,
      similarity: result.similarity,
      usingReRank: result.usingReRank,
      embeddingTokens: result.embeddingTokens,
      reRankInputTokens: result.reRankInputTokens,
      duration: result.duration || '0s',
      queryExtensionResult: result.queryExtensionResult,
      deepSearchResult: result.deepSearchResult
    };

    res.json({
      code: 200,
      message: 'Deep search completed',
      data: formattedResult
    });
  } catch (error) {
    next(error);
  }
});

// Advanced search with filters
router.post('/advanced', async (req, res, next) => {
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

    const result = await advancedSearch(params, authContext);

    // Format response to match Go backend expectations
    const formattedResult = {
      list: result.searchRes,
      total: result.searchRes.length,
      searchMode: result.searchMode,
      limit: result.limit,
      similarity: result.similarity,
      usingReRank: result.usingReRank,
      embeddingTokens: result.embeddingTokens,
      reRankInputTokens: result.reRankInputTokens,
      duration: result.duration || '0s',
      queryExtensionResult: result.queryExtensionResult,
      deepSearchResult: result.deepSearchResult
    };

    res.json({
      code: 200,
      message: 'Advanced search completed',
      data: formattedResult
    });
  } catch (error) {
    next(error);
  }
});

// Deep search endpoint for knowledge base (FastGPT compatibility)
router.post('/deep-search', async (req, res, next) => {
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

    const result = await deepSearch(params, authContext);

    // Format response to match Go backend expectations
    const formattedResult = {
      list: result.searchRes,
      total: result.searchRes.length,
      searchMode: result.searchMode,
      limit: result.limit,
      similarity: result.similarity,
      usingReRank: result.usingReRank,
      embeddingTokens: result.embeddingTokens,
      reRankInputTokens: result.reRankInputTokens,
      duration: result.duration || '0s',
      queryExtensionResult: result.queryExtensionResult,
      deepSearchResult: result.deepSearchResult
    };

    res.json({
      code: 200,
      message: 'Deep search completed',
      data: formattedResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;
