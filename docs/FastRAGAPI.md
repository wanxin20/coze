# FastGPT RAG - Knowledge Base Backend Service

FastGPT RAG 是从 FastGPT 项目中提取的纯后端知识库服务，专注于提供企业级的 RAG（检索增强生成）能力。

## 🚀 核心特性

### 🔥 完整功能支持
- **纯后端服务**: 只包含知识库相关的后端功能，无前端依赖
- **多种向量数据库支持**: PostgreSQL + pgvector 或 Milvus
- **完整的知识库管理**: 支持创建、查询、更新、删除知识库
- **智能文本处理**: 支持多种文件格式解析和文本分块 (PDF, DOCX, HTML, MD, CSV, JSON)
- **向量化搜索**: 基于 Embedding 的语义搜索
- **RESTful API**: 标准化的 HTTP API 接口
- **企业级架构**: 支持多租户、权限管理、审计日志

### ⚡ 高级搜索功能
- **混合搜索**: Embedding + 全文搜索 + RRF 融合
- **重排序支持**: BGE、Cohere 重排序模型
- **查询扩展**: AI 辅助查询重写和扩展  
- **深度搜索**: 多轮迭代搜索优化
- **高级过滤**: 支持标签、时间、集合过滤

### 🛠️ 企业级功能
- **训练系统**: 后台向量化任务队列
- **数据同步**: URL、API 自动同步
- **权限管理**: JWT、API Key、角色权限
- **性能监控**: 系统指标、使用统计
- **审计日志**: 完整操作记录
- **兼容性**: 完全兼容 FastGPT API 格式

## 📁 项目结构

```
FastGPTRAG/
├── src/
│   ├── api/                    # API 路由
│   │   └── routes/            # 路由定义
│   ├── config/                # 配置文件
│   ├── core/                  # 核心业务逻辑
│   │   ├── dataset/           # 数据集管理
│   │   ├── embedding/         # 向量化处理
│   │   ├── vectorstore/       # 向量数据库接口
│   │   └── file/             # 文件处理
│   ├── types/                 # TypeScript 类型定义
│   ├── utils/                 # 工具函数
│   ├── middleware/            # 中间件
│   ├── scripts/               # 脚本工具
│   ├── jobs/                  # 后台任务
│   └── server.ts              # 服务器入口
├── uploads/                   # 文件上传目录
├── logs/                     # 日志目录
├── package.json
├── tsconfig.json
└── env.example               # 环境变量示例
```

## 🛠️ 安装和配置

### 1. 环境要求

- Node.js >= 20
- MongoDB >= 4.4
- Redis >= 6.0
- PostgreSQL >= 12 (带 pgvector 扩展) 或 Milvus >= 2.0

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `env.example` 为 `.env` 并填入你的配置：

```bash
cp env.example .env
```

#### 必填配置项

```env
# MongoDB 配置
MONGO_URL=mongodb://localhost:27017/fastgpt-rag

# Redis 配置
REDIS_URL=redis://localhost:6379

# 向量数据库配置（选择一种）
# PostgreSQL + pgvector
PG_URL=postgresql://username:password@localhost:5432/fastgpt

# 或者 Milvus
MILVUS_URL=localhost:19530

# AI 模型配置
ONEAPI_URL=https://api.openai.com/v1
ONEAPI_KEY=your-openai-api-key

# 安全配置
JWT_SECRET=your-jwt-secret-here
ENCRYPT_KEY=your-encrypt-key-here
```

#### 可选配置项

```env
# 服务配置
PORT=3001
NODE_ENV=development

# 默认模型
DEFAULT_VECTOR_MODEL=text-embedding-3-small
DEFAULT_LLM_MODEL=gpt-4o-mini

# 文件存储
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=100

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

### 4. 初始化数据库

```bash
# 编译项目
npm run build

# 初始化数据库
npm run db:init
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 🔧 向量数据库配置

### PostgreSQL + pgvector

1. 安装 PostgreSQL 和 pgvector 扩展
2. 创建数据库
3. 配置 `PG_URL` 环境变量

```sql
-- 创建数据库
CREATE DATABASE fastgpt;

-- 安装 pgvector 扩展
CREATE EXTENSION vector;
```

### Milvus

1. 启动 Milvus 服务
2. 配置 `MILVUS_URL` 环境变量

