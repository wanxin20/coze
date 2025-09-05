import { Types } from 'mongoose';
import { MongoDatasetData } from '../data/schema.js';
import { MongoDatasetCollection } from '../collection/schema.js';
import { SearchDataResponseItemType, SearchScoreTypeEnum } from './newController.js';
import { logger } from '@/utils/logger.js';
import { getVectorStore } from '@/core/vectorstore/index.js';
import { getVectorsByText, EmbeddingTypeEnum } from '@/core/embedding/index.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { safeObjectId, isValidObjectId } from '@/utils/objectId.js';

// Search by embedding vectors
export async function searchByEmbedding(params: {
  datasetId: string;
  queries: string[];
  limit: number;
  similarity: number;
  teamId: string;
  vectorModel: string;
}): Promise<{
  results: SearchDataResponseItemType[];
  tokens: number;
}> {
  const { datasetId, queries, limit, similarity, teamId, vectorModel } = params;

  try {
    // Get embeddings for all queries
    const embeddingModel = getEmbeddingModel(vectorModel);
    const { vectors, tokens } = await getVectorsByText({
      model: embeddingModel,
      input: queries,
      type: EmbeddingTypeEnum.query
    });

    // Search vectors for each query
    const vectorStore = await getVectorStore();
    const searchResults: Array<{
      id: string;
      score: number;
      collectionId: string;
    }> = [];

    for (const vector of vectors) {
      const vectorResults = await vectorStore.searchVectors(
        vector,
        Math.ceil(limit / queries.length),
        {
          teamId,
          datasetId
        }
      );
      searchResults.push(...vectorResults.map((r: any) => ({
        id: r.id,
        score: r.score,
        collectionId: r.collectionId || r.datasetId || ''
      })));
    }

    // Remove duplicates and sort by score
    const uniqueResults = new Map<string, { score: number; collectionId: string }>();
    searchResults.forEach(result => {
      if (!uniqueResults.has(result.id) || uniqueResults.get(result.id)!.score < result.score) {
        uniqueResults.set(result.id, { score: result.score, collectionId: result.collectionId });
      }
    });

    // Filter by similarity and limit
    const sortedResults = Array.from(uniqueResults.entries())
      .sort((a, b) => b[1].score - a[1].score);
    
    logger.info(`Vector search filtering: ${sortedResults.length} total results, similarity threshold: ${similarity}`);
    if (sortedResults.length > 0) {
      logger.info(`Top result score: ${sortedResults[0][1].score}, matches threshold: ${sortedResults[0][1].score >= similarity}`);
    }
    
    const filteredResults = sortedResults
      .filter(([_, result]) => result.score >= similarity)
      .slice(0, limit);

    if (filteredResults.length === 0) {
      return { results: [], tokens };
    }

    // Get data details
    const dataIds = filteredResults.map(([id]) => id);
    logger.info(`Searching for data items with vectorIds: ${dataIds.slice(0, 3)}`);
    
    const dataItems = await MongoDatasetData.find({
      'indexes.dataId': { $in: dataIds },
      teamId: safeObjectId(teamId),
      datasetId: safeObjectId(datasetId)
    }).lean();

    logger.info(`Found ${dataItems.length} data items in database`);
    if (dataItems.length > 0) {
      logger.info(`Sample data item indexes: ${JSON.stringify(dataItems[0].indexes.map(idx => idx.dataId))}`);
    }

    // Map results to response format
    const results: SearchDataResponseItemType[] = [];
    for (const [vectorId, vectorData] of filteredResults) {
      const dataItem = dataItems.find(item => 
        item.indexes.some(index => index.dataId === vectorId)
      );

      if (dataItem) {
        const index = dataItem.indexes.find(idx => idx.dataId === vectorId);
        results.push({
          id: dataItem._id.toString(),
          q: dataItem.q,
          a: dataItem.a || '',
          score: [{
            type: SearchScoreTypeEnum.embedding,
            value: vectorData.score,
            index: results.length
          }],
          chunkIndex: dataItem.chunkIndex,
          datasetId: dataItem.datasetId.toString(),
          collectionId: dataItem.collectionId.toString(),
          updateTime: dataItem.updateTime,
          indexes: dataItem.indexes
        });
      } else {
        logger.warn(`No data item found for vectorId: ${vectorId}`);
      }
    }

    logger.info(`Final search results: ${results.length} items mapped from ${filteredResults.length} vector results`);

    return { results, tokens };
  } catch (error) {
    logger.error('Failed to search by embedding:', error);
    throw error;
  }
}

