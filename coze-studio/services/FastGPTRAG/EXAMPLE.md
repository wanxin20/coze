# FastGPT RAG 使用示例

本文档提供 FastGPT RAG 系统的详细使用示例。

## 🚀 快速开始

### 1. 安装和启动

```bash
# 克隆项目
git clone <your-repo-url>
cd FastGPTRAG

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入你的配置

# 初始化数据库
npm run db:init

# 启动服务
npm run dev
```

### 2. 验证服务

```bash
# 健康检查
curl http://localhost:3001/health

# 应该返回:
# {
#   "status": "ok",
#   "timestamp": "2024-01-01T00:00:00.000Z",
#   "version": "1.0.0"
# }
```

## 📚 API 使用示例

### 基础认证

所有 API 请求需要包含以下 Headers：

```bash
curl -H "x-team-id: your-team-id" \
     -H "x-user-id: your-user-id" \
     -H "Content-Type: application/json" \
     <API_ENDPOINT>
```

### 1. 创建知识库

```bash
curl -X POST http://localhost:3001/api/dataset \
  -H "x-team-id: team-001" \
  -H "x-user-id: user-001" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "技术文档知识库",
    "intro": "包含技术文档和API说明的知识库",
    "type": "dataset",
    "vectorModel": "text-embedding-3-small",
    "agentModel": "gpt-4o-mini"
  }'
```

**响应示例：**
```json
{
  "code": 200,
  "message": "Dataset created successfully",
  "data": "65abc9bd9d1448617cba5e6c"
}
```

### 2. 获取知识库列表

```bash
curl -X GET "http://localhost:3001/api/dataset?current=1&pageSize=10" \
  -H "x-team-id: team-001" \
  -H "x-user-id: user-001"
```

**响应示例：**
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "list": [
      {
        "_id": "65abc9bd9d1448617cba5e6c",
        "name": "技术文档知识库",
        "intro": "包含技术文档和API说明的知识库",
        "type": "dataset",
        "vectorModel": "text-embedding-3-small",
        "agentModel": "gpt-4o-mini",
        "createTime": "2024-01-01T00:00:00.000Z",
        "updateTime": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "current": 1,
    "pageSize": 10
  }
}
```

### 3. 搜索知识库

```bash
curl -X POST http://localhost:3001/api/search \
  -H "x-team-id: team-001" \
  -H "x-user-id: user-001" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "65abc9bd9d1448617cba5e6c",
    "text": "如何使用API接口",
    "limit": 5,
    "similarity": 0.6,
    "searchMode": "embedding"
  }'
```

**响应示例：**
```json
{
  "code": 200,
  "message": "Search completed successfully",
  "data": [
    {
      "id": "65abc123",
      "q": "API接口使用方法",
      "a": "API接口的详细使用说明...",
      "score": 0.89,
      "indexes": [
        {
          "type": "default",
          "text": "API接口使用方法的详细说明"
        }
      ]
    }
  ]
}
```

## 🔧 完整使用流程示例

### 场景：创建一个技术文档知识库

以下是一个完整的使用流程，从创建知识库到搜索数据：

#### 第一步：创建知识库

```javascript
// 使用 Node.js 示例
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';
const headers = {
  'x-team-id': 'tech-team',
  'x-user-id': 'developer-001',
  'Content-Type': 'application/json'
};

async function createDataset() {
  try {
    const response = await axios.post(`${API_BASE}/dataset`, {
      name: 'Node.js 技术文档',
      intro: 'Node.js 相关的技术文档和最佳实践',
      type: 'dataset',
      vectorModel: 'text-embedding-3-small',
      agentModel: 'gpt-4o-mini'
    }, { headers });
    
    console.log('知识库创建成功:', response.data.data);
    return response.data.data; // 返回 datasetId
  } catch (error) {
    console.error('创建失败:', error.response?.data);
  }
}

