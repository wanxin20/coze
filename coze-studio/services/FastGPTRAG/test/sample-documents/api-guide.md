# FastGPT RAG API 使用指南

## 概述

FastGPT RAG (Retrieval-Augmented Generation) 是一个强大的知识库问答系统，提供完整的RESTful API接口，支持从文档上传到智能搜索的全流程操作。

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 服务将在 http://localhost:3001 启动
```

### 2. 基础配置

```javascript
const config = {
  baseURL: 'http://localhost:3001',
  teamId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012'
};
```

## 核心概念

### 知识库 (Dataset)
- 最顶层的组织单位
- 包含多个集合
- 支持权限管理和团队协作

### 集合 (Collection)
- 知识库下的数据组织单位
- 可以包含文本、文件或链接数据
- 支持不同的处理模式

### 文件上传集合
- 支持多种文件格式：PDF、DOCX、TXT、MD、HTML、CSV等
- 自动处理文件内容并创建集合
- 支持自定义分块大小和处理模式

### 数据 (Data)
- 最小的信息单位
- 通常是问答对或文本块
- 支持向量化和搜索

## API接口详解

### 1. 健康检查

检查服务状态和连接性。

```http
GET /health
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 知识库管理

#### 创建知识库

```http
POST /api/core/dataset
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "name": "我的知识库",
  "intro": "这是一个测试知识库",
  "type": "dataset",
  "vectorModel": "text-embedding-v3",
  "agentModel": "qwen-max"
}
```

**响应示例：**
```json
{
  "code": 200,
  "data": "65abc9bd9d1448617cba5e6c"
}
```

#### 获取知识库详情

```http
GET /api/core/dataset/{datasetId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 获取知识库列表

```http
GET /api/core/dataset
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 删除知识库

```http
DELETE /api/core/dataset/{datasetId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

### 3. 集合管理

#### 创建文本集合

```http
POST /api/core/dataset/collection
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "datasetId": "65abc9bd9d1448617cba5e6c",
  "name": "文本集合示例",
  "type": "text",
  "rawText": "这是要添加到知识库的文本内容...",
  "trainingType": "chunk",
  "chunkSize": 300,
  "chunkSplitter": "\n"
}
```

#### 文件上传集合

```http
POST /api/core/dataset/file/upload
Content-Type: multipart/form-data
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

form-data:
  file: [文件]
  datasetId: 65abc9bd9d1448617cba5e6c
  collectionName: 文档集合
  chunkSize: 300
  chunkSplitter: \n\n
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "collectionId": "65abc044e4704bac793fbd81",
    "insertedCount": 15
  }
}
```

#### 获取集合列表

```http
GET /api/core/dataset/collection?datasetId={datasetId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 获取集合详情

```http
GET /api/core/dataset/collection/{collectionId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 获取训练状态

```http
GET /api/core/dataset/collection/{collectionId}/training
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "processing": 0,
    "completed": 15,
    "total": 15
  }
}
```

### 4. 数据管理

#### 添加单条数据

```http
POST /api/core/dataset/data
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "collectionId": "65abc044e4704bac793fbd81",
  "q": "什么是FastGPT？",
  "a": "FastGPT是一个基于大语言模型的知识库问答系统。",
  "chunkIndex": 10
}
```

#### 批量添加数据

```http
POST /api/core/dataset/data/push
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "collectionId": "65abc044e4704bac793fbd81",
  "data": [
    {
      "q": "问题1",
      "a": "答案1"
    },
    {
      "q": "问题2", 
      "a": "答案2"
    }
  ],
  "mode": "chunk"
}
```

#### 获取数据列表

```http
GET /api/core/dataset/data?collectionId={collectionId}&pageSize=20
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 获取数据详情

```http
GET /api/core/dataset/data/{dataId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 更新数据

```http
PUT /api/core/dataset/data/{dataId}
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "q": "更新后的问题",
  "a": "更新后的答案"
}
```

#### 删除数据

```http
DELETE /api/core/dataset/data/{dataId}
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