```bash
# 使用 Docker 启动 Milvus
docker run -d --name milvus-standalone \
  -p 19530:19530 \
  -v $(pwd)/volumes/milvus:/var/lib/milvus \
  milvusdb/milvus:latest \
  milvus run standalone
```

## 📚 API 使用指南

### 基础认证

所有 API 请求需要在 Header 中包含以下信息：

```
x-team-id: your-team-id
x-user-id: your-user-id
Content-Type: application/json
```

### 核心 API 接口

#### 1. 创建知识库

```bash
POST /api/core/dataset
```

```json
{
  "name": "我的知识库",
  "intro": "知识库描述",
  "type": "dataset",
  "vectorModel": "text-embedding-3-small",
  "agentModel": "gpt-4o-mini"
}
```

#### 2. 创建集合

```bash
POST /api/core/dataset/collection
```

```json
{
  "datasetId": "知识库ID",
  "name": "文档集合",
  "type": "text",
  "rawText": "要处理的文本内容",
  "trainingType": "chunk",
  "chunkSize": 512
}
```

#### 3. 添加数据

```bash
POST /api/core/dataset/data/push
```

```json
{
  "collectionId": "集合ID",
  "data": [
    {
      "q": "问题或文本块",
      "a": "答案（可选）"
    }
  ],
  "mode": "chunk"
}
```

#### 4. 基础搜索

```bash
POST /api/core/dataset/searchTest
```

```json
{
  "datasetId": "知识库ID",
  "text": "搜索问题",
  "limit": 10,
  "similarity": 0.6,
  "searchMode": "mixedRecall"
}
```

#### 5. 高级搜索功能

```bash
# 深度搜索
POST /api/search/deep
{
  "datasetId": "知识库ID",
  "text": "搜索问题",
  "maxIterations": 3,
  "model": "gpt-4o-mini"
}

# 重排序搜索
POST /api/search
{
  "datasetId": "知识库ID", 
  "text": "搜索问题",
  "usingReRank": true,
  "rerankModel": "bge-reranker-base"
}

# 查询扩展搜索
POST /api/search
{
  "datasetId": "知识库ID",
  "text": "搜索问题", 
  "datasetSearchUsingExtensionQuery": true,
  "datasetSearchExtensionModel": "gpt-4o-mini"
}
```

#### 6. 监控和管理

```bash
# 系统健康检查
GET /api/monitoring/health

# 使用统计
GET /api/monitoring/usage?period=daily&limit=30

# 审计日志
GET /api/monitoring/audit?limit=100
```

### 响应格式

所有 API 响应都使用统一格式：

```json
{
  "code": 200,
  "message": "Success",
  "data": {}
}
```

## 🔄 与 FastGPT API 兼容性

本项目**完全兼容** FastGPT 知识库 API，可以直接替换 FastGPT 的知识库服务部分。

### ✅ 完整支持的接口：

#### 数据集管理
- `POST /api/core/dataset` - 创建数据集 ✅
- `GET /api/core/dataset` - 获取数据集列表 ✅
- `GET /api/core/dataset/:id` - 获取数据集详情 ✅
- `PUT /api/core/dataset/:id` - 更新数据集 ✅
- `DELETE /api/core/dataset/:id` - 删除数据集 ✅

#### 集合管理
- `POST /api/core/dataset/collection` - 创建集合 ✅
- `GET /api/core/dataset/collection` - 获取集合列表 ✅
- `GET /api/core/dataset/collection/:id` - 获取集合详情 ✅
- `PUT /api/core/dataset/collection/:id` - 更新集合 ✅
- `DELETE /api/core/dataset/collection/:id` - 删除集合 ✅
- `POST /api/core/dataset/collection/:id/sync` - 同步集合 ✅
- `POST /api/core/dataset/collection/:id/retrain` - 重训练 ✅

#### 数据管理
- `POST /api/core/dataset/data` - 插入数据 ✅
- `POST /api/core/dataset/data/push` - 批量推送数据 ✅
- `GET /api/core/dataset/data` - 获取数据列表 ✅
- `GET /api/core/dataset/data/:id` - 获取数据详情 ✅
- `PUT /api/core/dataset/data/:id` - 更新数据 ✅
- `DELETE /api/core/dataset/data/:id` - 删除数据 ✅

#### 搜索测试
- `POST /api/core/dataset/searchTest` - 搜索测试 ✅

