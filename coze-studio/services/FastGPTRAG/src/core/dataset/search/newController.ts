import { Types } from 'mongoose';
import { MongoDatasetData } from '../data/schema.js';
import { MongoDatasetCollection } from '../collection/schema.js';
import { MongoDataset } from '../schema.js';
import {
  SearchDatasetParams,
  DatasetSearchResult,
  DatasetSchemaType,
  DatasetSearchModeEnum
} from '@/types/dataset.js';
import { AuthContext } from '@/types/common.js';
import { logger } from '@/utils/logger.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText, EmbeddingTypeEnum } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { searchByEmbedding, searchByFullText } from './utils.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';
import { rerankResults } from './rerank.js';
import { queryExtension } from './queryExtension.js';
import { hashStr, countTokens } from '@/utils/string.js';

// DatasetSearchModeEnum is now imported from @/types/dataset.js

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
  const tokensScoreFilter = await Promise.all(
    data.map(async item => ({
      ...item,
      tokens: countTokens(item.q + item.a)
    }))
  );

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

// 主搜索函数 - 完全复现原版FastGPT逻辑
export async function searchDatasetData(
  params: {
    teamId: string;
    datasetIds: string[];
    query: string;
    queries: string[];
    reRankQuery: string;
    limit: number;
    similarity: number;
    searchMode: DatasetSearchModeEnum;
    embeddingWeight?: number;
    usingReRank?: boolean;
    rerankWeight?: number;
    datasetSearchUsingExtensionQuery?: boolean;
    datasetSearchExtensionModel?: string;
    datasetSearchExtensionBg?: string;
  }
): Promise<SearchDatasetDataResponse> {
  const {
    teamId,
    datasetIds,
    query,
    queries,
    reRankQuery,
    limit: maxTokens = 1500,
    similarity = 0.5,
    searchMode = DatasetSearchModeEnum.embedding,
    embeddingWeight = 0.5,
    usingReRank = false,
    rerankWeight = 0.5
  } = params;

  const startTime = Date.now();
  
  try {
    // 初始化结果容器
    let embeddingRecallResults: SearchDataResponseItemType[] = [];
    let fullTextRecallResults: SearchDataResponseItemType[] = [];
    let reRankResults: SearchDataResponseItemType[] = [];
    let embeddingTokens = 0;
    let reRankInputTokens = 0;
    let usingSimilarityFilter = false;

    // Embedding 召回
    if (searchMode === DatasetSearchModeEnum.embedding || searchMode === DatasetSearchModeEnum.mixedRecall) {
      try {
        const allEmbeddingResults: SearchDataResponseItemType[] = [];
        
        for (const datasetId of datasetIds) {
          const dataset = await MongoDataset.findOne({
            _id: safeObjectId(datasetId),
            teamId: safeObjectId(teamId)
          });
          
          if (!dataset) continue;

          const embeddingResult = await searchByEmbedding({
            datasetId,
            queries,
            limit: 100,
            similarity: 0,
            teamId,
            vectorModel: dataset.vectorModel
          });
          
          allEmbeddingResults.push(...embeddingResult.results);
          embeddingTokens += embeddingResult.tokens;
        }
        
        embeddingRecallResults = allEmbeddingResults;
      } catch (error) {
        logger.warn('Embedding recall failed:', error);
      }
    }

    // 全文召回
    if (searchMode === DatasetSearchModeEnum.fullTextRecall || searchMode === DatasetSearchModeEnum.mixedRecall) {
      try {
        const allFullTextResults: SearchDataResponseItemType[] = [];
        
        for (const datasetId of datasetIds) {
          const fullTextResult = await searchByFullText({
            datasetId,
            queries,
            limit: 100,
            teamId
          });
          
          allFullTextResults.push(...fullTextResult.results);
        }
        
        fullTextRecallResults = allFullTextResults;
      } catch (error) {
        logger.warn('Full text recall failed:', error);
      }
    }

    // 重排序
    if (usingReRank && (embeddingRecallResults.length > 0 || fullTextRecallResults.length > 0)) {
      try {
        const allResults = [...embeddingRecallResults, ...fullTextRecallResults];
        const uniqueResults = new Map<string, SearchDataResponseItemType>();
        
        allResults.forEach(item => {
          if (!uniqueResults.has(item.id)) {
            uniqueResults.set(item.id, item);
          }
        });

        const resultsForRerank = Array.from(uniqueResults.values()).slice(0, 100);
        
        if (resultsForRerank.length > 0) {
          const rerankResult = await rerankResults({
            query: reRankQuery,
            results: resultsForRerank,
            model: 'bge-reranker-base'
          });
          reRankResults = rerankResult.results;
          reRankInputTokens = rerankResult.inputTokens;
        }
      } catch (error) {
        logger.warn('Rerank failed:', error);
      }
    }

    // RRF 合并结果
    const baseK = 120;
    const embK = Math.round(baseK * (1 - embeddingWeight));
    const fullTextK = Math.round(baseK * embeddingWeight);

    const rrfSearchResult = datasetSearchResultConcat([
      { k: embK, list: embeddingRecallResults },
      { k: fullTextK, list: fullTextRecallResults }
    ]);

    // 最终结果合并
    const rrfConcatResults = (() => {
      if (reRankResults.length === 0) return rrfSearchResult;
      if (rerankWeight === 1) return reRankResults;

      const searchK = Math.round(baseK * rerankWeight);
      const rerankK = Math.round(baseK * (1 - rerankWeight));

      return datasetSearchResultConcat([
        { k: searchK, list: rrfSearchResult },
        { k: rerankK, list: reRankResults }
      ]);
    })();

    // 去重 - 移除相同的q和a数据
    const set = new Set<string>();
    const filterSameDataResults = rrfConcatResults.filter((item) => {
      const str = hashStr(`${item.q}${item.a}`.replace(/[^\p{L}\p{N}]/gu, ''));
      if (set.has(str)) return false;
      set.add(str);
      return true;
    });

    // 相似度过滤
    const scoreFilter = (() => {
      if (usingReRank) {
        usingSimilarityFilter = true;
        return filterSameDataResults.filter((item) => {
          const reRankScore = item.score.find((score) => score.type === SearchScoreTypeEnum.reRank);
          if (reRankScore && reRankScore.value < similarity) return false;
          return true;
        });
      }
      if (searchMode === DatasetSearchModeEnum.embedding) {
        usingSimilarityFilter = true;
        return filterSameDataResults.filter((item) => {
          const embeddingScore = item.score.find(
            (score) => score.type === SearchScoreTypeEnum.embedding
          );
          if (embeddingScore && embeddingScore.value < similarity) return false;
          return true;
        });
      }
      return filterSameDataResults;
    })();

    // Token限制过滤
    const filterMaxTokensResult = await filterDatasetDataByMaxTokens(scoreFilter, maxTokens);

    const endTime = Date.now();
    logger.info(`Dataset search completed in ${endTime - startTime}ms`, {
      datasetIds,
      query,
      mode: searchMode,
      resultsCount: filterMaxTokensResult.length,
      embeddingRecall: embeddingRecallResults.length,
      fullTextRecall: fullTextRecallResults.length,
      reRankResults: reRankResults.length
    });

    return {
      searchRes: filterMaxTokensResult,
      embeddingTokens,
      reRankInputTokens,
      searchMode,
      limit: maxTokens,
      similarity,
      usingReRank,
      usingSimilarityFilter
    };

  } catch (error) {
    logger.error('Dataset search failed:', error);
    throw error;
  }
}

