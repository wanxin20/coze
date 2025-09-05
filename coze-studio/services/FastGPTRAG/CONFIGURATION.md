# FastGPT RAG 配置指南

本文档详细说明 FastGPT RAG 系统的配置要求和部署步骤。

## 📋 系统要求

### 基础环境

- **Node.js**: >= 20.0.0
- **操作系统**: Linux, macOS, Windows
- **内存**: 最低 4GB RAM，推荐 8GB+
- **存储**: 最低 20GB 可用空间

### 数据库要求

#### MongoDB (必需)
- **版本**: >= 4.4
- **用途**: 存储知识库元数据、用户信息、集合信息
- **配置**: 支持副本集，推荐开启身份验证

#### Redis (必需)
- **版本**: >= 6.0  
- **用途**: 缓存、队列管理、会话存储
- **配置**: 推荐开启持久化

#### 向量数据库 (选择一种)

**选项1: PostgreSQL + pgvector**
- **版本**: PostgreSQL >= 12, pgvector >= 0.4.0
- **优势**: 关系型数据库，数据一致性好，成本较低
- **适用**: 中小规模数据集 (< 10M 向量)

**选项2: Milvus**  
- **版本**: >= 2.0
- **优势**: 专业向量数据库，性能优秀，扩展性好
- **适用**: 大规模数据集 (> 10M 向量)

## 🔧 详细配置说明

### 1. 环境变量配置

#### 基础服务配置

```env
# 服务端口
PORT=3001

# 运行环境 (development/production)
NODE_ENV=production

# 服务域名 (可选，用于生成链接)
SERVER_DOMAIN=https://your-domain.com
```

#### MongoDB 配置

```env
# 主数据库连接串
MONGO_URL=mongodb://username:password@host:port/fastgpt-rag

# 日志数据库连接串 (可与主库相同)
MONGO_LOG_URL=mongodb://username:password@host:port/fastgpt-rag-logs
```

**MongoDB 连接串格式说明**:
- 单节点: `mongodb://user:pass@host:port/db`
- 副本集: `mongodb://user:pass@host1:port1,host2:port2/db?replicaSet=rs0`
- 带SSL: `mongodb://user:pass@host:port/db?ssl=true`

#### Redis 配置

```env
# Redis 连接串
REDIS_URL=redis://password@host:port/db

# 或者分别配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

#### PostgreSQL + pgvector 配置

```env
# PostgreSQL 连接串
PG_URL=postgresql://username:password@host:port/database

# 向量搜索配置
HNSW_EF_SEARCH=100
```

**PostgreSQL 配置要求**:
```sql
-- 安装 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建用户和数据库
CREATE USER fastgpt WITH PASSWORD 'your-password';
CREATE DATABASE fastgpt OWNER fastgpt;
GRANT ALL PRIVILEGES ON DATABASE fastgpt TO fastgpt;
```

#### Milvus 配置

```env
# Milvus 服务地址
MILVUS_URL=localhost:19530

# Milvus 认证 (如果启用)
MILVUS_USERNAME=your-username
MILVUS_PASSWORD=your-password

# 向量搜索配置
HNSW_EF_SEARCH=100
```

#### AI 模型配置

```env
# OneAPI 兼容接口地址
ONEAPI_URL=https://api.openai.com/v1

# API 密钥
ONEAPI_KEY=sk-your-api-key-here

# 默认模型配置
DEFAULT_VECTOR_MODEL=text-embedding-3-small
DEFAULT_LLM_MODEL=gpt-4o-mini  
DEFAULT_VLM_MODEL=gpt-4o
```

**OneAPI 配置说明**:
- 支持 OpenAI、Azure OpenAI、通义千问、文心一言等
- 确保配置的模型在 OneAPI 中可用
- 建议配置模型的 RPM 限制

#### 文件存储配置

```env
# 本地存储路径
UPLOAD_PATH=./uploads

# 最大文件大小 (MB)
MAX_FILE_SIZE=100

# 支持的文件类型 (可选)
ALLOWED_FILE_TYPES=pdf,docx,txt,md,html,csv,xlsx
```

#### 安全配置

```env
# JWT 密钥 (必须设置强密码)
JWT_SECRET=your-very-long-and-random-jwt-secret-key

# 加密密钥 (用于敏感数据加密)
ENCRYPT_KEY=your-32-character-encryption-key

# API 限流配置
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
```

#### 日志配置

```env
# 日志级别 (error/warn/info/debug)
LOG_LEVEL=info

# 日志文件路径
LOG_FILE_PATH=./logs

# 日志文件大小限制 (MB)
LOG_MAX_SIZE=10

# 日志文件保留数量
LOG_MAX_FILES=5
```

#### 队列和性能配置

```env
# 向量化处理线程数
VECTOR_MAX_PROCESS=15

# QA 处理线程数  
QA_MAX_PROCESS=15

# Token 计算工作线程数
TOKEN_WORKERS=30

# 批处理大小
BATCH_SIZE=100