### 🚀 增强功能
在保持兼容性基础上，还提供了以下增强功能：
- **混合搜索**: embedding + 全文搜索融合
- **重排序**: BGE、Cohere 重排序支持
- **查询扩展**: AI 辅助查询优化
- **深度搜索**: 多轮迭代搜索
- **文件处理**: 更多格式支持
- **实时监控**: 性能指标和使用统计
- **安全增强**: 完整的权限和审计系统

## 🚀 部署指南

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  fastgpt-rag:
    build: .
    ports:
      - "3001:3001"
    environment:
      - MONGO_URL=mongodb://mongo:27017/fastgpt-rag
      - REDIS_URL=redis://redis:6379
      - PG_URL=postgresql://postgres:password@postgres:5432/fastgpt
    depends_on:
      - mongo
      - redis
      - postgres

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: fastgpt
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
```

## 🔧 高级配置

### 模型配置

可以在 `src/config/index.ts` 中配置支持的模型：

```typescript
export const defaultVectorModels: EmbeddingModel[] = [
  {
    provider: 'OpenAI',
    model: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    maxToken: 3000,
    defaultToken: 512,
    weight: 100
  }
  // 添加更多模型...
];
```

### 队列配置

支持使用 BullMQ 进行异步任务处理：

```env
VECTOR_MAX_PROCESS=15
QA_MAX_PROCESS=15
TOKEN_WORKERS=30
```

## 🔍 监控和日志

### 日志配置

日志自动保存到 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志

### 健康检查

```bash
GET /health
```

返回服务状态信息。

## 🛡️ 安全建议

1. **JWT Secret**: 使用强密码生成 JWT_SECRET
2. **数据库安全**: 配置数据库访问权限
3. **网络安全**: 使用防火墙限制访问
4. **API 限流**: 实施 API 访问频率限制
5. **日志审计**: 定期检查访问日志

## 🔧 故障排除

### 常见问题

1. **MongoDB 连接失败**
   - 检查 MONGO_URL 配置
   - 确认 MongoDB 服务运行状态

2. **向量数据库初始化失败**
   - PostgreSQL: 确认 pgvector 扩展已安装
   - Milvus: 检查服务状态和网络连接

3. **Embedding API 调用失败**
   - 检查 ONEAPI_URL 和 ONEAPI_KEY 配置
   - 确认模型可用性

### 调试模式

```bash
# 启用详细日志
LOG_LEVEL=debug npm run dev
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 Apache-2.0 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