// 默认搜索函数，带查询扩展
export async function defaultSearchDatasetData(params: {
  teamId: string;
  datasetIds: string[];
  query: string;
  limit?: number;
  similarity?: number;
  searchMode?: DatasetSearchModeEnum;
  embeddingWeight?: number;
  usingReRank?: boolean;
  rerankWeight?: number;
  datasetSearchUsingExtensionQuery?: boolean;
  datasetSearchExtensionModel?: string;
  datasetSearchExtensionBg?: string;
}): Promise<SearchDatasetDataResponse> {
  const {
    query,
    datasetSearchUsingExtensionQuery,
    datasetSearchExtensionModel,
    datasetSearchExtensionBg,
    ...restParams
  } = params;

  // 查询扩展
  let queries = [query];
  let reRankQuery = query;
  let queryExtensionResult;

  if (datasetSearchUsingExtensionQuery && datasetSearchExtensionModel) {
    try {
      const extensionResult = await queryExtension({
        query,
        model: datasetSearchExtensionModel,
        background: datasetSearchExtensionBg || '',
        histories: []
      });
      queries = extensionResult.queries;
      reRankQuery = extensionResult.queries[0] || query;
      queryExtensionResult = extensionResult.aiResult;
    } catch (error) {
      logger.warn('Query extension failed:', error);
    }
  }

  const result = await searchDatasetData({
    ...restParams,
    query,
    queries,
    reRankQuery,
    limit: restParams.limit || 1500,
    similarity: restParams.similarity || 0.5,
    searchMode: restParams.searchMode || DatasetSearchModeEnum.embedding
  });

  return {
    ...result,
    queryExtensionResult: queryExtensionResult ? {
      ...queryExtensionResult,
      query
    } : undefined
  };
}

// 向后兼容的搜索函数
export async function searchDataset(
  params: SearchDatasetParams,
  authContext: AuthContext
): Promise<SearchDatasetDataResponse> {
  return await defaultSearchDatasetData({
    teamId: authContext.teamId,
    datasetIds: [params.datasetId],
    query: params.text,
    limit: params.limit,
    similarity: params.similarity,
    searchMode: params.searchMode as DatasetSearchModeEnum,
    usingReRank: params.usingReRank,
    datasetSearchUsingExtensionQuery: params.datasetSearchUsingExtensionQuery,
    datasetSearchExtensionModel: params.datasetSearchExtensionModel,
    datasetSearchExtensionBg: params.datasetSearchExtensionBg
  });
}
