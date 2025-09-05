# 直接API配置指南

## 概述

本配置文件已设置为使用以下默认模型，并支持直接通过API调用：

- **默认索引模型**: 阿里-emb3 (`text-embedding-v3`)
- **默认向量模型**: Qwen-max (`qwen-max`)  
- **默认图片理解模型**: GLM-4V-Flash (`glm-4v-flash`)

## 🔧 配置步骤

### 1. 复制环境变量文件
```bash
cp env.example .env
```

### 2. 配置API密钥

在 `.env` 文件中填入你的API密钥：

```env
# 阿里云 DashScope API 配置
ALIBABA_API_KEY=sk-your-dashscope-api-key
ALIBABA_API_URL=https://dashscope.aliyuncs.com/api/v1

# 智谱AI GLM API 配置  
ZHIPU_API_KEY=your-zhipu-api-key
ZHIPU_API_URL=https://open.bigmodel.cn/api/paas/v4
```

### 3. 默认模型配置
```env
# 系统将使用以下默认模型
DEFAULT_VECTOR_MODEL=text-embedding-v3    # 阿里-emb3
DEFAULT_LLM_MODEL=qwen-max                 # Qwen-max  
DEFAULT_VLM_MODEL=glm-4v-flash            # GLM-4V-Flash
```

## 🔑 获取API密钥

### 阿里云 DashScope API Key

1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 登录你的阿里云账号
3. 开通 DashScope 服务
4. 在"API-KEY管理"中创建新的 API Key
5. 复制生成的 API Key (格式: `sk-xxxxxxxxxxxxxxxx`)

### 智谱AI API Key

1. 访问 [智谱AI 开放平台](https://open.bigmodel.cn/)
2. 注册并登录账号
3. 在控制台中创建API Key
4. 复制生成的 API Key

## 📋 模型详细信息

### 阿里-emb3 (text-embedding-v3)
```
- 提供商: Alibaba
- 最大Token: 2048
- 默认Token: 512
- 向量维度: 1536
- API端点: https://dashscope.aliyuncs.com/api/v1
```

### Qwen-max
```  
- 提供商: Alibaba
- 最大Token: 8192
- 默认Token: 1024
- 向量维度: 1536
- API端点: https://dashscope.aliyuncs.com/api/v1
```

### GLM-4V-Flash
```
- 提供商: Zhipu
- 最大上下文: 32000
- 最大响应: 8000
- 支持视觉: ✅
- API端点: https://open.bigmodel.cn/api/paas/v4
```

## 🚀 启动服务

配置完成后，启动服务：

```bash
# 安装依赖
npm install

# 编译项目
npm run build

# 初始化数据库
npm run db:init

# 启动服务
npm run dev
```

## 📝 使用示例

### 创建使用默认模型的知识库

```bash
POST http://localhost:3001/api/core/dataset
Content-Type: application/json
x-team-id: your-team-id
x-user-id: your-user-id

{
  "name": "测试知识库",
  "intro": "使用阿里云模型的知识库",
  "type": "dataset"
}
```

### 使用图片理解功能

```bash
POST http://localhost:3001/api/core/dataset/searchTest
Content-Type: application/json
x-team-id: your-team-id
x-user-id: your-user-id

{
  "datasetId": "your-dataset-id",
  "text": "分析这张图片的内容",
  "limit": 5,
  "similarity": 0.6,
  "searchMode": "mixedRecall"
}
```

## ⚠️ 注意事项

1. **API配额**: 确保你的API账户有足够的配额
2. **计费**: 不同模型的使用会产生费用，请关注账单
3. **安全**: 不要将API Key提交到代码仓库
4. **网络**: 确保服务器能访问相应的API端点

## 🔍 故障排除

### 常见错误

1. **API Key无效**
   - 检查API Key是否正确
   - 确认API Key是否已激活

2. **配额不足**
   - 检查账户余额
   - 升级API服务套餐

3. **网络连接问题**
   - 检查防火墙设置
   - 验证API端点可访问性

### 调试模式

启用详细日志：
```bash
LOG_LEVEL=debug npm run dev
```

查看日志文件：
```bash
tail -f logs/combined.log
```

## 🆚 对比OneAPI方式

| 方式 | 优势 | 劣势 |
|------|------|------|
| 直接API | 简单配置，无中间层 | 需要管理多个API Key |
| OneAPI | 统一管理，额度控制 | 需要额外部署OneAPI服务 |

选择直接API方式适合：
- 简单部署场景
- 模型提供商较少
- 不需要复杂的访问控制

## 📞 技术支持

如遇问题，请检查：
1. 环境变量配置是否正确
2. API Key是否有效
3. 网络连接是否正常
4. 服务日志中的错误信息
