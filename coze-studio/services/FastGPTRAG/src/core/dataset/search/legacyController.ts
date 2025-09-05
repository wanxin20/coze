import { Types } from 'mongoose';
import { MongoDatasetData } from '../data/schema.js';
import { MongoDatasetCollection } from '../collection/schema.js';
import { MongoDataset } from '../schema.js';
import {
  SearchDatasetParams,
  DatasetSearchResult,
  DatasetSchemaType
} from '@/types/dataset.js';
import { AuthContext } from '@/types/common.js';
import { logger } from '@/utils/logger.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText, EmbeddingTypeEnum } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { searchByEmbedding, searchByFullText, mixedSearch } from './utils.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';
import { rerankResults } from './rerank.js';
import { queryExtension } from './queryExtension.js';
import { hashStr } from '@/utils/string.js';

export enum DatasetSearchModeEnum {
  embedding = 'embedding',
  fullTextRecall = 'fullTextRecall', 
  mixedRecall = 'mixedRecall'
}

export enum SearchScoreTypeEnum {
  embedding = 'embedding',
  fullText = 'fullText',
  reRank = 'reRank'
}

export interface SearchDataResponseItemType {
  id: string;
  q: string;
  a: string;
  score: Array<{
    type: SearchScoreTypeEnum;
    value: number;
    index: number;
  }>;
  chunkIndex: number;
  datasetId: string;
  collectionId: string;
  updateTime: Date;
  indexes: Array<{
    type: string;
    dataId: string;
    text: string;
  }>;
  tokens?: number;
}

// 数据集搜索结果合并函数 (RRF - Reciprocal Rank Fusion)
export function datasetSearchResultConcat(
  results: Array<{ k: number; list: SearchDataResponseItemType[] }>
): SearchDataResponseItemType[] {
  const map = new Map<string, { item: SearchDataResponseItemType; rrfScore: number }>();

  results.forEach(({ k, list }) => {
    list.forEach((item, index) => {
      const id = item.id;
      const rrfScore = 1 / (k + index + 1);
      
      if (map.has(id)) {
        const existing = map.get(id)!;
        existing.rrfScore += rrfScore;
      } else {
        map.set(id, { item, rrfScore });
      }
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ item }) => item);
}

// Token 过滤函数
export async function filterDatasetDataByMaxTokens(
  data: SearchDataResponseItemType[],
  maxTokens: number
): Promise<SearchDataResponseItemType[]> {
  // 简化的token计算，实际应该使用tiktoken
  const tokensScoreFilter = data.map(item => ({
    ...item,
    tokens: Math.ceil((item.q + item.a).length / 4) // 简单估算
  }));

  const results: SearchDataResponseItemType[] = [];
  let totalTokens = 0;

  for (const item of tokensScoreFilter) {
    if (totalTokens + item.tokens! > maxTokens && results.length > 0) {
      break;
    }
    results.push(item);
    totalTokens += item.tokens!;
  }

  return results.length === 0 ? data.slice(0, 1) : results;
}

export interface SearchDatasetDataResponse {
  searchRes: SearchDataResponseItemType[];
  embeddingTokens: number;
  reRankInputTokens: number;
  searchMode: DatasetSearchModeEnum;
  limit: number;
  similarity: number;
  usingReRank: boolean;
  usingSimilarityFilter: boolean;
  duration?: string;
  queryExtensionResult?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    query: string;
  };
  deepSearchResult?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
  error?: string; // Optional error field for search test failures
}

