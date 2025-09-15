import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import axios from 'axios';

/**
 * VLM (Vision Language Model) 服务 - 复刻FastGPT的图片理解功能
 * 支持多种VLM模型进行图片内容解析和描述生成
 */

export interface VLMModelConfig {
  name: string;
  model: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
  vision: boolean;
  provider: 'openai' | 'claude' | 'gemini' | 'qwen' | 'custom';
}

export interface ImageDescriptionRequest {
  imageBase64: string;
  imageMime: string;
  prompt?: string;
  model?: string;
}

export interface ImageDescriptionResponse {
  description: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// 默认VLM模型配置
const DEFAULT_VLM_MODELS: Record<string, VLMModelConfig> = {
  'gpt-4o': {
    name: 'GPT-4O',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    maxTokens: 4096,
    vision: true,
    provider: 'openai'
  },
  'gpt-4o-mini': {
    name: 'GPT-4O Mini',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    maxTokens: 4096,
    vision: true,
    provider: 'openai'
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.CLAUDE_API_KEY,
    endpoint: 'https://api.anthropic.com',
    maxTokens: 4096,
    vision: true,
    provider: 'claude'
  },
  'qwen-vl-max': {
    name: 'Qwen-VL-Max',
    model: 'qwen-vl-max',
    apiKey: process.env.DASHSCOPE_API_KEY,
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
    maxTokens: 2048,
    vision: true,
    provider: 'qwen'
  },
  'gemini-pro-vision': {
    name: 'Gemini Pro Vision',
    model: 'gemini-pro-vision',
    apiKey: process.env.GEMINI_API_KEY,
    endpoint: 'https://generativelanguage.googleapis.com/v1',
    maxTokens: 2048,
    vision: true,
    provider: 'gemini'
  },
  'THUDM/GLM-4.1V-9B-Thinking': {
    name: 'GLM-4.1V-9B-Thinking',
    model: 'THUDM/GLM-4.1V-9B-Thinking',
    apiKey: process.env.SILICONFLOW_API_KEY,
    endpoint: process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1',
    maxTokens: 4096,
    vision: true,
    provider: 'custom'
  }
};

export class VLMService {
  private models: Map<string, VLMModelConfig> = new Map();
  private defaultModel: string;

  constructor() {
    // 初始化模型配置
    Object.entries(DEFAULT_VLM_MODELS).forEach(([key, config]) => {
      if (config.apiKey) { // 只添加有API Key的模型
        this.models.set(key, config);
      }
    });

    // 设置默认模型 - 优先使用环境变量配置
    const envDefaultModel = process.env.DEFAULT_VLM_MODEL;
    if (envDefaultModel && this.models.has(envDefaultModel)) {
      this.defaultModel = envDefaultModel;
    } else {
      this.defaultModel = this.getAvailableModels()[0] || 'gpt-4o-mini';
    }
    
    logger.info(`VLM Service initialized with ${this.models.size} models, default: ${this.defaultModel}`);
  }

  /**
   * 获取可用的VLM模型列表
   */
  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * 获取模型配置
   */
  getModelConfig(modelName?: string): VLMModelConfig | null {
    const model = modelName || this.defaultModel;
    return this.models.get(model) || null;
  }

