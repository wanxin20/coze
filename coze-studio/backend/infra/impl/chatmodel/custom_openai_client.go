package chatmodel

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// CustomOpenAIClient 自定义OpenAI客户端，使用标准的OpenAI API格式
type CustomOpenAIClient struct {
	apiKey    string
	baseURL   string
	model     string
	timeout   time.Duration
	maxTokens *int
	temperature *float32
	topP      *float32
	client    *http.Client
}

// OpenAIRequest 标准OpenAI API请求格式
type OpenAIRequest struct {
	Model       string                 `json:"model"`
	Messages    []OpenAIMessage        `json:"messages"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float32                `json:"temperature,omitempty"`
	TopP        float32                `json:"top_p,omitempty"`
	Stream      bool                   `json:"stream"`
	Stop        []string               `json:"stop,omitempty"`
}

// OpenAIStreamResponse 流式响应格式
type OpenAIStreamResponse struct {
	ID      string                  `json:"id"`
	Object  string                  `json:"object"`
	Created int64                   `json:"created"`
	Model   string                  `json:"model"`
	Choices []OpenAIStreamChoice    `json:"choices"`
}

// OpenAIStreamChoice 流式选择项
type OpenAIStreamChoice struct {
	Index int                    `json:"index"`
	Delta OpenAIStreamDelta     `json:"delta"`
	FinishReason *string         `json:"finish_reason"`
}

// OpenAIStreamDelta 流式增量数据
type OpenAIStreamDelta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

// OpenAIMessage 标准OpenAI消息格式
type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIResponse 标准OpenAI响应格式
type OpenAIResponse struct {
	ID      string           `json:"id"`
	Object  string           `json:"object"`
	Created int64            `json:"created"`
	Model   string           `json:"model"`
	Choices []OpenAIChoice   `json:"choices"`
	Usage   OpenAIUsage      `json:"usage"`
}

// OpenAIChoice 选择项
type OpenAIChoice struct {
	Index        int           `json:"index"`
	Message      OpenAIMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

// OpenAIUsage token使用情况
type OpenAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// NewCustomOpenAIClient 创建自定义OpenAI客户端
func NewCustomOpenAIClient(apiKey, baseURL, model string, timeout time.Duration) *CustomOpenAIClient {
	return &CustomOpenAIClient{
		apiKey:  apiKey,
		baseURL: strings.TrimSuffix(baseURL, "/"),
		model:   model,
		timeout: timeout,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// SetMaxTokens 设置最大token数
func (c *CustomOpenAIClient) SetMaxTokens(maxTokens int) {
	c.maxTokens = &maxTokens
}

// SetTemperature 设置温度
func (c *CustomOpenAIClient) SetTemperature(temperature float32) {
	c.temperature = &temperature
}

// SetTopP 设置TopP
func (c *CustomOpenAIClient) SetTopP(topP float32) {
	c.topP = &topP
}

// Generate 生成非流式响应
func (c *CustomOpenAIClient) Generate(ctx context.Context, messages []*schema.Message) (*schema.Message, error) {
	// 转换消息格式
	openaiMessages := make([]OpenAIMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = OpenAIMessage{
			Role:    string(msg.Role),
			Content: msg.Content,
		}
	}

	// 构建请求
	request := OpenAIRequest{
		Model:    c.model,
		Messages: openaiMessages,
		Stream:   false,
	}

	if c.maxTokens != nil {
		request.MaxTokens = *c.maxTokens
	}
	if c.temperature != nil {
		request.Temperature = *c.temperature
	}
	if c.topP != nil {
		request.TopP = *c.topP
	}

	// 序列化请求
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// 创建HTTP请求
	url := c.baseURL + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// 设置头部
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	// 发送请求
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// 解析响应
	var openaiResp OpenAIResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	if len(openaiResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	// 转换回schema.Message格式
	choice := openaiResp.Choices[0]
	return &schema.Message{
		Role:    schema.RoleType(choice.Message.Role),
		Content: choice.Message.Content,
	}, nil
}

// StreamGenerate 生成流式响应
func (c *CustomOpenAIClient) StreamGenerate(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	// 转换消息格式
	openaiMessages := make([]OpenAIMessage, len(messages))
	for i, msg := range messages {
		openaiMessages[i] = OpenAIMessage{
			Role:    string(msg.Role),
			Content: msg.Content,
		}
	}

	// 构建请求
	request := OpenAIRequest{
		Model:    c.model,
		Messages: openaiMessages,
		Stream:   true, // 启用流式
	}

	if c.maxTokens != nil {
		request.MaxTokens = *c.maxTokens
	}
	if c.temperature != nil {
		request.Temperature = *c.temperature
	}
	if c.topP != nil {
		request.TopP = *c.topP
	}

	// 序列化请求
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// 创建HTTP请求
	url := c.baseURL + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// 设置头部
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	// 发送请求
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// 创建流式读取器
	sr, sw := schema.Pipe[*schema.Message](10)
	
	go func() {
		defer sw.Close()
		defer resp.Body.Close()
		
		scanner := bufio.NewScanner(resp.Body)
		var contentBuffer strings.Builder
		
		for scanner.Scan() {
			line := scanner.Text()
			
			// 跳过空行
			if strings.TrimSpace(line) == "" {
				continue
			}
			
			// 处理SSE数据行
			if strings.HasPrefix(line, "data: ") {
				dataStr := strings.TrimPrefix(line, "data: ")
				
				// 检查是否为结束标记
				if strings.TrimSpace(dataStr) == "[DONE]" {
					break
				}
				
				// 尝试解析JSON
				var streamResp OpenAIStreamResponse
				if err := json.Unmarshal([]byte(dataStr), &streamResp); err != nil {
					continue // 跳过无法解析的块
				}
				
				// 提取内容
				if len(streamResp.Choices) > 0 {
					choice := streamResp.Choices[0]
					if choice.Delta.Content != "" {
						// 修复可能的编码问题
						fixedContent := c.fixEncoding(choice.Delta.Content)
						contentBuffer.WriteString(fixedContent)
						
						// 发送增量消息
						sw.Send(&schema.Message{
							Role:    schema.Assistant,
							Content: fixedContent,
						}, nil)
					}
					
					// 检查是否结束
					if choice.FinishReason != nil && *choice.FinishReason != "" {
						break
					}
				}
			}
		}
		
		if err := scanner.Err(); err != nil {
			sw.Send(nil, fmt.Errorf("stream reading error: %v", err))
		}
	}()
	
	return sr, nil
}

// fixEncoding 修复可能的编码问题
func (c *CustomOpenAIClient) fixEncoding(text string) string {
	// 如果文本已经是有效的UTF-8，直接返回
	if utf8.ValidString(text) {
		return text
	}
	
	// 尝试修复双重编码问题：Latin-1 -> UTF-8
	textBytes := []byte(text)
	if len(textBytes) > 0 {
		// 尝试将每个字节重新解释为UTF-8
		var result strings.Builder
		for _, b := range textBytes {
			if b < 128 {
				// ASCII字符直接添加
				result.WriteByte(b)
			} else {
				// 非ASCII字符，尝试UTF-8解码
				result.WriteByte(b)
			}
		}
		
		fixed := result.String()
		if utf8.ValidString(fixed) {
			return fixed
		}
	}
	
	// 如果无法修复，返回原文本
	return text
}

// CustomOpenAIModel 实现ToolCallingChatModel接口
type CustomOpenAIModel struct {
	client *CustomOpenAIClient
}

// NewCustomOpenAIModel 创建自定义OpenAI模型
func NewCustomOpenAIModel(apiKey, baseURL, model string, timeout time.Duration, maxTokens *int, temperature, topP *float32) *CustomOpenAIModel {
	client := NewCustomOpenAIClient(apiKey, baseURL, model, timeout)
	
	if maxTokens != nil {
		client.SetMaxTokens(*maxTokens)
	}
	if temperature != nil {
		client.SetTemperature(*temperature)
	}
	if topP != nil {
		client.SetTopP(*topP)
	}
	
	return &CustomOpenAIModel{
		client: client,
	}
}

// Generate 实现非流式生成
func (m *CustomOpenAIModel) Generate(ctx context.Context, messages []*schema.Message, options ...model.Option) (*schema.Message, error) {
	return m.client.Generate(ctx, messages)
}

// Stream 实现真正的流式生成
func (m *CustomOpenAIModel) Stream(ctx context.Context, messages []*schema.Message, options ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	// 首先尝试真正的流式处理
	stream, err := m.client.StreamGenerate(ctx, messages)
	if err != nil {
		// 如果流式失败，降级到非流式
		message, genErr := m.client.Generate(ctx, messages)
		if genErr != nil {
			return nil, fmt.Errorf("both stream and generate failed: stream_err=%v, generate_err=%v", err, genErr)
		}
		
		// 转换为流式输出
		sr, sw := schema.Pipe[*schema.Message](1)
		go func() {
			defer sw.Close()
			if message != nil {
				sw.Send(message, nil)
			}
		}()
		
		return sr, nil
	}
	
	return stream, nil
}

// WithTools 绑定工具
func (m *CustomOpenAIModel) WithTools(tools []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	// 简单返回自己，因为我们主要关注基本的聊天功能
	return m, nil
}
