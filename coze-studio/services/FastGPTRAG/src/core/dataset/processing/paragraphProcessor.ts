import { logger } from '@/utils/logger.js';
import { createLLMResponse } from '@/core/llm/index.js';

/**
 * 段落处理模式枚举 - 对应FastGPT的ParagraphChunkAIModeEnum
 */
export enum ParagraphChunkAIModeEnum {
  enable = 'enable',
  disable = 'disable',
  auto = 'auto',
  forbid = 'forbid'
}

/**
 * 段落处理结果接口
 */
export interface ParagraphProcessResult {
  resultText: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  processingTime: number;
  optimizationApplied: boolean;
  originalLength: number;
  processedLength: number;
}

/**
 * 段落处理请求参数
 */
export interface ParagraphProcessRequest {
  rawText: string;
  model: string;
  paragraphChunkAIMode: ParagraphChunkAIModeEnum;
  customPrompt?: string;
  language?: 'zh' | 'en' | 'auto';
  preserveStructure?: boolean;
}

/**
 * LLM段落处理器 - 复现FastGPT的段落优化功能
 * 提供AI段落优化和智能文本清理
 */
export class ParagraphProcessor {

  /**
   * 处理段落 - 主要入口函数
   */
  async processLLMParagraph(params: ParagraphProcessRequest): Promise<ParagraphProcessResult> {
    const {
      rawText,
      model,
      paragraphChunkAIMode,
      customPrompt,
      language = 'auto',
      preserveStructure = true
    } = params;

    const startTime = Date.now();
    const originalLength = rawText.length;

    try {
      logger.info(`Starting paragraph processing: mode=${paragraphChunkAIMode}, length=${originalLength}`);

      // 检查是否需要处理
      if (paragraphChunkAIMode === ParagraphChunkAIModeEnum.forbid || 
          paragraphChunkAIMode === ParagraphChunkAIModeEnum.disable) {
        return {
          resultText: rawText,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          processingTime: Date.now() - startTime,
          optimizationApplied: false,
          originalLength,
          processedLength: rawText.length
        };
      }

      // 自动模式检查
      if (paragraphChunkAIMode === ParagraphChunkAIModeEnum.auto) {
        const shouldSkip = this.shouldSkipAutoProcessing(rawText);
        if (shouldSkip) {
          logger.info('Auto mode: skipping processing due to good structure');
          return {
            resultText: rawText,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            processingTime: Date.now() - startTime,
            optimizationApplied: false,
            originalLength,
            processedLength: rawText.length
          };
        }
      }

      // 预处理文本
      const preprocessedText = this.preprocessText(rawText);

      // 检测语言
      const detectedLanguage = language === 'auto' ? this.detectLanguage(preprocessedText) : language;

      // 构建优化提示词
      const optimizationPrompt = this.buildOptimizationPrompt(
        preprocessedText,
        detectedLanguage,
        preserveStructure,
        customPrompt
      );

      // 调用LLM进行段落优化
      const llmResult = await this.callLLMForOptimization({
        prompt: optimizationPrompt,
        model,
        originalText: preprocessedText
      });

      // 后处理优化结果
      const finalText = this.postProcessOptimizedText(llmResult.optimizedText, rawText);

      const result: ParagraphProcessResult = {
        resultText: finalText,
        totalInputTokens: llmResult.inputTokens,
        totalOutputTokens: llmResult.outputTokens,
        processingTime: Date.now() - startTime,
        optimizationApplied: true,
        originalLength,
        processedLength: finalText.length
      };

      logger.info(`Paragraph processing completed: ${originalLength} -> ${finalText.length} chars, tokens: ${llmResult.inputTokens}+${llmResult.outputTokens}`);

      return result;

    } catch (error) {
      logger.error('Paragraph processing failed:', error);
      
      // 降级处理：返回清理后的原文
      const cleanedText = this.smartTextCleaning(rawText);
      
      return {
        resultText: cleanedText,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        processingTime: Date.now() - startTime,
        optimizationApplied: false,
        originalLength,
        processedLength: cleanedText.length
      };
    }
  }