// Search by full text
export async function searchByFullText(params: {
  datasetId: string;
  queries: string[];
  limit: number;
  teamId: string;
}): Promise<{
  results: SearchDataResponseItemType[];
}> {
  const { datasetId, queries, limit, teamId } = params;

  try {
    const allResults: Array<{
      dataItem: any;
      score: number;
    }> = [];

    // Search for each query
    for (const query of queries) {
      const results = await MongoDatasetData.find({
        $text: { $search: query },
        teamId: safeObjectId(teamId),
        datasetId: safeObjectId(datasetId)
      }, {
        score: { $meta: 'textScore' }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(Math.ceil(limit / queries.length))
      .lean();

      allResults.push(...results.map(item => ({
        dataItem: item,
        score: (item as any).score || 0
      })));
    }

    // Remove duplicates and sort
    const uniqueResults = new Map<string, { dataItem: any; score: number }>();
    allResults.forEach(result => {
      const id = result.dataItem._id.toString();
      if (!uniqueResults.has(id) || uniqueResults.get(id)!.score < result.score) {
        uniqueResults.set(id, result);
      }
    });

    // Sort and limit
    const sortedResults = Array.from(uniqueResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Map to response format
    const results: SearchDataResponseItemType[] = sortedResults.map((result, index) => ({
      id: result.dataItem._id.toString(),
      q: result.dataItem.q,
      a: result.dataItem.a || '',
      score: [{
        type: SearchScoreTypeEnum.fullText,
        value: result.score,
        index
      }],
      chunkIndex: result.dataItem.chunkIndex,
      datasetId: result.dataItem.datasetId.toString(),
      collectionId: result.dataItem.collectionId.toString(),
      updateTime: result.dataItem.updateTime,
      indexes: result.dataItem.indexes
    }));

    return { results };
  } catch (error) {
    logger.error('Failed to search by full text:', error);
    throw error;
  }
}

// Mixed search combining embedding and full text
export async function mixedSearch(params: {
  datasetId: string;
  queries: string[];
  limit: number;
  similarity: number;
  teamId: string;
  vectorModel: string;
  embeddingWeight?: number;
}): Promise<{
  results: SearchDataResponseItemType[];
  embeddingTokens: number;
}> {
  const { 
    datasetId, 
    queries, 
    limit, 
    similarity, 
    teamId, 
    vectorModel,
    embeddingWeight = 0.7 
  } = params;

  try {
    // Perform both searches in parallel
    const [embeddingResult, fullTextResult] = await Promise.all([
      searchByEmbedding({
        datasetId,
        queries,
        limit: Math.ceil(limit * 1.5),
        similarity,
        teamId,
        vectorModel
      }),
      searchByFullText({
        datasetId,
        queries,
        limit: Math.ceil(limit * 1.5),
        teamId
      })
    ]);

    // Combine results using RRF (Reciprocal Rank Fusion)
    const combinedResults = combineSearchResults([
      { results: embeddingResult.results, weight: embeddingWeight },
      { results: fullTextResult.results, weight: 1 - embeddingWeight }
    ]);

    // Limit final results
    const finalResults = combinedResults.slice(0, limit);

    return {
      results: finalResults,
      embeddingTokens: embeddingResult.tokens
    };
  } catch (error) {
    logger.error('Failed to perform mixed search:', error);
    throw error;
  }
}

// Combine search results using Reciprocal Rank Fusion
function combineSearchResults(
  resultSets: Array<{
    results: SearchDataResponseItemType[];
    weight: number;
  }>
): SearchDataResponseItemType[] {
  const k = 60; // RRF parameter
  const scoreMap = new Map<string, {
    item: SearchDataResponseItemType;
    totalScore: number;
    scores: Array<{ type: SearchScoreTypeEnum; value: number; index: number }>;
  }>();

  // Calculate RRF scores
  resultSets.forEach(({ results, weight }) => {
    results.forEach((item, rank) => {
      const id = item.id;
      const rrfScore = weight / (k + rank + 1);
      
      if (!scoreMap.has(id)) {
        scoreMap.set(id, {
          item,
          totalScore: 0,
          scores: [...item.score]
        });
      }
      
      const entry = scoreMap.get(id)!;
      entry.totalScore += rrfScore;
      
      // Add scores from different search methods
      item.score.forEach(score => {
        const existingScore = entry.scores.find(s => s.type === score.type);
        if (!existingScore) {
          entry.scores.push(score);
        } else if (existingScore.value < score.value) {
          existingScore.value = score.value;
          existingScore.index = score.index;
        }
      });
    });
  });

  // Sort by combined score and return
  return Array.from(scoreMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry, index) => ({
      ...entry.item,
      score: entry.scores.map(score => ({ ...score, index }))
    }));
}

// Text preprocessing for better search
export function preprocessSearchText(text: string): string {
  // Remove special characters, normalize whitespace
  return text
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep letters, numbers, spaces, and Chinese characters
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Calculate search relevance score
export function calculateRelevanceScore(
  query: string,
  text: string,
  method: 'embedding' | 'fulltext' = 'fulltext'
): number {
  if (method === 'fulltext') {
    const queryWords = preprocessSearchText(query).split(' ');
    const textWords = preprocessSearchText(text).split(' ');
    
    let matches = 0;
    queryWords.forEach(word => {
      if (textWords.includes(word)) {
        matches++;
      }
    });
    
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }
  
  return 0; // For embedding, this would be calculated by the vector database
}

// Get collection source data for search results
export function getCollectionSourceData(collection: any) {
  return {
    sourceName: collection.name,
    sourceId: collection.fileId || collection.rawLink || collection._id,
    collectionId: collection._id
  };
}
