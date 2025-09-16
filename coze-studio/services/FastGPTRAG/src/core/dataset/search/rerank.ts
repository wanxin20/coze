import { SearchDataResponseItemType, SearchScoreTypeEnum } from './newController.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

export interface RerankResult {
  results: SearchDataResponseItemType[];
  inputTokens: number;
}

export interface RerankModelConfig {
  model: string;
  maxInputLength: number;
  endpoint?: string;
  apiKey?: string;
}

// Default rerank models configuration
const RERANK_MODELS: Record<string, RerankModelConfig> = {
  'bge-reranker-base': {
    model: 'bge-reranker-base',
    maxInputLength: 512,
    endpoint: config.oneApiUrl,
    apiKey: config.oneApiKey
  },
  'bge-reranker-large': {
    model: 'bge-reranker-large', 
    maxInputLength: 512,
    endpoint: config.oneApiUrl,
    apiKey: config.oneApiKey
  },
  'bge-reranker-v2-m3': {
    model: 'BAAI/bge-reranker-v2-m3',
    maxInputLength: 8192,
    endpoint: 'https://api.siliconflow.cn/v1',
    apiKey: process.env.SILICONFLOW_API_KEY
  },
  'cohere-rerank-v3': {
    model: 'rerank-english-v3.0',
    maxInputLength: 4096,
    endpoint: 'https://api.cohere.ai/v1/rerank',
    apiKey: process.env.COHERE_API_KEY
  }
};

// Main rerank function
export async function rerankResults(params: {
  query: string;
  results: SearchDataResponseItemType[];
  model?: string;
  maxResults?: number;
  diversityThreshold?: number;
}): Promise<RerankResult> {
  const {
    query,
    results,
    model = 'bge-reranker-v2-m3', // 默认使用硅基流动支持的模型
    maxResults = 50,
    diversityThreshold = 0.85 // 相似度阈值，超过此值的结果将被过滤
  } = params;

  try {
    logger.info(`🎯 Starting rerank with model: ${model}, query: "${query.substring(0, 50)}...", original results: ${results.length}`);
    
    if (results.length === 0) {
      logger.warn('🎯 Rerank skipped: no results to rerank');
      return { results: [], inputTokens: 0 };
    }

    const modelConfig = RERANK_MODELS[model];
    if (!modelConfig) {
      logger.warn(`🎯 Rerank model ${model} not found, falling back to default sorting`);
      return { results, inputTokens: 0 };
    }

    logger.info(`🎯 Using rerank model config:`, {
      model: modelConfig.model,
      endpoint: modelConfig.endpoint,
      hasApiKey: !!modelConfig.apiKey,
      maxInputLength: modelConfig.maxInputLength,
      diversityThreshold
    });

    // Step 1: Remove duplicates based on content similarity
    const deduplicatedResults = removeDuplicateResults(results, diversityThreshold);
    logger.info(`🎯 After deduplication: ${deduplicatedResults.length} results (removed ${results.length - deduplicatedResults.length} duplicates)`);

    // Step 2: Limit results for reranking to avoid API limits
    const limitedResults = deduplicatedResults.slice(0, maxResults);

    // Step 3: Prepare enhanced documents for reranking
    const documents = limitedResults.map((item, index) => ({
      id: item.id,
      text: buildEnhancedRerankText(item, modelConfig.maxInputLength),
      originalIndex: index,
      chunkIndex: item.chunkIndex || 0,
      datasetId: item.datasetId,
      collectionId: item.collectionId
    }));


    // Perform reranking based on model type
    let rerankScores: Array<{ id: string; score: number }> = [];
    let inputTokens = 0;

    if (model.startsWith('bge-') || model === 'bge-reranker-v2-m3') {
      // Using BGE reranker for documents
      const bgeResult = await rerankWithBGE(query, documents, modelConfig);
      rerankScores = bgeResult.scores;
      inputTokens = bgeResult.inputTokens;
      // BGE rerank completed
    } else if (model.startsWith('cohere-')) {
      logger.info(`🎯 Using Cohere reranker for ${documents.length} documents`);
      const cohereResult = await rerankWithCohere(query, documents, modelConfig);
      rerankScores = cohereResult.scores;
      inputTokens = cohereResult.inputTokens;
      logger.info(`🎯 Cohere rerank completed: ${rerankScores.length} scores, ${inputTokens} tokens`);
    } else {
      // Fallback to simple text similarity reranking
      logger.info(`🎯 Using simple similarity reranker for ${documents.length} documents`);
      const simpleResult = rerankWithSimpleSimilarity(query, documents);
      rerankScores = simpleResult.scores;
      inputTokens = simpleResult.inputTokens;
      logger.info(`🎯 Simple rerank completed: ${rerankScores.length} scores`);
    }

    // Apply rerank scores to results with enhanced diversity filtering
    const rerankedResults = rerankScores
      .map((scoreItem, index) => {
        const originalResult = limitedResults.find(r => r.id === scoreItem.id);
        if (!originalResult) {
          logger.warn(`🎯 Could not find original result for id: ${scoreItem.id}`);
          return null;
        }

        const enhancedResult = {
          ...originalResult,
          score: [
            ...originalResult.score,
            {
              type: SearchScoreTypeEnum.reRank,
              value: scoreItem.score,
              index
            }
          ]
        };

        return enhancedResult;
      })
      .filter(Boolean) as SearchDataResponseItemType[];

    // Final diversity check on reranked results
    const finalResults = applyFinalDiversityFilter(rerankedResults, diversityThreshold);
    
    // Rerank completed with diversity filtering
    
    return {
      results: finalResults,
      inputTokens
    };
  } catch (error) {
    logger.error('Failed to rerank results:', error);
    // Return original results on failure
    return { results, inputTokens: 0 };
  }
}