  /**
   * 智能文本清理 - 增强版文本清理功能
   */
  smartTextCleaning(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text;

    try {
      // 1. 基础字符清理
      cleaned = this.basicCharacterCleaning(cleaned);
      
      // 2. 格式标准化
      cleaned = this.normalizeFormatting(cleaned);
      
      // 3. 段落优化
      cleaned = this.optimizeParagraphs(cleaned);
      
      // 4. 标点符号优化
      cleaned = this.optimizePunctuation(cleaned);
      
      // 5. 空白字符优化
      cleaned = this.optimizeWhitespace(cleaned);
      
      // 6. 结构化内容处理
      cleaned = this.handleStructuredContent(cleaned);

      logger.debug(`Smart text cleaning: ${text.length} -> ${cleaned.length} characters`);
      
      return cleaned;

    } catch (error) {
      logger.error('Smart text cleaning failed:', error);
      return text; // 返回原文本作为降级方案
    }
  }

  /**
   * 检查自动模式是否应该跳过处理
   */
  private shouldSkipAutoProcessing(text: string): boolean {
    // 检查是否有良好的Markdown结构
    const hasMarkdownHeaders = /^(#+)\s/m.test(text);
    const hasMultipleHeaders = (text.match(/^(#+)\s/gm) || []).length > 1;
    const isWellStructuredMarkdown = hasMarkdownHeaders && hasMultipleHeaders;

    if (isWellStructuredMarkdown) {
      return true;
    }

    // 检查是否有良好的段落结构
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const averageParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
    
    // 如果段落数量合理且长度适中，跳过处理
    if (paragraphs.length >= 3 && averageParagraphLength > 50 && averageParagraphLength < 500) {
      return true;
    }

    // 检查是否是代码或数据文件
    const codeIndicators = [
      /```[\s\S]*?```/g, // 代码块
      /^\s*[{}\[\]]/m, // JSON/数组结构
      /^\s*function\s+\w+/m, // 函数定义
      /^\s*class\s+\w+/m, // 类定义
      /^\s*import\s+/m, // 导入语句
      /^\s*<\w+[^>]*>/m // HTML标签
    ];

    const hasCodeIndicators = codeIndicators.some(pattern => pattern.test(text));
    if (hasCodeIndicators) {
      return true;
    }

    return false;
  }

  /**
   * 文本预处理
   */
  private preprocessText(text: string): string {
    let processed = text;

    // 移除过多的空白行
    processed = processed.replace(/\n{4,}/g, '\n\n\n');
    
    // 标准化引号
    processed = processed.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    // 移除零宽字符
    processed = processed.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    return processed;
  }

  /**
   * 检测文本语言
   */
  private detectLanguage(text: string): 'zh' | 'en' {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 'en';
    
    const chineseRatio = chineseChars / totalChars;
    return chineseRatio > 0.3 ? 'zh' : 'en';
  }

  /**
   * 构建优化提示词
   */
  private buildOptimizationPrompt(
    text: string, 
    language: 'zh' | 'en', 
    preserveStructure: boolean,
    customPrompt?: string
  ): string {
    if (customPrompt) {
      return `${customPrompt}\n\n原文：\n${text}`;
    }

    const basePrompt = language === 'zh' ? 
      `你是一个专业的文本编辑专家。请对以下文本进行段落优化，使其更加清晰、易读、结构化。

优化要求：
1. 保持原文的核心信息和含义不变
2. 优化段落结构，确保逻辑清晰
3. 修正明显的格式问题和错别字
4. 合并过短的段落，拆分过长的段落
5. 添加适当的段落分隔，提高可读性
6. ${preserveStructure ? '尽量保持原有的文档结构（如标题、列表等）' : '可以重新组织文档结构以提高可读性'}
7. 移除多余的空白字符和格式符号
8. 确保中文标点符号使用正确

请直接返回优化后的文本，不要添加任何解释或说明。

原文：
${text}` :
      `You are a professional text editor. Please optimize the following text to make it clearer, more readable, and well-structured.

Optimization requirements:
1. Maintain the core information and meaning of the original text
2. Optimize paragraph structure for logical clarity
3. Fix obvious formatting issues and typos
4. Merge overly short paragraphs and split overly long ones
5. Add appropriate paragraph breaks for better readability
6. ${preserveStructure ? 'Preserve the original document structure (headings, lists, etc.)' : 'Reorganize document structure to improve readability'}
7. Remove excessive whitespace and formatting symbols
8. Ensure proper punctuation usage

Please return only the optimized text without any explanations.

Original text:
${text}`;

    return basePrompt;
  }

  /**
   * 调用LLM进行优化
   */
  private async callLLMForOptimization(params: {
    prompt: string;
    model: string;
    originalText: string;
  }): Promise<{
    optimizedText: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const { prompt, model } = params;

    try {
      const response = await createLLMResponse({
        body: {
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2, // 较低的温度以确保一致性
          stream: false
        }
      });

      return {
        optimizedText: response.answerText,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens
      };

    } catch (error) {
      logger.error('LLM optimization failed:', error);
      throw error;
    }
  }

  /**
   * 后处理优化结果
   */
  private postProcessOptimizedText(optimizedText: string, originalText: string): string {
    let processed = optimizedText;

    // 确保文本不为空
    if (!processed || processed.trim().length < 10) {
      logger.warn('Optimized text is too short, using smart cleaning fallback');
      return this.smartTextCleaning(originalText);
    }

    // 检查文本质量
    const qualityCheck = this.validateTextQuality(processed);
    if (!qualityCheck.isValid) {
      logger.warn(`Optimized text quality issues: ${qualityCheck.issues.join(', ')}`);
      if (qualityCheck.score < 70) {
        return this.smartTextCleaning(originalText);
      }
    }

    // 最终清理
    processed = this.smartTextCleaning(processed);

    return processed;
  }

  /**
   * 基础字符清理
   */
  private basicCharacterCleaning(text: string): string {
    return text
      // 移除控制字符（保留换行和制表符）
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      // 移除BOM标记
      .replace(/[\uFEFF\uFFFE]/g, '')
      // 移除零宽字符
      .replace(/[\u200B-\u200D]/g, '')
      // 标准化Unicode
      .normalize('NFC');
  }

  /**
   * 格式标准化
   */
  private normalizeFormatting(text: string): string {
    return text
      // 统一换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 统一引号
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // 统一省略号
      .replace(/\.{3,}/g, '...')
      // 统一破折号
      .replace(/—{2,}/g, '——');
  }

  /**
   * 段落优化
   */
  private optimizeParagraphs(text: string): string {
    // 分割段落
    const paragraphs = text.split(/\n\s*\n/);
    const optimizedParagraphs = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      // 合并过短的段落（少于30个字符）
      if (paragraph.length < 30 && i < paragraphs.length - 1) {
        const nextParagraph = paragraphs[i + 1]?.trim();
        if (nextParagraph && nextParagraph.length < 100) {
          paragraphs[i + 1] = paragraph + ' ' + nextParagraph;
          continue;
        }
      }

      // 拆分过长的段落（超过800个字符）
      if (paragraph.length > 800) {
        const sentences = this.splitIntoSentences(paragraph);
        let currentParagraph = '';
        
        for (const sentence of sentences) {
          if (currentParagraph.length + sentence.length > 400 && currentParagraph) {
            optimizedParagraphs.push(currentParagraph.trim());
            currentParagraph = sentence;
          } else {
            currentParagraph += (currentParagraph ? ' ' : '') + sentence;
          }
        }
        
        if (currentParagraph) {
          optimizedParagraphs.push(currentParagraph.trim());
        }
      } else {
        optimizedParagraphs.push(paragraph);
      }
    }

    return optimizedParagraphs.join('\n\n');
  }

  /**
   * 拆分句子
   */
  private splitIntoSentences(text: string): string[] {
    // 中英文句子分割
    const sentences = text.split(/[.!?。！？]+\s*/);
    return sentences.filter(s => s.trim().length > 0);
  }

  /**
   * 标点符号优化
   */
  private optimizePunctuation(text: string): string {
    return text
      // 修复空格和标点的关系
      .replace(/\s+([,.!?;:。，！？；：])/g, '$1')
      .replace(/([.!?。！？])\s*([a-zA-Z\u4e00-\u9fff])/g, '$1 $2')
      // 修复括号前后空格
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/^\s*\(/g, '(')
      // 修复引号
      .replace(/"\s+/g, '"')
      .replace(/\s+"/g, '"');
  }

  /**
   * 空白字符优化
   */
  private optimizeWhitespace(text: string): string {
    return text
      // 移除行首行尾空白
      .replace(/^[ \t]+|[ \t]+$/gm, '')
      // 合并多个空格为一个
      .replace(/ {2,}/g, ' ')
      // 合并多个制表符
      .replace(/\t{2,}/g, '\t')
      // 限制连续空行为最多2个
      .replace(/\n{4,}/g, '\n\n\n')
      // 移除文件开头和结尾的多余空行
      .replace(/^\n+/, '')
      .replace(/\n+$/, '');
  }

  /**
   * 处理结构化内容
   */
  private handleStructuredContent(text: string): string {
    // 优化列表格式
    text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');
    text = text.replace(/^[\s]*\d+\.\s+/gm, (match, offset) => {
      const lineStart = text.lastIndexOf('\n', offset) + 1;
      const indent = text.slice(lineStart, offset);
      return indent + match.replace(/^\s*\d+\./, (num) => num) + ' ';
    });

    // 优化标题格式
    text = text.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');

    return text;
  }

  /**
   * 验证文本质量
   */
  private validateTextQuality(text: string): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // 检查长度
    if (text.length < 10) {
      issues.push('Text too short');
      score -= 50;
    }

    // 检查可读字符比例
    const readableChars = text.match(/[\u0020-\u007E\u4E00-\u9FFF\u3000-\u303F]/g) || [];
    const readableRatio = readableChars.length / text.length;
    
    if (readableRatio < 0.8) {
      issues.push('Low readable character ratio');
      score -= 30;
    }

    // 检查重复内容
    const lines = text.split('\n');
    const uniqueLines = new Set(lines.map(line => line.trim())).size;
    const repetitionRatio = uniqueLines / lines.length;
    
    if (repetitionRatio < 0.7) {
      issues.push('High content repetition');
      score -= 20;
    }

    return {
      isValid: score >= 70,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * 估算处理成本
   */
  estimateProcessingCost(textLength: number, mode: ParagraphChunkAIModeEnum): {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedCost: number;
    willProcess: boolean;
  } {
    const willProcess = mode === ParagraphChunkAIModeEnum.enable || 
                       (mode === ParagraphChunkAIModeEnum.auto && textLength > 500);

    if (!willProcess) {
      return {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCost: 0,
        willProcess: false
      };
    }

    // 估算token使用量
    const basePromptTokens = 200; // 基础提示词约200token
    const textTokens = Math.ceil(textLength / 4); // 中英文混合约4字符/token
    const estimatedInputTokens = basePromptTokens + textTokens;
    const estimatedOutputTokens = Math.ceil(textTokens * 1.1); // 输出略多于输入

    // 简化的成本计算（实际应根据具体模型定价）
    const inputCostPerToken = 0.000002;
    const outputCostPerToken = 0.000006;
    const estimatedCost = estimatedInputTokens * inputCostPerToken + estimatedOutputTokens * outputCostPerToken;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost,
      willProcess: true
    };
  }
}

// 导出单例
export const paragraphProcessor = new ParagraphProcessor();
