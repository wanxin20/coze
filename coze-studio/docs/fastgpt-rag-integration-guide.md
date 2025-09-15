# FastGPTRAG 统一管理集成指南

## 概述

本指南介绍了如何使用 Coze 统一管理 FastGPTRAG 微服务的集成方案。通过 DatasetID 作为唯一标识，实现权限统一管理和简化调用。

## 核心设计理念

### 统一管理方案
- **唯一标识**: 使用 FastGPTRAG 的 `DatasetID` 作为知识库的唯一标识
- **权限集中**: 由 Coze 端统一管理知识库的权限和访问控制
- **简化调用**: 调用时只需要 DatasetID，teamid 和 userid 使用默认值
- **最小改动**: 保持现有逻辑不变，通过扩展字段实现集成

## 架构变更

### 数据库变更
```sql
-- 为 knowledge 表添加 rag_dataset_id 字段
ALTER TABLE knowledge ADD COLUMN rag_dataset_id VARCHAR(255) NULL 
COMMENT 'FastGPTRAG Dataset ID for unified management';

-- 添加索引
CREATE INDEX idx_knowledge_rag_dataset_id ON knowledge(rag_dataset_id);
```

### API 变更

#### 1. 知识库创建
- Coze 创建知识库时，同时在 FastGPTRAG 中创建对应的 Dataset
- 将返回的 DatasetID 存储在 `knowledge.rag_dataset_id` 字段中
- 建立 Coze Knowledge 与 FastGPTRAG Dataset 的映射关系

#### 2. 知识库搜索
```go
// 新增的统一搜索方法
func (app *RAGApplication) SearchByKnowledgeID(
    ctx context.Context, 
    knowledgeID int64, 
    query string, 
    topK int, 
    scoreThreshold float64, 
    searchMode string
) (*ragModel.RagSearchResponse, error)
```

## 使用方式

### 1. 创建知识库

**前端用户体验**:
1. 用户点击"创建知识库"
2. 系统显示类型选择弹窗：
   - Coze 原生知识库
   - FastGPT RAG 知识库
3. 选择 FastGPT RAG 后，系统自动创建并关联

**后端处理流程**:
```go
// 1. 调用 FastGPTRAG 创建 Dataset
dataset := &entity.RAGDataset{
    Name:        req.Name,
    Description: req.Description,
    Type:        "dataset",
    VectorModel: "text-embedding-v3",
    AgentModel:  "qwen-max",
}
err := ragClient.CreateDataset(ctx, dataset)

// 2. 创建 Coze Knowledge 并关联 DatasetID
knowledge := &service.CreateKnowledgeRequest{
    Name:         req.Name,
    Description:  req.Description,
    RagDatasetID: dataset.ID, // 关键：存储 DatasetID
    // ... 其他字段
}
```

### 2. 知识库搜索

**推荐方式**（通过 Coze Knowledge ID）:
```go
response, err := ragApp.SearchByKnowledgeID(
    ctx,
    knowledgeID, // Coze 知识库 ID
    "搜索问题",
    10,          // topK
    0.7,         // 相似度阈值
    "semantic",  // 搜索模式
)
```

**传统方式**（直接使用 DatasetID）:
```go
response, err := ragApp.RagSearch(ctx, &ragModel.RagSearchRequest{
    DatasetId:   datasetID, // FastGPTRAG DatasetID
    Text:        "搜索问题",
    Limit:       10,
    Similarity:  0.7,
    SearchMode:  "semantic",
})
```

### 3. 权限管理

- **统一认证**: 所有权限验证在 Coze 端进行
- **默认用户**: FastGPTRAG 调用使用默认的 teamid 和 userid
- **简化流程**: 不需要在 FastGPTRAG 端维护用户体系

## 配置说明

### FastGPTRAG 服务配置
```typescript
// FastGPTRAG 默认认证上下文
const authContext = {
  teamId: '000000000000000000000001', // 默认团队ID
  tmbId: '000000000000000000000002',  // 默认用户ID
  userId: '000000000000000000000002'  // 默认用户ID
};
```

### Coze 后端配置
```yaml
rag:
  base_url: "http://fastgpt-rag:3000"
  timeout: "30s"
  max_retries: 3
  auth_token: "your-auth-token"
```

## API 接口说明

### 1. 创建 FastGPT 知识库
```http
POST /api/knowledge/rag/core/dataset/
Content-Type: application/json

{
  "name": "知识库名称",
  "intro": "知识库描述",
  "type": "dataset",
  "vectorModel": "text-embedding-v3",
  "agentModel": "qwen-max"
}
```

### 2. 统一搜索接口
```http
POST /api/knowledge/{knowledgeId}/search
Content-Type: application/json

{
  "query": "搜索问题",
  "topK": 10,
  "scoreThreshold": 0.7,
  "searchMode": "semantic"
}
```

## 兼容性保证

### 向后兼容
- 现有的 Coze 原生知识库功能不受影响
- 现有的 RAG 调用方式继续支持
- 数据库字段为可选，不影响现有数据

### 渐进式迁移
- 可以逐步将现有知识库迁移到 FastGPTRAG
- 支持混合使用两种知识库类型
- 迁移过程中不会中断服务

## 监控和维护

### 日志记录
- 记录所有 FastGPTRAG 调用的请求和响应
- 监控 DatasetID 的使用情况
- 跟踪权限验证结果

### 性能监控
- 监控搜索响应时间
- 跟踪 token 使用量
- 监控错误率和重试次数

### 数据一致性
- 定期检查 Coze Knowledge 与 FastGPTRAG Dataset 的映射关系
- 监控孤立的 Dataset（无对应 Knowledge）
- 定期清理无效的映射关系

## 故障排除

### 常见问题

1. **DatasetID 为空**
   - 检查知识库是否正确创建
   - 验证 FastGPTRAG 服务是否正常

2. **搜索无结果**
   - 确认 Dataset 中是否有数据
   - 检查搜索参数设置
   - 验证相似度阈值是否合理

3. **权限错误**
   - 确认 Coze 端权限设置
   - 检查 Knowledge ID 是否有效
   - 验证用户是否有访问权限

### 调试工具
```bash
# 检查 DatasetID 映射
SELECT id, name, rag_dataset_id FROM knowledge WHERE rag_dataset_id IS NOT NULL;

# 验证 FastGPTRAG 服务连接
curl -X GET http://fastgpt-rag:3000/health

# 测试搜索功能
curl -X POST http://fastgpt-rag:3000/api/search \
  -H "Content-Type: application/json" \
  -H "x-team-id: 000000000000000000000001" \
  -H "x-user-id: 000000000000000000000002" \
  -d '{"datasetId": "your-dataset-id", "text": "test query"}'
```

## 总结

通过本集成方案，实现了：
- ✅ DatasetID 作为唯一标识的统一管理
- ✅ Coze 端权限的集中控制
- ✅ 简化的调用接口
- ✅ 最小化的代码修改
- ✅ 良好的向后兼容性

这种设计既满足了统一管理的需求，又保持了系统的灵活性和可维护性。