// BGE reranker implementation
async function rerankWithBGE(
  query: string,
  documents: Array<{ id: string; text: string }>,
  config: RerankModelConfig
): Promise<{ scores: Array<{ id: string; score: number }>; inputTokens: number }> {
  try {
    if (!config.endpoint || !config.apiKey) {
      throw new Error('BGE reranker endpoint or API key not configured');
    }

    // 根据不同的API提供商使用不同的请求格式
    let requestBody: any;
    let apiPath: string;
    
    if (config.endpoint?.includes('siliconflow.cn')) {
      // 硅基流动 API 格式
      requestBody = {
        model: config.model,
        query: query,
        documents: documents.map(doc => doc.text)
      };
      apiPath = '/rerank';
    } else {
      // 标准 BGE API 格式
      requestBody = {
        model: config.model,
        query: query,
        documents: documents.map(doc => doc.text),
        top_k: documents.length,
        return_documents: false
      };
      apiPath = '/rerank';
    }
    
    const response = await fetch(`${config.endpoint}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`BGE rerank API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid BGE rerank response format');
    }

    const scores = data.results.map((result: any, index: number) => {
      const score = result.relevance_score || result.score || 0;
      return {
        id: documents[result.index]?.id || documents[index]?.id,
        score: score
      };
    });

    // 获取 token 使用量
    let inputTokens = 0;
    if (config.endpoint?.includes('siliconflow.cn')) {
      // 硅基流动返回的 token 统计
      inputTokens = data.tokens?.input_tokens || 0;
    } else {
      // 其他API估算token使用量
      inputTokens = estimateTokenCount(query + documents.map(d => d.text).join(''));
    }

    return { scores, inputTokens };
  } catch (error) {
    logger.error('BGE rerank failed:', error);
    throw error;
  }
}

// Cohere reranker implementation  
async function rerankWithCohere(
  query: string,
  documents: Array<{ id: string; text: string }>,
  config: RerankModelConfig
): Promise<{ scores: Array<{ id: string; score: number }>; inputTokens: number }> {
  try {
    if (!config.apiKey) {
      throw new Error('Cohere API key not configured');
    }

    const requestBody = {
      model: config.model,
      query: query,
      documents: documents.map(doc => doc.text),
      top_k: documents.length,
      return_documents: false
    };

    const response = await fetch(config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Cohere rerank API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid Cohere rerank response format');
    }

    const scores = data.results.map((result: any) => ({
      id: documents[result.index]?.id,
      score: result.relevance_score || 0
    }));

    return { 
      scores, 
      inputTokens: data.meta?.billed_units?.input_tokens || estimateTokenCount(query + documents.map(d => d.text).join(''))
    };
  } catch (error) {
    logger.error('Cohere rerank failed:', error);
    throw error;
  }
}

// Simple similarity-based reranking fallback
function rerankWithSimpleSimilarity(
  query: string,
  documents: Array<{ id: string; text: string }>
): { scores: Array<{ id: string; score: number }>; inputTokens: number } {
  const queryWords = query.toLowerCase().split(/\s+/);
  
  const scores = documents.map(doc => {
    const docWords = doc.text.toLowerCase().split(/\s+/);
    let score = 0;
    
    // Calculate word overlap score
    queryWords.forEach(word => {
      if (docWords.includes(word)) {
        score += 1;
      }
    });
    
    // Normalize by query length
    score = queryWords.length > 0 ? score / queryWords.length : 0;
    
    // Boost score for exact phrase matches
    if (doc.text.toLowerCase().includes(query.toLowerCase())) {
      score += 0.5;
    }
    
    return { id: doc.id, score };
  });
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  return { scores, inputTokens: 0 };
}

