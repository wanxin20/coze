import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  answerText: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface LLMRequestParams {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * LLM服务 - 为FastGPTRAG提供统一的LLM调用接口
 * 支持OpenAI兼容的API接口
 */
export class LLMService {

  /**
   * 创建LLM响应 - 复现FastGPT的createLLMResponse函数
   */
  async createLLMResponse(params: {
    body: LLMRequestParams;
  }): Promise<LLMResponse> {
    const { body } = params;
    const { model, messages, temperature = 0.7, maxTokens, stream = false } = body;

    try {
      logger.info(`LLM Request: model=${model}, messages=${messages.length}, temperature=${temperature}`);

      // 检查配置
      if (!config.oneApiUrl || !config.oneApiKey) {
        throw new Error('LLM API configuration is missing. Please configure ONE_API_URL and ONE_API_KEY.');
      }

      // 构建请求参数
      const requestBody = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature,
        stream: false, // 暂时只支持非流式响应
        ...(maxTokens && { max_tokens: maxTokens })
      };

      logger.debug('LLM request body:', JSON.stringify(requestBody, null, 2));

      // 发送请求 - 修复URL重复v1的问题
      const apiUrl = config.oneApiUrl.endsWith('/v1') 
        ? `${config.oneApiUrl}/chat/completions`
        : `${config.oneApiUrl}/v1/chat/completions`;
      
      logger.debug(`LLM API URL: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.oneApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`LLM API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      logger.debug('LLM response:', JSON.stringify(data, null, 2));

      // 解析响应
      const answerText = data.choices?.[0]?.message?.content || '';
      const usage = {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      };

      logger.info(`LLM Response: ${answerText.length} chars, tokens: ${usage.inputTokens}+${usage.outputTokens}=${usage.totalTokens}`);

      return {
        answerText,
        usage
      };

    } catch (error) {
      logger.error('LLM request failed:', error);
      throw error;
    }
  }

  /**
   * 流式LLM响应（暂未实现）
   */
  async createStreamLLMResponse(params: {
    body: LLMRequestParams;
  }): Promise<AsyncGenerator<string, void, unknown>> {
    throw new Error('Stream LLM response not implemented yet');
  }

  /**
   * 获取LLM模型信息
   */
  getLLMModel(modelName: string) {
    const llmModels = config.llmModels || [];
    const model = llmModels.find(m => m.model === modelName || m.name === modelName);
    
    if (!model) {
      logger.warn(`LLM model not found: ${modelName}, using default`);
      return {
        model: modelName,
        name: modelName,
        maxContext: 4096,
        maxResponse: 2048,
        provider: 'OpenAI'
      };
    }

    return model;
  }

  /**
   * 验证LLM配置
   */
  validateLLMConfig(): { valid: boolean; error?: string } {
    if (!config.oneApiUrl) {
      return { valid: false, error: 'ONE_API_URL is not configured' };
    }

    if (!config.oneApiKey) {
      return { valid: false, error: 'ONE_API_KEY is not configured' };
    }

    try {
      new URL(config.oneApiUrl);
    } catch {
      return { valid: false, error: 'ONE_API_URL is not a valid URL' };
    }

    return { valid: true };
  }

  /**
   * 测试LLM连接
   */
  async testLLMConnection(model: string = 'gpt-3.5-turbo'): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const validation = this.validateLLMConfig();
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const response = await this.createLLMResponse({
        body: {
          model,
          messages: [
            { role: 'user', content: 'Hello, this is a connection test. Please respond with "OK".' }
          ],
          temperature: 0,
          maxTokens: 10
        }
      });

      const latency = Date.now() - startTime;

      return {
        success: true,
        latency
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 估算token使用量（简化实现）
   */
  estimateTokens(text: string): number {
    // 简化的token估算：中文约1.5字符/token，英文约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}

// 导出单例
export const llmService = new LLMService();

// 向后兼容的导出
export const createLLMResponse = llmService.createLLMResponse.bind(llmService);
export const getLLMModel = llmService.getLLMModel.bind(llmService);
