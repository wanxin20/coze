# FastGPTRAG 图片解析功能配置指南

FastGPTRAG 现已完整支持图片解析功能，完全复刻了 FastGPT 的 VLM (Vision Language Model) 能力。本文档详细说明如何配置和使用图片解析功能。

## 🎯 功能概述

### 支持的图片解析功能
- ✅ **图片内容识别**: 使用 VLM 模型识别图片中的内容
- ✅ **图片描述生成**: 自动生成详细的图片描述用于检索
- ✅ **图片训练模式**: 支持 `image` 和 `imageParse` 两种训练模式
- ✅ **批量图片处理**: 支持批量处理多张图片
- ✅ **多种 VLM 模型**: 支持 OpenAI、Claude、Qwen、Gemini 等主流 VLM 模型

### 支持的图片格式
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)

## 🔧 VLM 模型配置

### 1. OpenAI GPT-4 Vision 配置

在 `.env` 文件中添加：
```bash
# OpenAI 配置
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，默认为官方 API

# 支持的模型
# - gpt-4o (推荐)
# - gpt-4o-mini (经济型)
```

### 2. Claude 3.5 Sonnet 配置

```bash
# Claude 配置
CLAUDE_API_KEY=sk-ant-your-claude-api-key

# 支持的模型
# - claude-3-5-sonnet-20241022 (最新版本)
```

### 3. 通义千问 VL 配置

```bash
# 阿里云 DashScope 配置
DASHSCOPE_API_KEY=sk-your-dashscope-api-key

# 支持的模型
# - qwen-vl-max (推荐)
```

### 4. Google Gemini 配置

```bash
# Google Gemini 配置
GEMINI_API_KEY=your-gemini-api-key

# 支持的模型
# - gemini-pro-vision
```

## 📡 API 接口使用

### 1. 处理单张图片

```bash
curl -X POST http://localhost:3300/api/image/process \
  -H "Authorization: Bearer your-token" \
  -F "image=@/path/to/your/image.jpg" \
  -F "generateDescription=true" \
  -F "vlmModel=gpt-4o" \
  -F "customPrompt=请详细描述这张图片的内容"
```

### 2. 批量处理图片

```bash
curl -X POST http://localhost:3300/api/image/batch-process \
  -H "Authorization: Bearer your-token" \
  -F "images=@image1.jpg" \
  -F "images=@image2.png" \
  -F "generateDescription=true" \
  -F "vlmModel=gpt-4o-mini" \
  -F "concurrency=3"
```

### 3. 图片训练

```bash
curl -X POST http://localhost:3300/api/image/train \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "imageParse",
    "imageList": [
      {
        "uuid": "image-uuid-1",
        "base64": "base64-encoded-image-data",
        "mime": "image/jpeg"
      }
    ],
    "vlmModel": "gpt-4o",
    "datasetId": "your-dataset-id",
    "collectionId": "your-collection-id"
  }'
```

### 4. 获取可用模型

```bash
curl -X GET http://localhost:3300/api/image/vlm-models \
  -H "Authorization: Bearer your-token"
```

### 5. 估算处理成本

```bash
curl -X POST http://localhost:3300/api/image/estimate-cost \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "imageCount": 10,
    "mode": "imageParse",
    "vlmModel": "gpt-4o"
  }'
```

## 🎯 训练模式说明

### Image 模式 (image)
- **用途**: 为文档中的图片生成基础描述用于检索索引
- **特点**: 生成简洁的描述，适合大批量处理
- **Token 消耗**: 较少 (~800 tokens/图片)
- **处理时间**: 较快 (~3秒/图片)

### ImageParse 模式 (imageParse)
- **用途**: 深度解析图片内容，生成详细描述
- **特点**: 提供全面的图片分析，包括文字识别、结构分析等
- **Token 消耗**: 较多 (~1500 tokens/图片)
- **处理时间**: 较慢 (~5秒/图片)

## 💡 最佳实践

### 1. 模型选择建议

**高质量场景 (推荐)**:
- GPT-4O: 最佳的图片理解能力，支持复杂场景
- Claude 3.5 Sonnet: 优秀的文字识别和逻辑分析

**经济型场景**:
- GPT-4O Mini: 性价比高，适合大批量处理
- Qwen-VL-Max: 中文场景表现优异，成本较低

### 2. 提示词优化

**基础图片描述**:
```
请简洁地描述这张图片的主要内容，包括主要对象、场景和重要的文字信息。用中文回答，50字以内。
```

**详细图片解析**:
```
请详细分析这张图片：
1. 主要内容和主题
2. 视觉元素（颜色、构图、风格）
3. 文字信息（准确识别并转录）
4. 技术细节（如果是图表、界面等）
5. 关键词提取
请用中文回答，描述要详细准确。
```

### 3. 批处理优化

- 建议并发数设置为 3-5，避免 API 限制
- 大批量处理时使用 `image` 模式以节省成本
- 定期监控 Token 使用量和成本

### 4. 错误处理

系统已内置完善的错误处理机制：
- API 调用失败时自动重试
- 不支持的图片格式会提供友好提示
- 处理失败的图片会使用默认描述

## 📊 性能参考

### 处理速度 (单张图片)
- GPT-4O: 3-5 秒
- GPT-4O Mini: 2-3 秒  
- Claude 3.5 Sonnet: 4-6 秒
- Qwen-VL-Max: 2-4 秒

### Token 消耗 (每张图片)
- Image 模式: 600-1000 tokens
- ImageParse 模式: 1200-1800 tokens

### 成本估算 (每张图片)
- GPT-4O: $0.01-0.02
- GPT-4O Mini: $0.002-0.005
- Claude 3.5 Sonnet: $0.008-0.015
- Qwen-VL-Max: $0.002-0.004

## 🛠️ 故障排除

### 常见问题

1. **"VLM model not found"**
   - 检查环境变量是否正确配置
   - 确认 API Key 有效

2. **"Unsupported image format"**
   - 确认图片格式在支持列表中
   - 检查图片文件是否损坏

3. **API 调用超时**
   - 检查网络连接
   - 考虑使用更快的模型或减小图片尺寸

4. **Token 限制错误**
   - 检查 API Key 的配额
   - 考虑使用更经济的模型

### 日志查看

系统会详细记录图片处理过程：
```bash
# 查看服务日志
docker logs fastgpt-rag

# 或查看日志文件
tail -f logs/app.log
```

## 🔄 升级说明

从之前版本升级到支持图片解析的版本：

1. 更新代码到最新版本
2. 配置 VLM 模型的环境变量
3. 重启服务
4. 测试图片处理功能

系统向下兼容，现有的文本处理功能不受影响。

---

通过以上配置，FastGPTRAG 现在具备了与 FastGPT 原版相同的图片解析能力，可以为企业知识库提供完整的多模态内容处理支持。