// Utility functions
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Remove duplicate results based on content similarity
 */
function removeDuplicateResults(
  results: SearchDataResponseItemType[],
  similarityThreshold: number = 0.85
): SearchDataResponseItemType[] {
  const uniqueResults: SearchDataResponseItemType[] = [];
  
  for (const result of results) {
    const isDuplicate = uniqueResults.some(existing => {
      const similarity = calculateTextSimilarity(
        `${result.q} ${result.a}`.trim(),
        `${existing.q} ${existing.a}`.trim()
      );
      
      // Also check for exact matches in key fields
      const exactMatch = (
        result.q === existing.q ||
        (result.q && existing.q && result.q.trim() === existing.q.trim()) ||
        (result.a && existing.a && result.a.trim() === existing.a.trim())
      );
      
      return similarity > similarityThreshold || exactMatch;
    });
    
    if (!isDuplicate) {
      uniqueResults.push(result);
    }
  }
  
  return uniqueResults;
}

/**
 * Build enhanced text for reranking that includes more context
 */
function buildEnhancedRerankText(
  item: SearchDataResponseItemType,
  maxLength: number
): string {
  const parts: string[] = [];
  
  // Add question (primary content for matching)
  if (item.q) {
    parts.push(`Question: ${item.q}`);
  }
  
  // Add answer (secondary content)
  if (item.a) {
    parts.push(`Answer: ${item.a}`);
  }
  
  // Add index text if available (additional context)
  if (item.indexes && item.indexes.length > 0) {
    const indexTexts = item.indexes
      .map(idx => idx.text)
      .filter(text => text && text.trim().length > 0)
      .slice(0, 2); // Limit to first 2 index texts
      
    if (indexTexts.length > 0) {
      parts.push(`Context: ${indexTexts.join('; ')}`);
    }
  }
  
  const fullText = parts.join('\n');
  return truncateText(fullText, maxLength);
}

/**
 * Apply final diversity filter to reranked results
 */
function applyFinalDiversityFilter(
  results: SearchDataResponseItemType[],
  diversityThreshold: number = 0.85
): SearchDataResponseItemType[] {
  if (results.length <= 1) return results;
  
  const diverseResults: SearchDataResponseItemType[] = [results[0]]; // Always keep the top result
  
  for (let i = 1; i < results.length; i++) {
    const currentResult = results[i];
    
    const isTooSimilar = diverseResults.some(existing => {
      const similarity = calculateTextSimilarity(
        `${currentResult.q} ${currentResult.a}`.trim(),
        `${existing.q} ${existing.a}`.trim()
      );
      
      return similarity > diversityThreshold;
    });
    
    if (!isTooSimilar) {
      diverseResults.push(currentResult);
    }
  }
  
  return diverseResults;
}

/**
 * Calculate text similarity using Jaccard similarity with character n-grams
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;
  
  // Normalize texts
  const norm1 = text1.toLowerCase().replace(/\s+/g, ' ').trim();
  const norm2 = text2.toLowerCase().replace(/\s+/g, ' ').trim();
  
  if (norm1 === norm2) return 1;
  
  // Use character 3-grams for similarity calculation
  const ngrams1 = generateCharNgrams(norm1, 3);
  const ngrams2 = generateCharNgrams(norm2, 3);
  
  if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
  
  // Calculate Jaccard similarity
  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);
  
  return intersection.size / union.size;
}

/**
 * Generate character n-grams from text
 */
function generateCharNgrams(text: string, n: number): Set<string> {
  const ngrams = new Set<string>();
  
  if (text.length < n) {
    ngrams.add(text);
    return ngrams;
  }
  
  for (let i = 0; i <= text.length - n; i++) {
    ngrams.add(text.substring(i, i + n));
  }
  
  return ngrams;
}

function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for English, ~1.5 for Chinese
  const englishChars = text.replace(/[\u4e00-\u9fff]/g, '').length;
  const chineseChars = text.length - englishChars;
  
  return Math.ceil(englishChars / 4 + chineseChars / 1.5);
}

// Get available rerank models
export function getAvailableRerankModels(): string[] {
  return Object.keys(RERANK_MODELS);
}

// Validate rerank model
export function validateRerankModel(model: string): boolean {
  return model in RERANK_MODELS;
}
