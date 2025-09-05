# 新增模型配置说明

## 概述

已成功为 FastGPT RAG 系统添加了以下新模型：

### 1. 阿里-emb3 索引模型
- **模型名称**: `text-embedding-v3`
- **显示名称**: 阿里-emb3
- **提供商**: Alibaba
- **最大Token**: 2048
- **默认Token**: 512
- **向量维度**: 1536
- **用途**: 文本向量化和语义搜索

### 2. Qwen-max 向量模型
- **模型名称**: `qwen-max`
- **显示名称**: Qwen-max
- **提供商**: Alibaba
- **最大Token**: 8192
- **默认Token**: 1024
- **向量维度**: 1536
- **用途**: 高性能文本向量化

### 3. GLM-4V-Flash 图片理解模型
- **模型名称**: `glm-4v-flash`
- **显示名称**: GLM-4V-Flash
- **提供商**: Zhipu
- **最大上下文**: 32000
- **最大响应**: 8000
- **支持视觉**: ✅
- **用途**: 图片理解和多模态处理

## 使用方法

### 环境变量配置

在 `.env` 文件中可以设置默认模型：

```env
# 使用阿里-emb3作为默认向量模型
DEFAULT_VECTOR_MODEL=text-embedding-v3

# 使用Qwen-max作为默认向量模型
DEFAULT_VECTOR_MODEL=qwen-max

# 使用GLM-4V-Flash作为默认视觉模型
DEFAULT_VLM_MODEL=glm-4v-flash
```

### API 调用示例

#### 创建知识库时指定向量模型

```bash
POST /api/core/dataset
Content-Type: application/json

{
  "name": "测试知识库",
  "intro": "使用阿里-emb3模型的知识库",
  "type": "dataset",
  "vectorModel": "text-embedding-v3",
  "agentModel": "gpt-4o-mini"
}
```

#### 使用Qwen-max向量模型

```bash
POST /api/core/dataset
Content-Type: application/json

{
  "name": "高性能知识库",
  "intro": "使用Qwen-max模型的知识库",
  "type": "dataset",
  "vectorModel": "qwen-max",
  "agentModel": "gpt-4o-mini"
}
```

#### 使用GLM-4V-Flash进行图片处理

```bash
# 在搜索或处理时可以指定使用支持视觉的模型
POST /api/core/dataset/searchTest
Content-Type: application/json

{
  "datasetId": "your-dataset-id",
  "text": "这张图片显示了什么？",
  "limit": 10,
  "similarity": 0.6,
  "searchMode": "mixedRecall",
  "model": "glm-4v-flash"
}
```

## 模型特性对比

| 模型 | 类型 | 最大Token | 向量维度 | 视觉支持 | 适用场景 |
|------|------|-----------|----------|----------|----------|
| 阿里-emb3 | 向量模型 | 2048 | 1536 | ❌ | 中文文本向量化 |
| Qwen-max | 向量模型 | 8192 | 1536 | ❌ | 长文本向量化 |
| GLM-4V-Flash | 语言模型 | 32000 | N/A | ✅ | 图片理解、多模态 |

## 注意事项

1. **API Key配置**: 确保在OneAPI中配置了对应的模型密钥
2. **模型可用性**: 请确认在你的OneAPI服务中这些模型是可用的
3. **计费**: 不同模型可能有不同的计费标准
4. **性能**: 不同模型的响应时间和精度可能有差异

## 故障排除

### 模型无法使用
1. 检查OneAPI中是否配置了对应的模型
2. 确认API Key有足够的配额
3. 查看日志文件确认具体错误信息

### 向量维度不匹配
如果遇到向量维度问题，可能需要：
1. 重新创建向量数据库索引
2. 清理旧的向量数据
3. 重新向量化现有数据

## 更多信息

- 阿里云模型文档: [通义千问API文档](https://help.aliyun.com/zh/dashscope/)
- 智谱AI文档: [GLM-4V API文档](https://open.bigmodel.cn/doc)
- FastGPT RAG项目: 参考项目README.md文件