// Main search function with enhanced capabilities
export async function searchDataset(
  params: SearchDatasetParams,
  authContext: AuthContext
): Promise<SearchDatasetDataResponse> {
  const startTime = Date.now();
  
  try {
    // Validate IDs using safe validation
    if (!isValidObjectId(params.datasetId)) {
      throw new Error(`Invalid datasetId format: ${params.datasetId}`);
    }
    
    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');
    
    // Verify dataset access
    const dataset = await MongoDataset.findOne({
      _id: safeObjectId(params.datasetId),
      teamId: teamId
    });

    if (!dataset) {
      throw new Error('Dataset not found or access denied');
    }

    const {
      text,
      limit = 20,
      similarity = 0.5,
      searchMode = DatasetSearchModeEnum.embedding,
      usingReRank = false,
      datasetSearchUsingExtensionQuery = false,
      datasetSearchExtensionModel,
      datasetSearchExtensionBg
    } = params;

    // Query extension if enabled
    let queries = [text];
    let queryExtensionResult;
    
    if (datasetSearchUsingExtensionQuery && datasetSearchExtensionModel) {
      const extensionResult = await queryExtension({
        query: text,
        model: datasetSearchExtensionModel,
        background: datasetSearchExtensionBg || '',
        histories: []
      });
      queries = extensionResult.queries;
      queryExtensionResult = extensionResult.aiResult;
    }

    // Perform search based on mode
    let searchResults: SearchDataResponseItemType[] = [];
    let embeddingTokens = 0;
    let reRankInputTokens = 0;

    switch (searchMode) {
      case DatasetSearchModeEnum.embedding:
        const embeddingResult = await searchByEmbedding({
          datasetId: params.datasetId,
          queries,
          limit: limit * 2, // Get more for filtering
          similarity,
          teamId: teamId.toString(),
          vectorModel: dataset.vectorModel
        });
        searchResults = embeddingResult.results;
        embeddingTokens = embeddingResult.tokens;
        break;

      case DatasetSearchModeEnum.fullTextRecall:
        const fullTextResult = await searchByFullText({
          datasetId: params.datasetId,
          queries,
          limit: limit * 2,
          teamId: authContext.teamId
        });
        searchResults = fullTextResult.results;
        break;

      case DatasetSearchModeEnum.mixedRecall:
        const mixedResult = await mixedSearch({
          datasetId: params.datasetId,
          queries,
          limit: limit * 2,
          similarity,
          teamId: teamId.toString(),
          vectorModel: dataset.vectorModel
        });
        searchResults = mixedResult.results;
        embeddingTokens = mixedResult.embeddingTokens;
        break;
    }

    // Apply reranking if enabled
    let finalResults = searchResults;
    if (usingReRank && searchResults.length > 0) {
      const rerankResult = await rerankResults({
        query: text,
        results: searchResults.slice(0, 100), // Limit to top 100 for reranking
        model: 'bge-reranker-base' // Default rerank model
      });
      finalResults = rerankResult.results;
      reRankInputTokens = rerankResult.inputTokens;
    }

    // Apply similarity filter
    const filteredResults = finalResults.filter(item => {
      if (usingReRank) {
        const reRankScore = item.score.find(s => s.type === SearchScoreTypeEnum.reRank);
        return !reRankScore || reRankScore.value >= similarity;
      } else if (searchMode === DatasetSearchModeEnum.embedding) {
        const embeddingScore = item.score.find(s => s.type === SearchScoreTypeEnum.embedding);
        return !embeddingScore || embeddingScore.value >= similarity;
      }
      return true;
    });

    // Limit final results
    const limitedResults = filteredResults.slice(0, limit);

    const duration = `${((Date.now() - startTime) / 1000).toFixed(3)}s`;

    return {
      searchRes: limitedResults,
      embeddingTokens,
      reRankInputTokens,
      searchMode: searchMode as DatasetSearchModeEnum,
      limit,
      similarity,
      usingReRank,
      usingSimilarityFilter: searchMode === DatasetSearchModeEnum.embedding || usingReRank,
      duration,
      queryExtensionResult: queryExtensionResult ? {
        ...queryExtensionResult,
        query: text
      } : undefined
    };
  } catch (error) {
    logger.error('Failed to search dataset:', error);
    throw error;
  }
}

