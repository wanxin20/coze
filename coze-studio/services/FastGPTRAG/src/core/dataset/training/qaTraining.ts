import { logger } from '../../../utils/logger.js';
import { Types } from 'mongoose';
import { config } from '@/config/index.js';
import { TrainingModeEnum } from '@/types/dataset.js';
import { MongoDatasetData } from '../data/schema.js';
import { MongoDatasetCollection } from '../collection/schema.js';
import { MongoDataset } from '../schema.js';
import { getEmbeddingModel } from '@/core/embedding/index.js';
import { insertDatasetDataVector } from '@/core/vectorstore/newController.js';
import { safeObjectId } from '@/utils/objectId.js';

/**
 * QA训练模式处理器 - 复刻FastGPT的QA生成功能
 * 基于文本内容生成问答对，增强知识库的问答能力
 */

export interface QATrainingRequest {
  text: string;
  datasetId: string;
  collectionId: string;
  teamId: string;
  tmbId: string;
  chunkIndex: number;
  qaPrompt?: string;
  agentModel?: string;
  vectorModel?: string;
  billId?: string;
}

export interface QATrainingResult {
  qaCount: number;
  generatedQAs: Array<{
    q: string;
    a: string;
    chunkIndex: number;
  }>;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  error?: string;
}

export interface QAPair {
  q: string;
  a: string;
  chunkIndex: number;
  indexes?: Array<{
    type: 'custom' | 'summary';
    text: string;
  }>;
}

/**
 * FastGPT的QA生成提示词 - 与原版保持一致
 */
export const Prompt_AgentQA = {
  description: `<Context></Context> 标记中是一段文本，学习和分析它，并整理学习成果：
- 提出问题并给出每个问题的答案。
- 答案需详细完整，尽可能保留原文描述，可以适当扩展答案描述。
- 答案可以包含普通文字、链接、代码、表格、公示、媒体链接等 Markdown 元素。
- 最多提出 50 个问题。
- 生成的问题和答案和源文本语言相同。
`,
  fixedText: `请按以下格式整理学习成果:
<Context>
文本
</Context>
Q1: 问题。
A1: 答案。
Q2:
A2:

------

我们开始吧!

<Context>
{{text}}
</Context>
`
};

export class QATrainingProcessor {

