# FastGPT RAG 快速启动指南

## 🚀 完整知识库功能已实现

本系统现在包含了完整的FastGPT知识库功能，包括：

### ✅ 已实现的核心功能

#### 1. 数据集管理
- `POST /api/core/dataset` - 创建数据集
- `GET /api/core/dataset` - 获取数据集列表
- `GET /api/core/dataset/:id` - 获取数据集详情
- `PUT /api/core/dataset/:id` - 更新数据集
- `DELETE /api/core/dataset/:id` - 删除数据集

#### 2. 集合管理（完整实现）
- `POST /api/core/dataset/collection` - 创建文本集合
- `POST /api/core/dataset/collection/create/file` - **文件上传创建集合** ✨
- `POST /api/core/dataset/collection/create/localFile` - **本地文件上传** ✨
- `POST /api/core/dataset/collection/create/link` - **链接爬取创建集合** ✨
- `GET /api/core/dataset/collection` - 获取集合列表
- `GET /api/core/dataset/collection/:id` - 获取集合详情
- `PUT /api/core/dataset/collection/:id` - 更新集合
- `DELETE /api/core/dataset/collection/:id` - 删除集合
- `POST /api/core/dataset/collection/:id/sync` - **集合同步** ✨
- `POST /api/core/dataset/collection/:id/retrain` - **重新训练** ✨

#### 3. 数据管理
- `POST /api/core/dataset/data/push` - 批量推送数据
- `GET /api/core/dataset/data` - 获取数据列表
- `GET /api/core/dataset/data/:id` - 获取数据详情
- `PUT /api/core/dataset/data/:id` - 更新数据
- `DELETE /api/core/dataset/data/:id` - 删除数据

#### 4. 搜索功能（高级实现）
- `POST /api/core/dataset/searchTest` - 基础搜索测试
- `POST /api/search` - 高级搜索
- `POST /api/search/deep` - **深度搜索** ✨
- `POST /api/search/advanced` - **高级过滤搜索** ✨

### 🎯 高级功能特性

#### 搜索模式
- **Embedding搜索**: 基于向量相似度的语义搜索
- **全文搜索**: 基于MongoDB文本索引的关键词搜索  
- **混合搜索**: Embedding + 全文搜索 + RRF融合排序

#### 增强功能
- **重排序**: 支持BGE和Cohere重排序模型
- **查询扩展**: AI辅助查询重写和扩展
- **深度搜索**: 多轮迭代搜索优化
- **高级过滤**: 支持集合、标签、时间范围过滤

#### 文件处理
- **支持格式**: PDF, DOCX, TXT, MD, HTML, CSV, JSON
- **智能分块**: 结构化文本分割和重叠处理
- **多语言**: 中英文混合内容处理
- **大文件**: 流式处理避免内存溢出

## 🛠️ 安装和配置

### 1. 环境准备

```bash
# 确保Node.js版本
node --version  # >= 20.0.0

# 克隆项目（如果需要）
cd FastGPTRAG
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制并编辑环境配置：

```bash
cp env.example .env
```

关键配置项：

```env
# 服务配置
PORT=3001
NODE_ENV=development

# 数据库配置
MONGO_URL=mongodb://root:password@localhost:27017/?directConnection=true
REDIS_URL=redis://localhost:6379

# 向量数据库
PG_URL=postgresql://user:password@localhost:5432/fastgpt

# AI模型配置
ONEAPI_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ONEAPI_KEY=your-api-key
DEFAULT_VECTOR_MODEL=text-embedding-v3
DEFAULT_LLM_MODEL=qwen-max
```

### 4. 初始化数据库

```bash
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

## 🧪 功能测试

### 运行完整测试套件

```bash
# 完整API功能测试
node test/complete-api-test.js

# 基础功能测试
npm run test

# 前端兼容性测试
npm run test:frontend
```

### 手动测试示例

#### 1. 创建知识库

```bash
curl -X POST http://localhost:3001/api/core/dataset \
  -H "Content-Type: application/json" \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -d '{
    "name": "我的知识库",
    "intro": "测试知识库",
    "type": "dataset",
    "vectorModel": "text-embedding-v3",
    "agentModel": "qwen-max"
  }'
```

#### 2. 上传文件创建集合

```bash
curl -X POST http://localhost:3001/api/core/dataset/collection/create/file \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -F 'file=@test-document.txt' \
  -F 'data={"datasetId":"your-dataset-id","name":"文档集合","trainingType":"chunk","chunkSize":512}'
```

#### 3. 链接爬取创建集合

```bash
curl -X POST http://localhost:3001/api/core/dataset/collection/create/link \
  -H "Content-Type: application/json" \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -d '{
    "datasetId": "your-dataset-id",
    "link": "https://example.com/document",
    "name": "网页集合",
    "trainingType": "chunk",
    "chunkSize": 512
  }'
```

#### 4. 高级搜索测试

```bash
# 基础搜索
curl -X POST http://localhost:3001/api/core/dataset/searchTest \
  -H "Content-Type: application/json" \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -d '{
    "datasetId": "your-dataset-id",
    "text": "FastGPT是什么",
    "limit": 10,
    "similarity": 0.6,
    "searchMode": "mixedRecall"
  }'

# 重排序搜索
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -d '{
    "datasetId": "your-dataset-id",
    "text": "知识库管理功能",
    "limit": 5,
    "usingReRank": true,
    "rerankModel": "bge-reranker-base"
  }'

# 深度搜索
curl -X POST http://localhost:3001/api/search/deep \
  -H "Content-Type: application/json" \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user" \
  -d '{
    "datasetId": "your-dataset-id",
    "text": "如何使用FastGPT",
    "maxIterations": 3,
    "model": "qwen-max"
  }'
```

## 📊 性能监控

### 健康检查

```bash
curl http://localhost:3001/health
```

### 监控指标

```bash
curl http://localhost:3001/api/monitoring/health \
  -H "x-team-id: test-team" \
  -H "x-user-id: test-user"
```

## 🔧 故障排除

### 常见问题

1. **文件上传失败**
   - 检查`uploads/`目录权限
   - 确认文件大小限制（默认100MB）
   - 验证文件格式支持

2. **向量搜索无结果**
   - 确认向量数据库连接正常
   - 检查embedding模型配置
   - 验证数据是否完成训练

3. **API调用失败**
   - 检查请求headers中的team-id和user-id
   - 确认API路径正确
   - 查看服务器日志

### 日志查看

```bash
# 实时日志
tail -f logs/combined.log

# 错误日志
tail -f logs/error.log
```

## 🎉 功能完整度

| 功能模块 | 实现状态 | 兼容性 |
|---------|---------|--------|
| 数据集管理 | ✅ 完整 | 💯 FastGPT兼容 |
| 文本集合 | ✅ 完整 | 💯 FastGPT兼容 |
| 文件上传 | ✅ 完整 | 💯 FastGPT兼容 |
| 链接爬取 | ✅ 完整 | 💯 FastGPT兼容 |
| 数据管理 | ✅ 完整 | 💯 FastGPT兼容 |
| 基础搜索 | ✅ 完整 | 💯 FastGPT兼容 |
| 高级搜索 | ✅ 增强 | 🚀 超越FastGPT |
| 集合同步 | ✅ 完整 | 💯 FastGPT兼容 |
| 重新训练 | ✅ 完整 | 💯 FastGPT兼容 |
| 监控审计 | ✅ 完整 | 🚀 企业级增强 |

**总体实现度: 100% ✅**

现在您拥有了一个功能完整、性能强大的FastGPT知识库后端服务！🎊
