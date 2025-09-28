package chatmodel

import (
	"context"

	"github.com/coze-dev/coze-studio/backend/infra/contract/chatmodel"
)

// EnhancedOpenAIBuilder 增强版OpenAI构建器，专门处理第三方API的兼容性问题
func EnhancedOpenAIBuilder(ctx context.Context, config *chatmodel.Config) (chatmodel.ToolCallingChatModel, error) {
	// 对于第三方API，使用我们的自定义客户端以确保请求格式兼容
	return NewCustomOpenAIModel(
		config.APIKey,
		config.BaseURL,
		config.Model,
		config.Timeout,
		config.MaxTokens,
		config.Temperature,
		config.TopP,
	), nil
}

// 注意：EnhancedOpenAIModel 的功能现在由 CustomOpenAIModel 实现