// Search test endpoint for debugging
export async function searchTest(
  params: {
    datasetId: string;
    text: string;
    limit?: number;
    similarity?: number;
    searchMode?: DatasetSearchModeEnum;
    usingReRank?: boolean;
    embeddingWeight?: number;
    rerankWeight?: number;
  },
  authContext: AuthContext
): Promise<SearchDatasetDataResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting search test with params:', {
      datasetId: params.datasetId,
      text: params.text?.substring(0, 50) + '...',
      searchMode: params.searchMode,
      limit: params.limit,
      similarity: params.similarity
    });

    // First check if there's any data in the collection
    const datasetId = safeObjectId(params.datasetId);
    const teamId = safeObjectId(authContext.teamId, '000000000000000000000001');
    
    // Check dataset exists
    const dataset = await MongoDataset.findOne({
      _id: datasetId,
      teamId: teamId
    });

    if (!dataset) {
      logger.error('Dataset not found for search test:', { datasetId: params.datasetId, teamId: authContext.teamId });
      throw new Error('Dataset not found or access denied');
    }

    // Check if there are any data items
    const dataCount = await MongoDatasetData.countDocuments({
      datasetId: datasetId,
      teamId: teamId
    });

    logger.info(`Found ${dataCount} data items in dataset ${params.datasetId}`);

    if (dataCount === 0) {
      logger.warn('No data items found in dataset, returning empty results');
      return {
        searchRes: [],
        embeddingTokens: 0,
        reRankInputTokens: 0,
        searchMode: params.searchMode || DatasetSearchModeEnum.embedding,
        limit: params.limit || 20,
        similarity: params.similarity || 0.5,
        usingReRank: params.usingReRank || false,
        usingSimilarityFilter: true,
        duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`
      };
    }

    // Check vector store status
    try {
      const vectorStore = await getVectorStore();
      logger.info('Vector store connection successful');
      
      // Try a test search to verify vectors exist
      try {
        const testEmbedding = await getVectorsByText({
          model: getEmbeddingModel(dataset.vectorModel || 'text-embedding-v3'),
          input: [params.text],
          type: EmbeddingTypeEnum.query
        });

        const vectorResults = await vectorStore.searchVectors(
          testEmbedding.vectors[0],
          3,
          {
            teamId: teamId.toString(),
            datasetId: params.datasetId
          }
        );

        logger.info(`Vector search returned ${vectorResults.length} results`);
      } catch (vectorError) {
        logger.error('Vector search test failed:', vectorError);
      }
    } catch (vectorStoreError) {
      logger.error('Vector store connection failed:', vectorStoreError);
    }

    // Enhanced search test with detailed metrics
    try {
      const result = await searchDataset({
        ...params,
        datasetSearchUsingExtensionQuery: false
      }, authContext);

      logger.info('Search test completed:', {
        resultCount: result.searchRes.length,
        embeddingTokens: result.embeddingTokens,
        duration: result.duration
      });

      // Add test-specific metadata
      return {
        ...result,
        duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`
      };
    } catch (searchError: any) {
      logger.error('Search test execution failed:', searchError);
      
      // Return a structured error response instead of throwing
      return {
        searchRes: [],
        embeddingTokens: 0,
        reRankInputTokens: 0,
        searchMode: params.searchMode || DatasetSearchModeEnum.embedding,
        limit: params.limit || 20,
        similarity: params.similarity || 0.5,
        usingReRank: params.usingReRank || false,
        usingSimilarityFilter: true,
        duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`,
        error: searchError.message || 'Unknown search error'
      };
    }
  } catch (error) {
    logger.error('Failed to perform search test:', error);
    throw error;
  }
}

// Deep search with multiple query iterations
export async function deepSearch(
  params: {
    datasetId: string;
    text: string;
    limit?: number;
    similarity?: number;
    maxIterations?: number;
    model?: string;
    background?: string;
  },
  authContext: AuthContext
): Promise<SearchDatasetDataResponse> {
  const startTime = Date.now();
  
  try {
    const {
      datasetId,
      text,
      limit = 20,
      similarity = 0.5,
      maxIterations = 3,
      model = 'gpt-4o-mini',
      background = ''
    } = params;

    let allResults: SearchDataResponseItemType[] = [];
    let totalEmbeddingTokens = 0;
    let totalReRankTokens = 0;
    let deepSearchResult;

    // Initial search
    const initialResult = await searchDataset({
      datasetId,
      text,
      limit: limit * 2,
      similarity,
      searchMode: DatasetSearchModeEnum.mixedRecall
    }, authContext);

    allResults = initialResult.searchRes;
    totalEmbeddingTokens += initialResult.embeddingTokens;

    // Deep search iterations
    for (let i = 0; i < maxIterations && allResults.length < limit * 3; i++) {
      try {
        // Generate follow-up query based on current results
        const contextTexts = allResults.slice(0, 5).map(r => r.q).join('\n');
        const followUpQuery = await generateFollowUpQuery({
          originalQuery: text,
          context: contextTexts,
          background,
          model
        });

        if (followUpQuery.query && followUpQuery.query !== text) {
          const iterationResult = await searchDataset({
            datasetId,
            text: followUpQuery.query,
            limit: 10,
            similarity,
            searchMode: DatasetSearchModeEnum.embedding
          }, authContext);

          // Merge results, avoiding duplicates
          const existingIds = new Set(allResults.map(r => r.id));
          const newResults = iterationResult.searchRes.filter(r => !existingIds.has(r.id));
          allResults = allResults.concat(newResults);
          totalEmbeddingTokens += iterationResult.embeddingTokens;

          deepSearchResult = {
            model: followUpQuery.model,
            inputTokens: followUpQuery.inputTokens,
            outputTokens: followUpQuery.outputTokens
          };
        }
      } catch (error) {
        logger.warn(`Deep search iteration ${i + 1} failed:`, error);
        break;
      }
    }

    // Final ranking and limiting
    const finalResults = allResults
      .sort((a, b) => {
        const aScore = a.score[0]?.value || 0;
        const bScore = b.score[0]?.value || 0;
        return bScore - aScore;
      })
      .slice(0, limit);

    return {
      searchRes: finalResults,
      embeddingTokens: totalEmbeddingTokens,
      reRankInputTokens: totalReRankTokens,
      searchMode: DatasetSearchModeEnum.mixedRecall,
      limit,
      similarity,
      usingReRank: false,
      usingSimilarityFilter: true,
      duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`,
      deepSearchResult
    };
  } catch (error) {
    logger.error('Failed to perform deep search:', error);
    throw error;
  }
}

