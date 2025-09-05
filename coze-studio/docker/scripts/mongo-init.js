// MongoDB初始化脚本
// 为FastGPTRAG创建数据库和用户

print('Starting MongoDB initialization for FastGPTRAG...');

// 切换到admin数据库
db = db.getSiblingDB('admin');

// 创建RAG专用用户
db.createUser({
  user: 'raguser',
  pwd: 'ragpassword',
  roles: [
    {
      role: 'readWrite',
      db: 'coze-rag'
    }
  ]
});

// 切换到coze-rag数据库
db = db.getSiblingDB('coze-rag');

// 创建集合和索引
// 数据集集合
db.createCollection('datasets');
db.datasets.createIndex({ "teamId": 1, "userId": 1 });
db.datasets.createIndex({ "name": "text" });
db.datasets.createIndex({ "createTime": -1 });

// 集合集合
db.createCollection('collections');
db.collections.createIndex({ "datasetId": 1 });
db.collections.createIndex({ "teamId": 1, "userId": 1 });
db.collections.createIndex({ "status": 1 });
db.collections.createIndex({ "createTime": -1 });

// 数据集合
db.createCollection('data');
db.data.createIndex({ "collectionId": 1 });
db.data.createIndex({ "datasetId": 1 });
db.data.createIndex({ "teamId": 1 });
db.data.createIndex({ "q": "text", "a": "text" });

// 训练任务集合
db.createCollection('training_jobs');
db.training_jobs.createIndex({ "collectionId": 1 });
db.training_jobs.createIndex({ "teamId": 1, "userId": 1 });
db.training_jobs.createIndex({ "status": 1 });
db.training_jobs.createIndex({ "createTime": -1 });

// 使用统计集合
db.createCollection('usage_stats');
db.usage_stats.createIndex({ "date": 1 });
db.usage_stats.createIndex({ "teamId": 1 });
db.usage_stats.createIndex({ "type": 1, "date": -1 });

// 审计日志集合
db.createCollection('audit_logs');
db.audit_logs.createIndex({ "teamId": 1, "userId": 1 });
db.audit_logs.createIndex({ "action": 1 });
db.audit_logs.createIndex({ "timestamp": -1 });
db.audit_logs.createIndex({ "resourceType": 1, "resourceId": 1 });

print('MongoDB initialization completed successfully!');

// 插入一些示例配置数据
db.config.insertOne({
  _id: 'system_config',
  version: '1.0.0',
  features: {
    enableRerank: true,
    enableQueryExtension: true,
    enableDeepSearch: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    supportedFileTypes: ['pdf', 'docx', 'txt', 'md', 'html', 'csv']
  },
  models: {
    embedding: {
      default: 'text-embedding-3-small',
      available: [
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002'
      ]
    },
    llm: {
      default: 'gpt-4o-mini',
      available: [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-3.5-turbo'
      ]
    },
    rerank: {
      default: 'bge-reranker-base',
      available: [
        'bge-reranker-base',
        'bge-reranker-large',
        'cohere-rerank-multilingual'
      ]
    }
  },
  limits: {
    maxDatasetsPerTeam: 100,
    maxCollectionsPerDataset: 1000,
    maxDataPerCollection: 50000,
    maxSearchLimit: 100
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Sample configuration data inserted!');
