import axios from 'axios';
import { EmbeddingModel } from '@/types/common.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export enum EmbeddingTypeEnum {
  db = 'db',
  query = 'query'
}

interface GetVectorProps {
  model: EmbeddingModel;
  input: string[] | string;
  type?: EmbeddingTypeEnum;
  headers?: Record<string, string>;
}

export async function getVectorsByText({ model, input, type, headers }: GetVectorProps) {
  if (!input) {
    throw new Error('Input is empty');
  }

  const formatInput = Array.isArray(input) ? input : [input];
  const chunkSize = 5; // Process multiple items for better performance

  const chunks = [];
  for (let i = 0; i < formatInput.length; i += chunkSize) {
    chunks.push(formatInput.slice(i, i + chunkSize));
  }

  try {
    let totalTokens = 0;
    const allVectors: number[][] = [];

    for (const chunk of chunks) {
      let requestData: any = {
        ...model.defaultConfig,
        ...(type === EmbeddingTypeEnum.db && model.dbConfig),
        ...(type === EmbeddingTypeEnum.query && model.queryConfig),
        model: model.model,
        input: chunk
      };

      // Handle different API formats
      if (model.provider === 'Alibaba') {
        // Use OpenAI compatible format for Alibaba DashScope
        requestData = {
          model: 'text-embedding-v3',  // Use correct Alibaba model name
          input: chunk,
          encoding_format: 'float'
        };
      }

      // Handle different authentication methods
      let authHeader = `Bearer ${config.oneApiKey}`;
      
      if (model.requestAuth) {
        // Replace placeholders in the auth string
        let authString = model.requestAuth;
        if (authString.includes('${ALIBABA_API_KEY}')) {
          authString = authString.replace('${ALIBABA_API_KEY}', config.alibabaApiKey);
        }
        if (authString.includes('${ZHIPU_API_KEY}')) {
          authString = authString.replace('${ZHIPU_API_KEY}', config.zhipuApiKey);
        }
        authHeader = authString;
      }

      const requestConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          ...headers
        }
      };

      // Use model-specific URL or fall back to OneAPI URL
      let url = model.requestUrl || `${config.oneApiUrl}/embeddings`;
      
      // Special handling for Alibaba models
      if (model.provider === 'Alibaba' && !model.requestUrl) {
        // If alibabaApiUrl already contains '/v1', don't add '/embeddings'
        if (config.alibabaApiUrl.includes('/v1')) {
          url = `${config.alibabaApiUrl}/embeddings`;
        } else {
          url = `${config.alibabaApiUrl}/embeddings`;
        }
      }
      
      // Add retry mechanism for network errors
      let response: any;
      const maxRetries = 3;
      
      logger.info(`Making embedding request to: ${url}`, {
        model: model.model,
        provider: model.provider,
        inputLength: Array.isArray(requestData.input) ? requestData.input.length : 1,
        authHeader: authHeader.substring(0, 20) + '...'
      });

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await axios.post(url, requestData, {
            ...requestConfig,
            timeout: 30000, // 30 second timeout
            maxRedirects: 3
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          // Check if it's a retryable error
          const isRetryable = error.code === 'ETIMEDOUT' || 
                             error.code === 'ENOTFOUND' || 
                             error.code === 'ECONNRESET' ||
                             (error.response && [500, 502, 503, 504].includes(error.response.status));
          
          if (!isRetryable || attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.warn(`API request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, {
            error: error.message,
            code: error.code,
            status: error.response?.status,
            data: error.response?.data
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response after retries');
      }

      let vectors: number[][];
      
      // Handle OpenAI compatible response format (works for both OpenAI and Alibaba compatible mode)
      if (!response.data?.data) {
        throw new Error('Invalid response from embedding API');
      }
      vectors = response.data.data.map((item: any) => 
        formatVectors(item.embedding, true)
      );
      
      allVectors.push(...vectors);
      totalTokens += response.data.usage?.total_tokens || 0;
    }

    return {
      vectors: allVectors,
      tokens: totalTokens
    };
  } catch (error) {
    logger.error('Error getting vectors:', error);
    throw error;
  }
}

export function formatVectors(vector: number[], normalization = false) {
  // normalization processing
  function normalizationVector(vector: number[]) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) {
      return vector;
    }
    return vector.map((val) => val / norm);
  }

  // Don't force 1536 dimensions, use original vector dimensions
  // Most modern vector databases can handle different dimensions
  if (normalization) {
    return normalizationVector(vector);
  }

  return vector;
}

// Get embedding model configuration
export function getEmbeddingModel(modelName: string): EmbeddingModel {
  // Model name mapping for compatibility
  const modelMappings: Record<string, string> = {
    'text-embedding-3-small': 'text-embedding-v3',  // Map OpenAI model to Alibaba model
    'text-embedding-3-large': 'text-embedding-v3',  // Map OpenAI model to Alibaba model  
    'text-embedding-ada-002': 'text-embedding-v3',  // Map OpenAI model to Alibaba model
    'embedding-2': 'text-embedding-v3'               // Legacy mapping
  };
  
  // Apply model mapping if exists
  const mappedModelName = modelMappings[modelName] || modelName;
  
  // Use models from the main config instead of local defaults
  let model = config.vectorModels.find(m => m.model === mappedModelName);
  
  // Fallback to first available model if not found
  if (!model) {
    model = config.vectorModels[0];
    logger.warn(`Model ${modelName} (mapped to ${mappedModelName}) not found, using fallback: ${model.model}`);
  }
  
  // Log model selection for debugging
  logger.info(`Selected embedding model: ${model.model} (provider: ${model.provider})`, {
    requestedModel: modelName,
    mappedModel: mappedModelName,
    selectedModel: model.model,
    availableModels: config.vectorModels.map(m => m.model)
  });
  
  return model;
}

// Calculate token count for text
export function countTokens(text: string): number {
  // Simple approximation: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4);
}