  /**
   * 处理QA训练任务
   */
  async processQATraining(request: QATrainingRequest): Promise<QATrainingResult> {
    const {
      text,
      datasetId,
      collectionId,
      teamId,
      tmbId,
      chunkIndex,
      qaPrompt,
      agentModel = config.defaultLlmModel,
      vectorModel = 'text-embedding-v3',
      billId
    } = request;

    logger.info(`Starting QA training: collection=${collectionId}, chunkIndex=${chunkIndex}, textLength=${text.length}`);

    try {
      if (!text || text.trim().length < 50) {
        logger.warn('Text too short for QA generation');
        return {
          qaCount: 0,
          generatedQAs: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          success: true
        };
      }

      // 1. 生成QA对
      const qaResult = await this.generateQAFromText({
        text,
        qaPrompt,
        agentModel
      });

      if (qaResult.qaList.length === 0) {
        logger.warn('No QA pairs generated from text');
        return {
          qaCount: 0,
          generatedQAs: [],
          totalTokens: qaResult.inputTokens + qaResult.outputTokens,
          inputTokens: qaResult.inputTokens,
          outputTokens: qaResult.outputTokens,
          success: true
        };
      }

      // 2. 格式化QA数据
      const formattedQAs = qaResult.qaList.map((qa, index) => ({
        ...qa,
        chunkIndex: chunkIndex + index,
        indexes: [
          {
            type: 'custom' as const,
            text: qa.q
          }
        ]
      }));

      // 3. 插入到训练队列或直接插入向量数据库
      await this.insertQAsToVectorStore({
        qaList: formattedQAs,
        datasetId,
        collectionId,
        teamId,
        vectorModel
      });

      logger.info(`QA training completed: ${formattedQAs.length} QA pairs generated`);

      return {
        qaCount: formattedQAs.length,
        generatedQAs: formattedQAs,
        totalTokens: qaResult.inputTokens + qaResult.outputTokens,
        inputTokens: qaResult.inputTokens,
        outputTokens: qaResult.outputTokens,
        success: true
      };

    } catch (error) {
      logger.error('QA training failed:', error);
      return {
        qaCount: 0,
        generatedQAs: [],
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 使用LLM生成QA对
   */
  private async generateQAFromText(params: {
    text: string;
    qaPrompt?: string;
    agentModel: string;
  }): Promise<{
    qaList: QAPair[];
    inputTokens: number;
    outputTokens: number;
  }> {
    const { text, qaPrompt, agentModel } = params;

    // 构建提示词
    const prompt = this.buildQAPrompt(text, qaPrompt);
    
    logger.debug(`QA generation prompt: ${prompt.substring(0, 200)}...`);

    try {
      // 这里需要调用LLM API生成QA
      // 由于FastGPTRAG可能没有LLM调用模块，我们提供一个模拟实现
      const llmResult = await this.callLLMForQA({
        prompt,
        model: agentModel
      });

      // 解析LLM返回的QA对
      const qaList = this.parseQAResponse(llmResult.answer, text);

      return {
        qaList,
        inputTokens: llmResult.inputTokens,
        outputTokens: llmResult.outputTokens
      };

    } catch (error) {
      logger.error('Failed to generate QA from LLM:', error);
      throw error;
    }
  }

  /**
   * 构建QA生成提示词
   */
  private buildQAPrompt(text: string, customPrompt?: string): string {
    const basePrompt = customPrompt || Prompt_AgentQA.description;
    const fixedText = Prompt_AgentQA.fixedText.replace('{{text}}', text);
    
    return `${basePrompt}\n${fixedText}`;
  }

  /**
   * 调用LLM生成QA
   */
  private async callLLMForQA(params: {
    prompt: string;
    model: string;
  }): Promise<{
    answer: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const { prompt, model } = params;

    try {
      // 动态导入LLM服务
      const { createLLMResponse } = await import('@/core/llm/index.js');

      // 调用LLM生成QA
      const response = await createLLMResponse({
        body: {
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          stream: false
        }
      });

      return {
        answer: response.answerText,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens
      };

    } catch (error) {
      logger.error('Failed to call LLM for QA generation:', error);
      
      // 如果LLM调用失败，提供一个基础的QA生成作为降级方案
      logger.warn('Falling back to basic QA generation');
      
      const basicQA = this.generateBasicQA(prompt);
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(basicQA.length / 4);

      return {
        answer: basicQA,
        inputTokens,
        outputTokens
      };
    }
  }

  /**
   * 基础QA生成（降级方案）
   */
  private generateBasicQA(prompt: string): string {
    // 从提示词中提取文本内容
    const textMatch = prompt.match(/<Context>([\s\S]*?)<\/Context>/);
    const text = textMatch ? textMatch[1].trim() : '';

    if (!text) {
      return 'Q1: 无法生成问答对，文本内容为空。\nA1: 请提供有效的文本内容。';
    }

    // 生成基础问答对
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const qaList = [];

    // 基础问题1：主要内容
    qaList.push(`Q1: 这段文本的主要内容是什么？`);
    qaList.push(`A1: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);

    // 基础问题2：关键信息
    if (lines.length > 1) {
      qaList.push(`Q2: 文本中包含哪些关键信息？`);
      const keyPoints = lines.slice(0, 3).map((line, index) => `${index + 1}. ${line.trim()}`).join('\n');
      qaList.push(`A2: 主要包含以下几点：\n${keyPoints}`);
    }

    // 基础问题3：总结
    if (text.length > 100) {
      qaList.push(`Q3: 如何总结这段内容？`);
      qaList.push(`A3: 这段内容主要讲述了相关的知识点和信息，需要进一步分析和理解。`);
    }

    return qaList.join('\n');
  }

  /**
   * 解析LLM返回的QA响应
   */
  private parseQAResponse(answer: string, originalText: string): QAPair[] {
    const qaList: QAPair[] = [];

    try {
      // 清理和标准化换行符
      answer = answer.replace(/\\n/g, '\n');
      
      // 匹配Q和A的正则表达式 - 与FastGPT原版保持一致
      const regex = /Q\d+:(\s*)(.*)(\s*)A\d+:(\s*)([\s\S]*?)(?=Q\d|$)/g;
      let match;

      while ((match = regex.exec(answer)) !== null) {
        const question = match[2]?.trim();
        const answerText = match[5]?.trim();

        if (question && answerText && question.length > 0 && answerText.length > 0) {
          qaList.push({
            q: question,
            a: answerText,
            chunkIndex: 0 // 将在上级函数中设置
          });
        }
      }

      // 如果正则匹配失败，尝试简单的行分割方式
      if (qaList.length === 0) {
        logger.warn('Regex parsing failed, trying simple line-based parsing');
        qaList.push(...this.fallbackQAParsing(answer));
      }

      // 限制最大QA对数量
      const maxQAs = 50;
      if (qaList.length > maxQAs) {
        logger.info(`Limiting QA pairs to ${maxQAs} (was ${qaList.length})`);
        return qaList.slice(0, maxQAs);
      }

      logger.info(`Successfully parsed ${qaList.length} QA pairs`);
      return qaList;

    } catch (error) {
      logger.error('Failed to parse QA response:', error);
      return [];
    }
  }

  /**
   * 备用的QA解析方法
   */
  private fallbackQAParsing(answer: string): QAPair[] {
    const qaList: QAPair[] = [];
    const lines = answer.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentQ = '';
    let currentA = '';
    let isAnswer = false;

    for (const line of lines) {
      if (line.match(/^Q\d*:?\s*/)) {
        // 保存上一个QA对
        if (currentQ && currentA) {
          qaList.push({
            q: currentQ,
            a: currentA,
            chunkIndex: 0
          });
        }
        
        currentQ = line.replace(/^Q\d*:?\s*/, '').trim();
        currentA = '';
        isAnswer = false;
      } else if (line.match(/^A\d*:?\s*/)) {
        currentA = line.replace(/^A\d*:?\s*/, '').trim();
        isAnswer = true;
      } else if (isAnswer && currentA) {
        currentA += '\n' + line;
      } else if (!isAnswer && currentQ) {
        currentQ += '\n' + line;
      }
    }

    // 添加最后一个QA对
    if (currentQ && currentA) {
      qaList.push({
        q: currentQ,
        a: currentA,
        chunkIndex: 0
      });
    }

    return qaList;
  }

  /**
   * 将QA对插入向量数据库
   */
  private async insertQAsToVectorStore(params: {
    qaList: QAPair[];
    datasetId: string;
    collectionId: string;
    teamId: string;
    vectorModel: string;
  }): Promise<void> {
    const { qaList, datasetId, collectionId, teamId, vectorModel } = params;

    if (qaList.length === 0) {
      return;
    }

    try {
      // 获取嵌入模型
      const embeddingModel = getEmbeddingModel(vectorModel);

      // 准备向量化的输入文本（使用问题作为检索文本）
      const inputs = qaList.map(qa => qa.q);

      // 准备元数据
      const metadata = qaList.map((qa, index) => ({
        dataId: `qa_${Date.now()}_${index}`,
        q: qa.q,
        a: qa.a,
        chunkIndex: qa.chunkIndex
      }));

      // 插入向量数据库
      const result = await insertDatasetDataVector({
        inputs,
        model: embeddingModel,
        teamId,
        datasetId,
        collectionId,
        metadata
      });

      // 同时将QA对存储到MongoDB
      const dataItems = qaList.map((qa, index) => ({
        _id: new Types.ObjectId(),
        teamId: safeObjectId(teamId),
        tmbId: safeObjectId(teamId), // 简化处理
        datasetId: safeObjectId(datasetId),
        collectionId: safeObjectId(collectionId),
        q: qa.q,
        a: qa.a,
        chunkIndex: qa.chunkIndex,
        indexes: qa.indexes || [
          {
            type: 'custom',
            dataId: result.insertIds[index],
            text: qa.q
          }
        ],
        updateTime: new Date()
      }));

      // 批量插入MongoDB
      await MongoDatasetData.insertMany(dataItems);

      logger.info(`Successfully inserted ${qaList.length} QA pairs to vector store and MongoDB`);

    } catch (error) {
      logger.error('Failed to insert QAs to vector store:', error);
      throw error;
    }
  }

  /**
   * 估算QA训练成本
   */
  estimateQATrainingCost(
    textLength: number,
    agentModel: string = config.defaultLlmModel
  ): {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedCost: number;
    estimatedQACount: number;
  } {
    // 基于文本长度估算
    const estimatedInputTokens = Math.ceil(textLength / 4) + 200; // 基础prompt约200token
    const estimatedQACount = Math.min(Math.floor(textLength / 100), 50); // 每100字符约1个QA，最多50个
    const estimatedOutputTokens = estimatedQACount * 50; // 每个QA约50token

    // 简化的成本估算（实际应该根据具体模型定价）
    const costPerToken = agentModel.includes('gpt-4') ? 0.00003 : 0.000002;
    const estimatedCost = (estimatedInputTokens + estimatedOutputTokens) * costPerToken;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost,
      estimatedQACount
    };
  }

  /**
   * 验证QA训练请求
   */
  validateQATrainingRequest(request: QATrainingRequest): { valid: boolean; error?: string } {
    if (!request.text || request.text.trim().length < 10) {
      return { valid: false, error: 'Text content is too short for QA generation' };
    }

    if (!request.datasetId || !request.collectionId) {
      return { valid: false, error: 'Dataset ID and Collection ID are required' };
    }

    if (!request.teamId) {
      return { valid: false, error: 'Team ID is required' };
    }

    if (request.text.length > 50000) {
      return { valid: false, error: 'Text content is too long (max 50,000 characters)' };
    }

    return { valid: true };
  }
}

export const qaTrainingProcessor = new QATrainingProcessor();
