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
}): Promise<RerankResult> {
  const {
    query,
    results,
    model = 'bge-reranker-base',
    maxResults = 50
  } = params;

  try {
    if (results.length === 0) {
      return { results: [], inputTokens: 0 };
    }

    const modelConfig = RERANK_MODELS[model];
    if (!modelConfig) {
      logger.warn(`Rerank model ${model} not found, falling back to default sorting`);
      return { results, inputTokens: 0 };
    }

    // Limit results for reranking to avoid API limits
    const limitedResults = results.slice(0, maxResults);

    // Prepare documents for reranking
    const documents = limitedResults.map(item => ({
      id: item.id,
      text: truncateText(`${item.q}\n${item.a}`, modelConfig.maxInputLength)
    }));

    // Perform reranking based on model type
    let rerankScores: Array<{ id: string; score: number }> = [];
    let inputTokens = 0;

    if (model.startsWith('bge-')) {
      const bgeResult = await rerankWithBGE(query, documents, modelConfig);
      rerankScores = bgeResult.scores;
      inputTokens = bgeResult.inputTokens;
    } else if (model.startsWith('cohere-')) {
      const cohereResult = await rerankWithCohere(query, documents, modelConfig);
      rerankScores = cohereResult.scores;
      inputTokens = cohereResult.inputTokens;
    } else {
      // Fallback to simple text similarity reranking
      const simpleResult = rerankWithSimpleSimilarity(query, documents);
      rerankScores = simpleResult.scores;
      inputTokens = simpleResult.inputTokens;
    }

    // Apply rerank scores to results
    const rerankedResults = rerankScores
      .map((scoreItem, index) => {
        const originalResult = limitedResults.find(r => r.id === scoreItem.id);
        if (!originalResult) return null;

        return {
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
      })
      .filter(Boolean) as SearchDataResponseItemType[];

    return {
      results: rerankedResults,
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

    const requestBody = {
      model: config.model,
      query: query,
      documents: documents.map(doc => doc.text),
      top_k: documents.length,
      return_documents: false
    };

    const response = await fetch(`${config.endpoint}/rerank`, {
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

    const scores = data.results.map((result: any, index: number) => ({
      id: documents[result.index]?.id || documents[index]?.id,
      score: result.relevance_score || 0
    }));

    // Estimate token usage
    const inputTokens = estimateTokenCount(query + documents.map(d => d.text).join(''));

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