### 5. 搜索功能

#### 基础搜索测试

```http
POST /api/core/dataset/searchTest
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "datasetId": "65abc9bd9d1448617cba5e6c",
  "text": "FastGPT是什么",
  "limit": 5,
  "similarity": 0.3,
  "searchMode": "embedding"
}
```

**搜索模式：**
- `embedding`: 向量搜索（默认）
- `mixedRecall`: 混合搜索
- `fullTextRecall`: 全文搜索

**响应示例：**
```json
{
  "code": 200,
  "data": [
    {
      "score": 0.95,
      "q": "什么是FastGPT？",
      "a": "FastGPT是一个基于大语言模型的知识库问答系统...",
      "id": "65abc123def456789"
    }
  ]
}
```

#### 高级搜索

```http
POST /api/search/advanced
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "datasetId": "65abc9bd9d1448617cba5e6c",
  "text": "文档格式 支持",
  "limit": 3,
  "similarity": 0.2,
  "usingReRank": false
}
```

#### 深度搜索

```http
POST /api/search/deep
Content-Type: application/json
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002

{
  "datasetId": "65abc9bd9d1448617cba5e6c",
  "text": "企业应用场景",
  "limit": 3,
  "maxIterations": 2
}
```

### 6. 监控接口

#### 系统健康监控

```http
GET /api/monitoring/health
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 使用统计

```http
GET /api/monitoring/usage?period=daily&limit=10
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

#### 审计日志

```http
GET /api/monitoring/audit?limit=20
x-team-id: 000000000000000000000001
x-user-id: 000000000000000000000002
```

## 完整流程示例

### 1. JavaScript/Node.js 示例

```javascript
// 1. 创建知识库
const datasetResponse = await fetch('http://localhost:3001/api/core/dataset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-team-id': '507f1f77bcf86cd799439011',
    'x-user-id': '507f1f77bcf86cd799439012'
  },
  body: JSON.stringify({
    name: '测试知识库',
    intro: '用于API测试的知识库',
    type: 'dataset'
  })
});
const datasetId = (await datasetResponse.json()).data;

// 2. 创建文本集合
const collectionResponse = await fetch('http://localhost:3001/api/core/dataset/collection', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-team-id': '507f1f77bcf86cd799439011',
    'x-user-id': '507f1f77bcf86cd799439012'
  },
  body: JSON.stringify({
    datasetId,
    name: '文本集合',
    type: 'text',
    rawText: 'FastGPT是一个知识库问答系统...',
    trainingType: 'chunk',
    chunkSize: 300
  })
});
const collectionId = (await collectionResponse.json()).data;

// 3. 等待训练完成
let training = true;
while (training) {
  const trainingResponse = await fetch(`http://localhost:3001/api/core/dataset/collection/${collectionId}/training`, {
    headers: {
      'x-team-id': '507f1f77bcf86cd799439011',
      'x-user-id': '507f1f77bcf86cd799439012'
    }
  });
  const trainingData = (await trainingResponse.json()).data;
  training = trainingData.processing > 0;
  if (training) await new Promise(resolve => setTimeout(resolve, 2000));
}

// 4. 搜索测试
const searchResponse = await fetch('http://localhost:3001/api/core/dataset/searchTest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-team-id': '507f1f77bcf86cd799439011',
    'x-user-id': '507f1f77bcf86cd799439012'
  },
  body: JSON.stringify({
    datasetId,
    text: 'FastGPT是什么',
    limit: 5,
    similarity: 0.3
  })
});
const searchResults = (await searchResponse.json()).data;
console.log('搜索结果:', searchResults);
```

### 2. Python 示例

```python
import requests
import time