  /**
   * 生成图片描述 - 主要接口
   */
  async generateImageDescription(request: ImageDescriptionRequest): Promise<ImageDescriptionResponse> {
    const {
      imageBase64,
      imageMime,
      prompt = "请详细描述这张图片的内容，包括主要对象、场景、文字信息等。用中文回答。",
      model: requestModel
    } = request;

    const modelName = requestModel || this.defaultModel;
    const modelConfig = this.getModelConfig(modelName);

    if (!modelConfig) {
      throw new Error(`VLM model ${modelName} not found or not configured`);
    }

    logger.info(`Generating image description using model: ${modelName}`);

    try {
      switch (modelConfig.provider) {
        case 'openai':
          return await this.callOpenAIVision(imageBase64, imageMime, prompt, modelConfig);
        case 'claude':
          return await this.callClaudeVision(imageBase64, imageMime, prompt, modelConfig);
        case 'qwen':
          return await this.callQwenVision(imageBase64, imageMime, prompt, modelConfig);
        case 'gemini':
          return await this.callGeminiVision(imageBase64, imageMime, prompt, modelConfig);
        case 'custom':
          // 硅基流动等自定义提供商使用OpenAI兼容接口
          return await this.callCustomVision(imageBase64, imageMime, prompt, modelConfig);
        default:
          throw new Error(`Unsupported VLM provider: ${modelConfig.provider}`);
      }
    } catch (error) {
      logger.error(`Failed to generate image description with ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * 调用OpenAI Vision API
   */
  private async callOpenAIVision(
    imageBase64: string,
    imageMime: string,
    prompt: string,
    config: VLMModelConfig
  ): Promise<ImageDescriptionResponse> {
    const response = await axios.post(
      `${config.endpoint}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMime};base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: config.maxTokens,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const result = response.data;
    return {
      description: result.choices[0].message.content.trim(),
      model: config.model,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0
    };
  }

  /**
   * 调用Claude Vision API
   */
  private async callClaudeVision(
    imageBase64: string,
    imageMime: string,
    prompt: string,
    config: VLMModelConfig
  ): Promise<ImageDescriptionResponse> {
    const response = await axios.post(
      `${config.endpoint}/v1/messages`,
      {
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMime,
                  data: imageBase64
                }
              }
            ]
          }
        ],
        temperature: 0.1
      },
      {
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 60000
      }
    );

    const result = response.data;
    return {
      description: result.content[0].text.trim(),
      model: config.model,
      inputTokens: result.usage?.input_tokens || 0,
      outputTokens: result.usage?.output_tokens || 0
    };
  }

  /**
   * 调用Qwen Vision API
   */
  private async callQwenVision(
    imageBase64: string,
    imageMime: string,
    prompt: string,
    config: VLMModelConfig
  ): Promise<ImageDescriptionResponse> {
    const response = await axios.post(
      `${config.endpoint}/services/aigc/multimodal-generation/generation`,
      {
        model: config.model,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { text: prompt },
                { image: `data:${imageMime};base64,${imageBase64}` }
              ]
            }
          ]
        },
        parameters: {
          max_tokens: config.maxTokens,
          temperature: 0.1
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const result = response.data;
    return {
      description: result.output.choices[0].message.content[0].text.trim(),
      model: config.model,
      inputTokens: result.usage?.input_tokens || 0,
      outputTokens: result.usage?.output_tokens || 0
    };
  }

  /**
   * 调用Gemini Vision API
   */
  private async callGeminiVision(
    imageBase64: string,
    imageMime: string,
    prompt: string,
    config: VLMModelConfig
  ): Promise<ImageDescriptionResponse> {
    const response = await axios.post(
      `${config.endpoint}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: imageMime,
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: 0.1
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const result = response.data;
    return {
      description: result.candidates[0].content.parts[0].text.trim(),
      model: config.model,
      inputTokens: result.usageMetadata?.promptTokenCount || 0,
      outputTokens: result.usageMetadata?.candidatesTokenCount || 0
    };
  }

  /**
   * 调用自定义Vision API (硅基流动等OpenAI兼容接口)
   */
  private async callCustomVision(
    imageBase64: string,
    imageMime: string,
    prompt: string,
    config: VLMModelConfig
  ): Promise<ImageDescriptionResponse> {
    const response = await axios.post(
      `${config.endpoint}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMime};base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: config.maxTokens,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const result = response.data;
    return {
      description: result.choices[0].message.content.trim(),
      model: config.model,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0
    };
  }

  /**
   * 批量处理图片描述
   */
  async batchGenerateImageDescriptions(
    images: Array<{ id: string; base64: string; mime: string }>,
    prompt?: string,
    model?: string,
    concurrency: number = 3
  ): Promise<Array<{ id: string; description: string; error?: string }>> {
    const results: Array<{ id: string; description: string; error?: string }> = [];
    
    // 分批处理以避免API限制
    const batches = [];
    for (let i = 0; i < images.length; i += concurrency) {
      batches.push(images.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (image) => {
        try {
          const result = await this.generateImageDescription({
            imageBase64: image.base64,
            imageMime: image.mime,
            prompt,
            model
          });
          return { id: image.id, description: result.description };
        } catch (error) {
          logger.error(`Failed to process image ${image.id}:`, error);
          return { 
            id: image.id, 
            description: '', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 添加延迟以避免API限制
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 验证图片格式是否支持
   */
  static isSupportedImageFormat(mime: string): boolean {
    const supportedFormats = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp'
    ];
    return supportedFormats.includes(mime.toLowerCase());
  }

  /**
   * 估算图片处理成本
   */
  estimateProcessingCost(imageCount: number, model?: string): {
    estimatedTokens: number;
    estimatedCost: number; // USD
  } {
    const modelConfig = this.getModelConfig(model);
    const baseTokensPerImage = 1000; // 估算值
    
    const estimatedTokens = imageCount * baseTokensPerImage;
    let costPerToken = 0.00001; // 默认成本

    if (modelConfig) {
      switch (modelConfig.provider) {
        case 'openai':
          costPerToken = 0.00001; // GPT-4V价格
          break;
        case 'claude':
          costPerToken = 0.000008; // Claude Vision价格
          break;
        case 'qwen':
          costPerToken = 0.000002; // Qwen价格更低
          break;
        case 'gemini':
          costPerToken = 0.000004; // Gemini价格
          break;
      }
    }

    return {
      estimatedTokens,
      estimatedCost: estimatedTokens * costPerToken
    };
  }
}

// 导出单例实例
export const vlmService = new VLMService();

// 导出类型
export { VLMModelConfig, ImageDescriptionRequest, ImageDescriptionResponse };