本项目基于 [FastGPT](https://github.com/labring/FastGPT) 项目的知识库模块开发，感谢 FastGPT 团队的出色工作。

## 📞 支持

如有问题或建议，请提交 Issue 或联系维护团队。

---

## 🏗️ Go后端集成架构分析

### 架构概述

Coze Studio的Go后端通过微服务架构集成了FastGPT RAG服务，采用了分层设计和依赖注入模式，确保了系统的可维护性和可扩展性。

### 核心文件分析

#### 1. **应用入口层 (`main.go`)**

**作用**：系统启动入口，负责初始化整个应用程序

**关键功能**：
- 加载环境变量配置
- 初始化应用依赖（调用`application.Init()`）
- 启动HTTP服务器和中间件
- 配置CORS、日志、认证等中间件

**RAG相关**：
- 通过`application.Init()`间接初始化RAG服务
- 为RAG API提供HTTP服务基础设施

```go
// main.go 关键代码片段
func main() {
    if err := application.Init(ctx); err != nil {
        panic("InitializeInfra failed, err=" + err.Error())
    }
    startHttpServer() // 启动包含RAG API的HTTP服务
}
```

#### 2. **应用基础设施层 (`app_infra.go`)**

**作用**：系统核心依赖的初始化和配置中心

**关键功能**：
- 初始化数据库、缓存、消息队列等基础设施
- 配置AI模型管理器
- **初始化RAG管理器（核心）**

**RAG集成要点**：
```go
// initRAGManager 初始化RAG管理器
func initRAGManager(ctx context.Context) error {
    ragServiceURL := os.Getenv("RAG_SERVICE_URL")
    if ragServiceURL == "" {
        ragServiceURL = "http://coze-fastgpt-rag:3001" // Docker容器通信
    }
    
    config := &ragImpl.RAGConfig{
        ServiceURL:         ragServiceURL,
        Timeout:           30 * time.Second,
        MaxRetries:        3,
        MonitoringEnabled: false,
        AlertingEnabled:   false,
        LogLevel:          "info",
        AuditEnabled:      true,
        PerformanceEnabled: true,
        SlowQueryThreshold: 1 * time.Second,
    }
    
    return ragImpl.InitializeGlobalRAGManager(ctx, config)
}
```

**设计特点**：
- 采用环境变量配置，支持Docker容器化部署
- 失败时不阻断主应用启动（降级处理）
- 支持监控、审计、性能统计等企业级功能

#### 3. **API处理层 (`rag_service.go`)**

**作用**：RAG服务的HTTP API处理器，提供RESTful接口

**接口分类**：

**A. 核心RAG功能**
```go
// RagSearch RAG搜索 - 核心搜索功能
func RagSearch(ctx context.Context, c *app.RequestContext)

// DeepSearch 深度搜索 - 多轮迭代搜索
func DeepSearch(ctx context.Context, c *app.RequestContext)
```

**B. FastGPT兼容接口**
```go
// 知识库管理（完全兼容FastGPT API）
func GetKnowledgeBases(ctx context.Context, c *app.RequestContext)     // GET /api/knowledge/rag/core/dataset
func CreateKnowledgeBase(ctx context.Context, c *app.RequestContext)   // POST /api/knowledge/rag/core/dataset
func SearchTestKnowledgeBase(ctx context.Context, c *app.RequestContext) // POST /api/knowledge/rag/core/dataset/searchTest

// 集合管理
func CreateCollectionFastGPT(ctx context.Context, c *app.RequestContext) // POST /api/knowledge/rag/core/dataset/collection
func GetCollectionsFastGPT(ctx context.Context, c *app.RequestContext)  // GET /api/knowledge/rag/core/dataset/collection

// 数据管理
func InsertDataFastGPT(ctx context.Context, c *app.RequestContext)      // POST /api/knowledge/rag/core/dataset/data
func PushDataFastGPT(ctx context.Context, c *app.RequestContext)        // POST /api/knowledge/rag/core/dataset/data/push
```

**C. 企业级功能**
```go
// 监控和统计
func GetRagHealth(ctx context.Context, c *app.RequestContext)           // 健康检查
func GetRagUsageStats(ctx context.Context, c *app.RequestContext)       // 使用统计
func GetRagMetrics(ctx context.Context, c *app.RequestContext)          // 系统指标
func GetRagAuditLogs(ctx context.Context, c *app.RequestContext)        // 审计日志

// 批量操作
func BatchCreateRagCollections(ctx context.Context, c *app.RequestContext)
func BatchDeleteRagCollections(ctx context.Context, c *app.RequestContext)
```

**设计特点**：
- 统一的错误处理和响应格式
- 完整的参数验证
- 支持多租户（teamId、userId）
- 提供100+个API端点，覆盖RAG全生命周期

#### 4. **应用服务层 (`rag_application.go`)**

**作用**：RAG业务逻辑的应用服务层，连接API层和领域层

**核心功能**：
```go
type RAGApplication struct {
    ragClient service.RAGClient     // RAG客户端接口
    knowledgeService service.KnowledgeService // 知识库领域服务
}

// 初始化RAG应用服务
func InitRAGApp(ctx context.Context, ragClient service.RAGClient, knowledgeService service.KnowledgeService) error {
    RAGApp = &RAGApplication{
        ragClient:        ragClient,
        knowledgeService: knowledgeService,
    }
    return nil
}
```

**业务协调**：
- 协调RAG微服务调用和本地知识库管理
- 处理业务逻辑和数据转换
- 提供事务性操作支持

#### 5. **领域服务层 (`knowledge/service/`)**

**A. RAG客户端接口 (`rag_client.go`)**
```go
type RAGClient interface {
    // 数据集管理
    CreateDataset(ctx context.Context, req *entity.RAGCreateDatasetRequest) (*entity.RAGCreateDatasetResponse, error)
    GetDatasets(ctx context.Context, req *entity.RAGGetDatasetsRequest) (*entity.RAGGetDatasetsResponse, error)
    
    // 搜索功能
    SearchDataset(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error)
    DeepSearch(ctx context.Context, req *entity.RAGDeepSearchRequest) (*entity.RAGDeepSearchResponse, error)
    
    // 集合管理
    CreateCollection(ctx context.Context, req *entity.RAGCreateCollectionRequest) (*entity.RAGCreateCollectionResponse, error)
    // ... 100+ 方法定义
}
```

**B. RAG编排服务 (`rag_orchestration_impl.go`)**
```go
// RAG编排服务 - 专门用于Coze工作流集成
type ragOrchestrationImpl struct {
    ragClient RAGClient
}

// 执行RAG搜索节点（工作流中使用）
func (r *ragOrchestrationImpl) ExecuteRAGSearch(ctx context.Context, req *entity.RAGOrchestrationRequest) (*entity.RAGOrchestrationResponse, error) {
    // 构建RAG搜索请求
    searchReq := &entity.RAGSearchRequest{
        KnowledgeBaseID: req.KnowledgeBaseID,
        Query:          req.Query,
        TopK:           req.TopK,
        ScoreThreshold: req.ScoreThreshold,
        SearchMode:     req.SearchMode,
    }
    
    // 调用RAG微服务
    searchResp, err := r.ragClient.SearchKnowledgeBase(ctx, searchReq)
    // 转换为工作流响应格式
    return &entity.RAGOrchestrationResponse{...}, nil
}
```

#### 6. **基础设施层 (`infra/impl/rag/`)**

**A. RAG客户端实现 (`client.go`)**

**作用**：RAG微服务的HTTP客户端实现，负责与FastGPT RAG服务通信

**核心特性**：
```go
type Client struct {
    config     *Config
    httpClient *http.Client
}

// HTTP请求核心方法
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, teamID, userID string, response interface{}) error {
    url := c.config.BaseURL + path
    
    // 设置请求头
    req.Header.Set("Content-Type", "application/json")
    if c.config.AuthToken != "" {
        req.Header.Set("Authorization", "Bearer "+c.config.AuthToken)
    }
    req.Header.Set("x-team-id", teamID)    // 多租户支持
    req.Header.Set("x-user-id", userID)
    
    // 执行请求并处理响应
    resp, err := c.httpClient.Do(req)
    // ... 错误处理和日志记录
}
```

**实现的接口方法**：
- 数据集管理：`CreateDataset()`, `GetDatasets()`, `UpdateDataset()`, `DeleteDataset()`
- 集合管理：`CreateCollection()`, `GetCollections()`, `SyncCollection()`, `RetrainCollection()`
- 数据管理：`InsertData()`, `PushDataBatch()`, `GetDataList()`, `UpdateData()`, `DeleteData()`
- 搜索功能：`SearchDataset()`, `DeepSearch()`, `AdvancedSearch()`, `HybridSearch()`
- 文件处理：`UploadFile()`, `ProcessFile()`, `GetSupportedFileTypes()`
- 监控管理：`GetHealth()`, `GetUsageStats()`, `GetMetrics()`, `GetAuditLogs()`

**B. RAG管理器 (`init.go`)**

**作用**：RAG服务的生命周期管理器

```go
type RAGServiceManager struct {
    config      *RAGConfig
    client      service.RAGClient
    monitor     *MonitoringService
    alerter     *AlertingService
    logger      Logger
    initialized bool
}

// 初始化流程
func (m *RAGServiceManager) Initialize(ctx context.Context) error {
    // 1. 初始化RAG客户端
    if err := m.initializeClient(ctx); err != nil {
        return fmt.Errorf("initialize client failed: %w", err)
    }
    
    // 2. 初始化监控服务
    if m.config.MonitoringEnabled {
        if err := m.initializeMonitoring(ctx); err != nil {
            return fmt.Errorf("initialize monitoring failed: %w", err)
        }
    }
    
    // 3. 验证服务连接
    if err := m.validateConnection(ctx); err != nil {
        return fmt.Errorf("validate connection failed: %w", err)
    }
    
    return nil
}
```

#### 7. **数据模型层 (`api/model/data/knowledge/rag/`)**

**作用**：定义RAG服务的请求/响应数据结构

**核心模型**：
```go
// rag_models.go - 包含所有RAG相关的数据模型

// RAG搜索请求
type RagSearchRequest struct {
    DatasetId   string  `json:"datasetId" binding:"required"`
    Text        string  `json:"text" binding:"required"`
    Limit       int     `json:"limit,omitempty"`
    Similarity  float64 `json:"similarity,omitempty"`
    SearchMode  string  `json:"searchMode,omitempty"`
}

// RAG搜索响应
type RagSearchResponse struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Data    struct {
        List  []RagSearchResult `json:"list"`
        Total int              `json:"total"`
    } `json:"data"`
}

// 知识库创建请求
type CreateKnowledgeBaseRequest struct {
    Name        string `json:"name" binding:"required"`
    Intro       string `json:"intro,omitempty"`
    Type        string `json:"type,omitempty"`
    VectorModel string `json:"vectorModel,omitempty"`
    AgentModel  string `json:"agentModel,omitempty"`
}
```

#### 8. **领域实体层 (`domain/knowledge/entity/`)**

**作用**：定义核心业务实体和领域模型

**核心实体**：
```go
// rag.go - RAG领域实体定义

// RAG数据集实体（对应FastGPT的dataset概念）
type RAGDataset struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Description string `json:"description"`
    TeamID      string `json:"teamId"`
    UserID      string `json:"userId"`
    Type        string `json:"type"`
    VectorModel string `json:"vectorModel"`
    AgentModel  string `json:"agentModel"`
    Status      string `json:"status"`
    CreatedAt   int64  `json:"createdAt"`
    UpdatedAt   int64  `json:"updatedAt"`
}

// RAG集合实体（dataset下的数据组织单位）
type RAGCollection struct {
    ID            string `json:"id"`
    DatasetID     string `json:"datasetId"`
    Name          string `json:"name"`
    Type          string `json:"type"`
    TrainingType  string `json:"trainingType"`
    ChunkSize     int    `json:"chunkSize"`
    Status        string `json:"status"`
    CreatedAt     int64  `json:"createdAt"`
    UpdatedAt     int64  `json:"updatedAt"`
}
```

#### 9. **配置文件 (`conf/rag/rag_config.yaml`)**

**作用**：RAG服务的配置模板

```yaml
rag:
  service:
    base_url: "http://fastgpt-rag:3001"
    timeout: 30s
    max_retries: 3
    
  search:
    default_limit: 10
    default_similarity: 0.6
    default_search_mode: "mixedRecall"
    enable_rerank: true
    
  models:
    embedding:
      default: "text-embedding-3-small"
    llm:
      default: "gpt-4o-mini"
      
  monitoring:
    enable_metrics: true
    enable_health_check: true
```

### 系统集成流程

#### 1. **启动初始化流程**
```
main.go → application.Init() → app_infra.go → initRAGManager() 
→ ragImpl.InitializeGlobalRAGManager() → RAGServiceManager.Initialize()
→ initializeClient() → NewRAGClient()
```

#### 2. **API请求处理流程**
```
HTTP Request → rag_service.go (API Handler) 
→ rag_application.go (Application Service) 
→ service.RAGClient (Interface) 
→ rag/client.go (Implementation) 
→ HTTP Request to FastGPT RAG Service
→ Response Processing → JSON Response
```

#### 3. **工作流集成流程**
```
Coze Workflow → RAG Search Node 
→ ragOrchestrationImpl.ExecuteRAGSearch() 
→ RAGClient.SearchKnowledgeBase() 
→ FastGPT RAG Service → Search Results 
→ RAGOrchestrationResponse → Workflow Context
```

### 架构优势

#### 1. **分层架构**
- **API层**：处理HTTP请求和响应
- **应用层**：业务逻辑协调
- **领域层**：核心业务规则
- **基础设施层**：外部服务集成

#### 2. **依赖注入**
- 通过接口定义依赖关系
- 支持单元测试和模拟
- 便于扩展和替换实现

#### 3. **微服务集成**
- HTTP客户端封装
- 统一错误处理
- 自动重试机制
- 连接池管理

#### 4. **企业级特性**
- 多租户支持
- 监控和审计
- 性能统计
- 健康检查
- 降级处理

#### 5. **FastGPT兼容性**
- 完整的API兼容
- 数据模型对齐
- 搜索功能增强
- 无缝迁移支持

### 部署和运维

#### 1. **Docker容器化**
- Go后端容器：`coze-backend`
- RAG服务容器：`coze-fastgpt-rag`
- 容器间通信：HTTP API

#### 2. **环境变量配置**
```bash
# RAG服务配置
RAG_SERVICE_URL=http://coze-fastgpt-rag:3001
RAG_AUTH_TOKEN=your-auth-token

# 监控配置
RAG_MONITORING_ENABLED=true
RAG_ALERTING_ENABLED=false
```

#### 3. **服务发现**
- 支持环境变量配置
- Docker容器名称解析
- 支持负载均衡

#### 4. **故障处理**
- 自动重试机制
- 降级处理（RAG服务不可用时不阻断主应用）
- 详细错误日志
- 健康检查端点

这种架构设计确保了Coze Studio能够高效、稳定地集成FastGPT RAG微服务，为用户提供强大的知识库和搜索功能。