# 配置
BASE_URL = 'http://localhost:3001'
HEADERS = {
    'Content-Type': 'application/json',
    'x-team-id': '507f1f77bcf86cd799439011',
    'x-user-id': '507f1f77bcf86cd799439012'
}

# 1. 创建知识库
dataset_data = {
    'name': '测试知识库',
    'intro': '用于API测试的知识库',
    'type': 'dataset'
}
response = requests.post(f'{BASE_URL}/api/core/dataset', json=dataset_data, headers=HEADERS)
dataset_id = response.json()['data']

# 2. 创建集合
collection_data = {
    'datasetId': dataset_id,
    'name': '文本集合',
    'type': 'text',
    'rawText': 'FastGPT是一个知识库问答系统...',
    'trainingType': 'chunk',
    'chunkSize': 300
}
response = requests.post(f'{BASE_URL}/api/core/dataset/collection', json=collection_data, headers=HEADERS)
collection_id = response.json()['data']

# 3. 等待训练完成
while True:
    response = requests.get(f'{BASE_URL}/api/core/dataset/collection/{collection_id}/training', headers=HEADERS)
    training_data = response.json()['data']
    if training_data['processing'] == 0:
        break
    time.sleep(2)

# 4. 搜索测试
search_data = {
    'datasetId': dataset_id,
    'text': 'FastGPT是什么',
    'limit': 5,
    'similarity': 0.3
}
response = requests.post(f'{BASE_URL}/api/core/dataset/searchTest', json=search_data, headers=HEADERS)
search_results = response.json()['data']
print('搜索结果:', search_results)
```

## 错误处理

### 常见错误码

- `200`: 请求成功
- `400`: 参数错误
- `401`: 未授权访问
- `404`: 资源不存在
- `500`: 服务器内部错误

### 错误响应格式

```json
{
  "code": 400,
  "message": "参数错误",
  "data": null
}
```

### 错误处理最佳实践

```javascript
async function apiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.code === 200) {
      return data.data;
    } else {
      throw new Error(data.message || '请求失败');
    }
  } catch (error) {
    console.error('API请求错误:', error.message);
    throw error;
  }
}
```

## 性能优化建议

### 1. 分块大小优化
- 短文本：100-200字符
- 中等文本：200-500字符
- 长文本：500-1000字符

### 2. 搜索参数调优
- 相似度阈值：0.2-0.8之间调整
- 结果数量：建议不超过20条
- 搜索模式：根据场景选择合适的模式

### 3. 批量操作
- 使用批量添加接口提高效率
- 避免频繁的单条操作
- 合理控制并发请求数量

## 最佳实践

### 1. 数据组织
- 合理规划知识库结构
- 按主题创建不同集合
- 保持数据的一致性和准确性

### 2. 安全考虑
- 验证用户权限
- 过滤敏感信息
- 使用HTTPS传输

### 3. 监控和日志
- 定期检查系统健康状态
- 监控API调用频率
- 记录重要操作日志

## 故障排除

### 常见问题

**Q: 文件上传失败？**
A: 检查文件格式、大小限制，确认网络连接

**Q: 搜索结果不准确？**
A: 调整相似度阈值，优化文档分块，使用重排序

**Q: 训练时间过长？**
A: 检查文档大小，优化分块策略，使用更快的向量模型

**Q: API调用失败？**
A: 检查认证信息，确认服务状态，查看错误日志

### 调试技巧

1. 使用健康检查接口确认服务状态
2. 查看详细的错误信息和堆栈跟踪
3. 使用小数据集进行功能验证
4. 逐步增加数据量测试性能

## 更新日志

- v1.0.0: 基础API功能
- v1.1.0: 新增文件上传支持
- v1.2.0: 增强搜索功能
- v1.3.0: 添加监控接口

## 技术支持

如有问题，请联系技术支持或查看更多文档：
- 项目仓库：https://github.com/your-repo/fastgpt-rag
- 文档站点：https://docs.your-domain.com
- 问题反馈：issues@your-domain.com
