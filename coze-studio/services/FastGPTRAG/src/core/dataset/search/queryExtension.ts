import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

export interface QueryExtensionResult {
  queries: string[];
  aiResult?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Main query extension function
export async function queryExtension(params: {
  query: string;
  model: string;
  background?: string;
  histories?: Array<{ q: string; a: string }>;
  maxQueries?: number;
}): Promise<QueryExtensionResult> {
  const {
    query,
    model,
    background = '',
    histories = [],
    maxQueries = 3
  } = params;

  try {
    // If no model specified, return original query only
    if (!model || !config.oneApiUrl || !config.oneApiKey) {
      return { queries: [query] };
    }

    // Build context from history
    const contextMessages: ChatMessage[] = [];
    
    if (background) {
      contextMessages.push({
        role: 'system',
        content: `背景信息: ${background}`
      });
    }

    // Add recent conversation history
    histories.slice(-3).forEach(item => {
      contextMessages.push({ role: 'user', content: item.q });
      if (item.a) {
        contextMessages.push({ role: 'assistant', content: item.a });
      }
    });

    // Generate expanded queries
    const expandedQueries = await generateExpandedQueries({
      query,
      model,
      context: contextMessages,
      maxQueries
    });

    return expandedQueries;
  } catch (error) {
    logger.error('Failed to extend query:', error);
    // Return original query on failure
    return { queries: [query] };
  }
}

// Generate expanded queries using AI
async function generateExpandedQueries(params: {
  query: string;
  model: string;
  context: ChatMessage[];
  maxQueries: number;
}): Promise<QueryExtensionResult> {
  const { query, model, context, maxQueries } = params;

  try {
    const systemPrompt = `你是一个查询扩展专家。你的任务是根据用户的查询和上下文，生成多个相关的搜索查询，以便在知识库中获得更全面的搜索结果。

规则：
1. 生成 ${maxQueries} 个不同角度的查询
2. 包含原始查询的同义词、相关概念、上下文相关术语
3. 保持查询的核心意图不变
4. 每个查询应该独立且有意义
5. 用JSON格式返回，格式：{"queries": ["查询1", "查询2", "查询3"]}

请确保生成的查询能够覆盖用户问题的不同方面。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...context,
      { 
        role: 'user', 
        content: `请为以下查询生成 ${maxQueries} 个扩展查询：\n\n"${query}"\n\n请直接返回JSON格式的结果。` 
      }
    ];

    const response = await callLLMAPI({
      model,
      messages,
      temperature: 0.3,
      maxTokens: 500
    });

    if (!response.content) {
      throw new Error('Empty response from LLM API');
    }

    // Parse the response
    const expandedQueries = parseQueryResponse(response.content, query, maxQueries);

    return {
      queries: expandedQueries,
      aiResult: {
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens
      }
    };
  } catch (error) {
    logger.error('Failed to generate expanded queries:', error);
    throw error;
  }
}

// Call LLM API for query generation
async function callLLMAPI(params: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const {
    model,
    messages,
    temperature = 0.3,
    maxTokens = 500
  } = params;

  try {
    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    const response = await fetch(`${config.oneApiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.oneApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response choices from LLM API');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || '';
    
    return {
      content,
      model: data.model || model,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0
    };
  } catch (error) {
    logger.error('LLM API call failed:', error);
    throw error;
  }
}

// Parse query response from AI
function parseQueryResponse(
  response: string, 
  originalQuery: string, 
  maxQueries: number
): string[] {
  try {
    // Try to parse JSON response
    const jsonMatch = response.match(/\{[^}]*"queries"[^}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.queries && Array.isArray(parsed.queries)) {
        const queries = parsed.queries
          .filter((q: any) => typeof q === 'string' && q.trim().length > 0)
          .slice(0, maxQueries);
        
        if (queries.length > 0) {
          // Ensure original query is included
          if (!queries.includes(originalQuery)) {
            queries[0] = originalQuery;
          }
          return queries;
        }
      }
    }

    // Fallback: extract queries from text
    const lines = response.split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0 && !line.match(/^(查询|Query|问题)/i))
      .slice(0, maxQueries);

    if (lines.length > 0) {
      // Ensure original query is included
      if (!lines.includes(originalQuery)) {
        lines[0] = originalQuery;
      }
      return lines;
    }

    // Final fallback
    return [originalQuery];
  } catch (error) {
    logger.warn('Failed to parse query response:', error);
    return [originalQuery];
  }
}

// Generate query variations using simple rules
export function generateSimpleQueryVariations(
  query: string,
  maxVariations: number = 3
): string[] {
  const variations = [query]; // Always include original
  
  try {
    // Add question variations
    if (!query.includes('?') && !query.includes('？')) {
      variations.push(`${query}是什么`);
      variations.push(`如何${query}`);
      variations.push(`${query}的方法`);
    }

    // Add concept variations
    if (query.length > 2) {
      const words = query.split(/\s+/);
      if (words.length > 1) {
        // Rearrange words
        variations.push(words.reverse().join(' '));
        // Take key words
        if (words.length > 2) {
          variations.push(words.slice(0, 2).join(' '));
        }
      }
    }

    // Remove duplicates and limit
    return [...new Set(variations)].slice(0, maxVariations);
  } catch (error) {
    logger.warn('Failed to generate simple variations:', error);
    return [query];
  }
}

// Query rewriting for better search results
export async function rewriteQuery(params: {
  query: string;
  model: string;
  context?: string;
}): Promise<{
  rewrittenQuery: string;
  aiResult?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
}> {
  const { query, model, context = '' } = params;

  try {
    if (!model || !config.oneApiUrl || !config.oneApiKey) {
      return { rewrittenQuery: query };
    }

    const systemPrompt = `你是一个查询重写专家。你的任务是将用户的查询重写为更适合在知识库中搜索的形式。

规则：
1. 保持查询的核心意图
2. 使用更精确、具体的词汇
3. 去除冗余词汇
4. 转换为陈述句形式（如果原本是问句）
5. 只返回重写后的查询，不要其他解释

${context ? `上下文信息：${context}` : ''}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请重写以下查询：\n\n"${query}"` }
    ];

    const response = await callLLMAPI({
      model,
      messages,
      temperature: 0.1,
      maxTokens: 200
    });

    const rewrittenQuery = response.content.trim().replace(/^["']|["']$/g, '');

    return {
      rewrittenQuery: rewrittenQuery || query,
      aiResult: {
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens
      }
    };
  } catch (error) {
    logger.error('Failed to rewrite query:', error);
    return { rewrittenQuery: query };
  }
}