// Advanced search with collection filters
export async function advancedSearch(
  params: {
    datasetId: string;
    text: string;
    limit?: number;
    similarity?: number;
    collectionIds?: string[];
    tags?: string[];
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    searchMode?: DatasetSearchModeEnum;
    usingReRank?: boolean;
  },
  authContext: AuthContext
): Promise<SearchDatasetDataResponse> {
  const startTime = Date.now();
  
  try {
    // Build collection filter
    let targetCollectionIds: string[] | undefined;
    
    if (params.collectionIds || params.tags || params.dateRange) {
      const filter: any = {
        datasetId: new Types.ObjectId(params.datasetId),
        teamId: new Types.ObjectId(authContext.teamId)
      };

      if (params.collectionIds) {
        filter._id = { $in: params.collectionIds.map(id => new Types.ObjectId(id)) };
      }

      if (params.tags && params.tags.length > 0) {
        filter.tags = { $in: params.tags };
      }

      if (params.dateRange) {
        filter.createTime = {};
        if (params.dateRange.start) filter.createTime.$gte = params.dateRange.start;
        if (params.dateRange.end) filter.createTime.$lte = params.dateRange.end;
      }

      const collections = await MongoDatasetCollection.find(filter, '_id');
      targetCollectionIds = collections.map(c => c._id.toString());

      if (targetCollectionIds.length === 0) {
        // No collections match the filter
        return {
          searchRes: [],
          embeddingTokens: 0,
          reRankInputTokens: 0,
          searchMode: params.searchMode || DatasetSearchModeEnum.embedding,
          limit: params.limit || 20,
          similarity: params.similarity || 0.5,
          usingReRank: params.usingReRank || false,
          usingSimilarityFilter: true,
          duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`
        };
      }
    }

    // Perform search with collection filter
    const searchResult = await searchDataset({
      ...params,
      datasetId: params.datasetId,
      text: params.text
    }, authContext);

    // Filter results by collection if needed
    let filteredResults = searchResult.searchRes;
    if (targetCollectionIds) {
      const collectionIdSet = new Set(targetCollectionIds);
      filteredResults = searchResult.searchRes.filter(result => 
        collectionIdSet.has(result.collectionId)
      );
    }

    return {
      ...searchResult,
      searchRes: filteredResults,
      duration: `${((Date.now() - startTime) / 1000).toFixed(3)}s`
    };
  } catch (error) {
    logger.error('Failed to perform advanced search:', error);
    throw error;
  }
}

// Helper function to generate follow-up queries for deep search
async function generateFollowUpQuery(params: {
  originalQuery: string;
  context: string;
  background: string;
  model: string;
}): Promise<{
  query: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}> {
  // TODO: Implement AI-powered query generation
  // For now, return a simple variation
  return {
    query: `${params.originalQuery} related information`,
    model: params.model,
    inputTokens: 100,
    outputTokens: 20
  };
}
