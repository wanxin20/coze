import { EmbeddingModel, LLMModel } from '@/types/common';

// Forward declarations
const defaultVectorModels: EmbeddingModel[] = [
  {
    provider: 'OpenAI',
    model: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    maxToken: 3000,
    defaultToken: 512,
    weight: 100,
    defaultConfig: {}
  },
  {
    provider: 'OpenAI',
    model: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    maxToken: 3000,
    defaultToken: 512,
    weight: 100,
    defaultConfig: {
      dimensions: 1024
    }
  },
  {
    provider: 'OpenAI',
    model: 'text-embedding-ada-002',
    name: 'Embedding-2',
    maxToken: 3000,
    defaultToken: 700,
    weight: 100,
    defaultConfig: {}
  },
  {
    provider: 'Alibaba',
    model: 'text-embedding-v3',
    name: '阿里-emb3',
    maxToken: 2048,
    defaultToken: 512,
    weight: 100,
    requestUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
    requestAuth: 'Bearer ${ALIBABA_API_KEY}',
    defaultConfig: {
      model: 'text-embedding-v3'
    }
  },
  // 注意：qwen-max 是LLM模型，不应该在向量模型列表中
  // 如需阿里云embedding，请使用 text-embedding-v3
];

const defaultLlmModels: LLMModel[] = [
  {
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    name: 'gpt-4o-mini',
    maxContext: 128000,
    maxResponse: 16000,
    quoteMaxToken: 120000,
    maxTemperature: 1.2,
    charsPointsPrice: 0,
    censor: false,
    vision: false,
    datasetProcess: true,
    usedInClassify: true,
    usedInExtractFields: true,
    usedInToolCall: true,
    toolChoice: true,
    functionCall: false,
    defaultConfig: {
      temperature: 1,
      max_tokens: null,
      stream: false
    }
  },
  {
    provider: 'OpenAI',
    model: 'gpt-4o',
    name: 'gpt-4o',
    maxContext: 128000,
    maxResponse: 16000,
    quoteMaxToken: 120000,
    maxTemperature: 1.2,
    charsPointsPrice: 0,
    censor: false,
    vision: true,
    datasetProcess: true,
    usedInClassify: true,
    usedInExtractFields: true,
    usedInToolCall: true,
    toolChoice: true,
    functionCall: false,
    defaultConfig: {
      temperature: 1,
      max_tokens: null,
      stream: false
    }
  },
  {
    provider: 'Zhipu',
    model: 'glm-4v-flash',
    name: 'GLM-4V-Flash',
    maxContext: 32000,
    maxResponse: 8000,
    quoteMaxToken: 28000,
    maxTemperature: 1.0,
    charsPointsPrice: 0,
    censor: false,
    vision: true,
    datasetProcess: true,
    usedInClassify: true,
    usedInExtractFields: true,
    usedInToolCall: true,
    toolChoice: true,
    functionCall: false,
    defaultConfig: {
      temperature: 0.7,
      max_tokens: null,
      stream: false
    }
  },
  {
    provider: 'Alibaba',
    model: 'qwen-max',
    name: 'Qwen-Max',
    maxContext: 30000,
    maxResponse: 8000,
    quoteMaxToken: 28000,
    maxTemperature: 2.0,
    charsPointsPrice: 0,
    censor: false,
    vision: false,
    datasetProcess: true,
    usedInClassify: true,
    usedInExtractFields: true,
    usedInToolCall: true,
    toolChoice: true,
    functionCall: false,
    requestUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    requestAuth: 'Bearer ${ALIBABA_API_KEY}',
    defaultConfig: {
      temperature: 0.8,
      max_tokens: null,
      stream: false
    }
  }
];

// Environment configuration
export const config = {
  // Server
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/fastgpt-rag',
  mongoLogUrl: process.env.MONGO_LOG_URL || 'mongodb://localhost:27017/fastgpt-rag-logs',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Vector Database
  pgUrl: process.env.PG_URL,
  milvusUrl: process.env.MILVUS_URL || 'localhost:19530',
  milvusUsername: process.env.MILVUS_USERNAME || '',
  milvusPassword: process.env.MILVUS_PASSWORD || '',

  // AI Models
  oneApiUrl: process.env.ONEAPI_URL || 'https://api.openai.com/v1',
  oneApiKey: process.env.ONEAPI_KEY || '',

  // Alibaba DashScope API (Direct API)
  alibabaApiKey: process.env.ALIBABA_API_KEY || '',
  alibabaApiUrl: process.env.ALIBABA_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',

  // Zhipu AI API (Direct API)
  zhipuApiKey: process.env.ZHIPU_API_KEY || '',
  zhipuApiUrl: process.env.ZHIPU_API_URL || 'https://open.bigmodel.cn/api/paas/v4',

  // Default Models
  defaultVectorModel: process.env.DEFAULT_VECTOR_MODEL || 'text-embedding-v3',
  defaultLlmModel: process.env.DEFAULT_LLM_MODEL || 'qwen-max',
  defaultVlmModel: process.env.DEFAULT_VLM_MODEL || 'glm-4v-flash',

  // Vector Models configuration
  vectorModels: defaultVectorModels,
  llmModels: defaultLlmModels,

  // File Storage
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: Number(process.env.MAX_FILE_SIZE) || 100, // MB

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-here',
  encryptKey: process.env.ENCRYPT_KEY || 'your-encrypt-key-here',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFilePath: process.env.LOG_FILE_PATH || './logs',

  // Queue Configuration
  vectorMaxProcess: Number(process.env.VECTOR_MAX_PROCESS) || 15,
  qaMaxProcess: Number(process.env.QA_MAX_PROCESS) || 15,
  tokenWorkers: Number(process.env.TOKEN_WORKERS) || 30,

  // Vector Search
  hnswEfSearch: Number(process.env.HNSW_EF_SEARCH) || 100,

  // Root User
  rootUserEmail: process.env.ROOT_USER_EMAIL || 'admin@fastgpt.rag',
  rootUserPassword: process.env.ROOT_USER_PASSWORD || 'admin123456',
  defaultTeamName: process.env.DEFAULT_TEAM_NAME || 'FastGPT RAG Team'
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