# 请求超时时间 (秒)
REQUEST_TIMEOUT=60
```

### 2. 模型配置

#### Embedding 模型配置

在 `src/config/index.ts` 中配置支持的向量模型:

```typescript
const defaultVectorModels: EmbeddingModel[] = [
  {
    provider: 'OpenAI',
    model: 'text-embedding-3-small',
    name: 'OpenAI Small',
    maxToken: 3000,
    defaultToken: 512,
    weight: 100,
    defaultConfig: {},
    // 针对不同场景的配置
    dbConfig: { dimensions: 1536 },
    queryConfig: { dimensions: 1536 }
  },
  {
    provider: 'OpenAI', 
    model: 'text-embedding-3-large',
    name: 'OpenAI Large',
    maxToken: 3000,
    defaultToken: 512,
    weight: 100,
    defaultConfig: { dimensions: 1024 }
  }
];
```

#### LLM 模型配置

```typescript
const defaultLlmModels: LLMModel[] = [
  {
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    name: 'GPT-4O Mini',
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
    functionCall: false
  }
];
```

### 3. 数据库初始化

#### PostgreSQL 初始化

```sql
-- 连接到 PostgreSQL
psql -h localhost -U postgres

-- 创建数据库和用户
CREATE USER fastgpt WITH PASSWORD 'your-password';
CREATE DATABASE fastgpt OWNER fastgpt;

-- 连接到新数据库
\c fastgpt fastgpt

-- 安装 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### Milvus 初始化

```bash
# 使用 Docker 启动 Milvus
docker run -d \
  --name milvus-standalone \
  -p 19530:19530 \
  -p 9091:9091 \
  -v $(pwd)/volumes/milvus:/var/lib/milvus \
  milvusdb/milvus:v2.3.0 \
  milvus run standalone

# 验证服务
curl -X GET "http://localhost:9091/api/v1/health"
```

#### MongoDB 初始化

```bash
# 连接到 MongoDB
mongosh mongodb://localhost:27017

# 创建数据库和用户
use fastgpt-rag
db.createUser({
  user: "fastgpt",
  pwd: "your-password",
  roles: [
    { role: "readWrite", db: "fastgpt-rag" },
    { role: "readWrite", db: "fastgpt-rag-logs" }
  ]
})

# 创建必要的索引
db.datasets.createIndex({ teamId: 1, type: 1 })
db.dataset_collections.createIndex({ teamId: 1, datasetId: 1, updateTime: -1 })
db.dataset_datas.createIndex({ teamId: 1, datasetId: 1, collectionId: 1 })
```

### 4. 生产环境配置

#### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'fastgpt-rag',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
}
EOF

# 启动服务
pm2 start ecosystem.config.js
```

#### 使用 Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 构建项目
RUN npm run build

# 创建必要目录
RUN mkdir -p uploads logs

# 设置权限
RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["npm", "start"]
```

#### Nginx 反向代理

```nginx
upstream fastgpt_rag {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    server 127.0.0.1:3004;
}

server {
    listen 80;
    server_name your-domain.com;

    # 文件上传大小限制
    client_max_body_size 100M;

    location / {
        proxy_pass http://fastgpt_rag;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件缓存
    location /uploads/ {
        alias /path/to/fastgpt-rag/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. 监控和维护

#### 日志监控

```bash
# 查看实时日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 日志轮转配置 (logrotate)
cat > /etc/logrotate.d/fastgpt-rag << EOF
/path/to/fastgpt-rag/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 node node
    postrotate
        systemctl reload fastgpt-rag
    endscript
}
EOF
```

#### 性能监控

```bash
# 数据库连接监控
echo "db.serverStatus().connections" | mongosh mongodb://localhost:27017/fastgpt-rag

# Redis 监控
redis-cli info stats

# 系统资源监控
htop
iostat -x 1
```

#### 备份策略

```bash
# MongoDB 备份
mongodump --uri="mongodb://user:pass@host:port/fastgpt-rag" --out=/backup/mongo/$(date +%Y%m%d)

# PostgreSQL 备份
pg_dump -h localhost -U fastgpt fastgpt > /backup/pg/fastgpt_$(date +%Y%m%d).sql

# 文件备份
tar -czf /backup/files/uploads_$(date +%Y%m%d).tar.gz uploads/
```

## 🚨 故障排除

### 常见问题

1. **MongoDB 连接超时**
   ```bash
   # 检查连接
   mongosh $MONGO_URL --eval "db.adminCommand('ping')"
   
   # 检查网络
   telnet mongodb-host 27017
   ```

2. **pgvector 扩展未安装**
   ```sql
   -- 检查扩展
   SELECT * FROM pg_available_extensions WHERE name = 'vector';
   
   -- 安装扩展
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **向量搜索性能差**
   ```sql
   -- PostgreSQL: 创建 HNSW 索引
   CREATE INDEX ON vectors USING hnsw (vector vector_cosine_ops);
   
   -- 调整搜索参数
   SET hnsw.ef_search = 100;
   ```

4. **内存占用过高**
   ```env
   # 减少工作线程数
   VECTOR_MAX_PROCESS=5
   QA_MAX_PROCESS=5
   TOKEN_WORKERS=10
   
   # 调整批处理大小
   BATCH_SIZE=50
   ```

### 性能优化建议

1. **数据库优化**
   - MongoDB: 合理配置索引，使用分片
   - PostgreSQL: 调整 shared_buffers, work_mem
   - Redis: 配置最大内存和淘汰策略

2. **向量搜索优化**
   - 选择合适的向量维度
   - 调整 HNSW 参数 (M, ef_construction)
   - 使用适当的相似度阈值

3. **缓存策略**
   - 启用 Redis 缓存常用查询
   - 配置 CDN 加速文件访问
   - 使用内存缓存热点数据

这个配置指南涵盖了 FastGPT RAG 系统的完整部署和配置流程。根据实际环境调整相关参数，确保系统稳定运行。