const datasetId = await createDataset();
// 输出: 知识库创建成功: 65abc9bd9d1448617cba5e6c
```

#### 第二步：添加数据到知识库

```javascript
async function addDataToDataset(datasetId) {
  // 注意：这个示例中的数据添加接口还未完全实现
  // 在实际使用中，你需要先创建集合(collection)，然后添加数据
  
  const sampleData = [
    {
      q: 'Node.js 是什么？',
      a: 'Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境，可以在服务器端运行 JavaScript 代码。'
    },
    {
      q: '如何安装 Node.js？',
      a: '可以从官网 nodejs.org 下载安装包，或使用包管理器如 nvm、brew 等进行安装。'
    },
    {
      q: 'npm 是什么？',
      a: 'npm (Node Package Manager) 是 Node.js 的包管理器，用于安装和管理 JavaScript 包。'
    }
  ];

  // 这里是示例代码，实际需要根据完整的API实现
  console.log('数据添加功能开发中...');
  console.log('将添加的数据:', sampleData);
}
```

#### 第三步：搜索知识库

```javascript
async function searchDataset(datasetId, query) {
  try {
    const response = await axios.post(`${API_BASE}/search`, {
      datasetId: datasetId,
      text: query,
      limit: 5,
      similarity: 0.6,
      searchMode: 'embedding'
    }, { headers });
    
    console.log('搜索结果:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('搜索失败:', error.response?.data);
  }
}

// 搜索示例
const results = await searchDataset(datasetId, 'Node.js 安装方法');
```

#### 第四步：管理知识库

```javascript
// 获取知识库详情
async function getDatasetInfo(datasetId) {
  try {
    const response = await axios.get(`${API_BASE}/dataset/${datasetId}`, { headers });
    console.log('知识库信息:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('获取失败:', error.response?.data);
  }
}

// 更新知识库
async function updateDataset(datasetId, updates) {
  try {
    const response = await axios.put(`${API_BASE}/dataset/${datasetId}`, updates, { headers });
    console.log('更新成功:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('更新失败:', error.response?.data);
  }
}

// 删除知识库
async function deleteDataset(datasetId) {
  try {
    const response = await axios.delete(`${API_BASE}/dataset/${datasetId}`, { headers });
    console.log('删除成功');
    return true;
  } catch (error) {
    console.error('删除失败:', error.response?.data);
    return false;
  }
}
```

## 🔍 高级搜索示例

### 不同搜索模式对比

```javascript
// 向量搜索 (语义搜索)
const embeddingResults = await axios.post(`${API_BASE}/search`, {
  datasetId: datasetId,
  text: '如何提升程序性能',
  searchMode: 'embedding',
  limit: 10,
  similarity: 0.7
}, { headers });

// 全文搜索 (关键词匹配)
const fullTextResults = await axios.post(`${API_BASE}/search`, {
  datasetId: datasetId,
  text: 'Node.js 性能优化',
  searchMode: 'fullTextRecall',
  limit: 10
}, { headers });

// 混合搜索 (结合两种方式)
const mixedResults = await axios.post(`${API_BASE}/search`, {
  datasetId: datasetId,
  text: '性能优化方案',
  searchMode: 'mixedRecall',
  limit: 10,
  similarity: 0.6
}, { headers });

console.log('向量搜索结果数量:', embeddingResults.data.data.length);
console.log('全文搜索结果数量:', fullTextResults.data.data.length);
console.log('混合搜索结果数量:', mixedResults.data.data.length);
```

### 批量操作示例

```javascript
// 批量创建知识库
async function createMultipleDatasets() {
  const datasets = [
    { name: 'JavaScript 基础', intro: 'JavaScript 语言基础知识' },
    { name: 'React 开发', intro: 'React 框架开发指南' },
    { name: 'Vue.js 教程', intro: 'Vue.js 框架使用教程' }
  ];

  const results = await Promise.all(
    datasets.map(dataset => 
      axios.post(`${API_BASE}/dataset`, {
        ...dataset,
        type: 'dataset',
        vectorModel: 'text-embedding-3-small',
        agentModel: 'gpt-4o-mini'
      }, { headers })
    )
  );

  console.log('批量创建结果:', results.map(r => r.data.data));
  return results.map(r => r.data.data);
}

// 批量搜索多个知识库
async function searchMultipleDatasets(datasetIds, query) {
  const searchPromises = datasetIds.map(id => 
    axios.post(`${API_BASE}/search`, {
      datasetId: id,
      text: query,
      limit: 3,
      similarity: 0.6
    }, { headers })
  );

  const results = await Promise.all(searchPromises);
  
  // 合并所有结果并按相关性排序
  const allResults = results.flatMap(r => r.data.data);
  allResults.sort((a, b) => b.score - a.score);
  
  console.log('多知识库搜索结果:', allResults.slice(0, 10));
  return allResults;
}
```

## 🔧 错误处理示例

```javascript
// 完整的错误处理示例
async function robustDatasetOperation(operation, ...args) {
  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation(...args);
    } catch (error) {
      lastError = error;
      
      // 根据错误类型决定是否重试
      if (error.response?.status >= 500) {
        console.log(`服务器错误，第 ${i + 1} 次重试...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      } else if (error.response?.status === 429) {
        console.log('触发限流，等待后重试...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      } else {
        // 客户端错误，不重试
        break;
      }
    }
  }

  // 处理最终错误
  console.error('操作最终失败:', lastError.response?.data || lastError.message);
  throw lastError;
}

// 使用示例
try {
  const result = await robustDatasetOperation(
    searchDataset, 
    datasetId, 
    '搜索查询'
  );
  console.log('搜索成功:', result);
} catch (error) {
  console.error('搜索失败:', error.message);
}
```

## 📊 性能优化示例

### 搜索结果缓存

```javascript
class DatasetSearchCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;
    this.ttl = 5 * 60 * 1000; // 5分钟
  }

  _getCacheKey(datasetId, query, options = {}) {
    return `${datasetId}:${query}:${JSON.stringify(options)}`;
  }

  async search(datasetId, query, options = {}) {
    const cacheKey = this._getCacheKey(datasetId, query, options);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log('使用缓存结果');
      return cached.data;
    }

    // 实际搜索
    const result = await searchDataset(datasetId, query);
    
    // 缓存结果
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }
}

const searchCache = new DatasetSearchCache();

// 使用缓存搜索
const results = await searchCache.search(datasetId, '查询文本');
```

### 搜索结果聚合

```javascript
// 搜索结果聚合和排序
function aggregateSearchResults(results) {
  // 按相似度分组
  const groups = {
    high: results.filter(r => r.score >= 0.8),
    medium: results.filter(r => r.score >= 0.6 && r.score < 0.8),
    low: results.filter(r => r.score < 0.6)
  };

  // 统计信息
  const stats = {
    total: results.length,
    highRelevance: groups.high.length,
    mediumRelevance: groups.medium.length,
    lowRelevance: groups.low.length,
    averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length
  };

  return { groups, stats };
}

// 使用示例
const searchResults = await searchDataset(datasetId, '查询文本');
const aggregated = aggregateSearchResults(searchResults);

console.log('搜索统计:', aggregated.stats);
console.log('高相关性结果:', aggregated.groups.high.length);
```

这些示例展示了 FastGPT RAG 系统的完整使用流程。根据实际需求调整参数和配置，可以构建强大的知识库应用。
