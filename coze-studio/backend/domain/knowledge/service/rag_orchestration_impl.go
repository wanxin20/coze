/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package service

import (
	"context"
	"fmt"

	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// ragOrchestrationImpl RAG编排服务实现
// 专注于在Coze工作流中集成FastGPT RAG微服务
type ragOrchestrationImpl struct {
	ragClient RAGClient
}

// NewRAGOrchestrationService 创建RAG编排服务
func NewRAGOrchestrationService(ragClient RAGClient) RAGOrchestrationService {
	return &ragOrchestrationImpl{
		ragClient: ragClient,
	}
}

// ExecuteRAGSearch 执行RAG搜索节点
// 在Coze工作流中作为搜索节点使用
func (r *ragOrchestrationImpl) ExecuteRAGSearch(ctx context.Context, req *entity.RAGOrchestrationRequest) (*entity.RAGOrchestrationResponse, error) {
	logs.CtxInfof(ctx, "Executing RAG search for workflow: query=%s, kbID=%s", req.Query, req.KnowledgeBaseID)

	// 构建RAG搜索请求
	searchReq := &entity.RAGSearchRequest{
		KnowledgeBaseID: req.KnowledgeBaseID,
		Query:          req.Query,
		TopK:           req.TopK,
		ScoreThreshold: req.ScoreThreshold,
		SearchMode:     req.SearchMode, // semantic, keyword, hybrid
		Filters:        req.Filters,
	}

	// 调用RAG微服务进行搜索
	searchResp, err := r.ragClient.SearchKnowledgeBase(ctx, searchReq)
	if err != nil {
		return nil, fmt.Errorf("RAG search failed: %w", err)
	}

	// 转换为编排响应格式
	response := &entity.RAGOrchestrationResponse{
		Results:    searchResp.Results,
		TotalCount: searchResp.TotalCount,
		SearchID:   searchResp.SearchID,
		UsageStats: searchResp.UsageStats,
		// 工作流相关字段
		NodeID:        req.NodeID,
		WorkflowID:    req.WorkflowID,
		ExecutionTime: searchResp.ExecutionTime,
	}

	logs.CtxInfof(ctx, "RAG search completed: found %d results", len(searchResp.Results))
	return response, nil
}

// ExecuteRAGDeepSearch 执行RAG深度搜索节点
// 支持多轮迭代搜索，适用于复杂查询场景
func (r *ragOrchestrationImpl) ExecuteRAGDeepSearch(ctx context.Context, req *entity.RAGDeepSearchOrchestrationRequest) (*entity.RAGDeepSearchOrchestrationResponse, error) {
	logs.CtxInfof(ctx, "Executing RAG deep search for workflow: query=%s, kbID=%s", req.Query, req.KnowledgeBaseID)

	// 构建深度搜索请求
	deepSearchReq := &entity.RAGDeepSearchRequest{
		KnowledgeBaseID: req.KnowledgeBaseID,
		Query:          req.Query,
		MaxIterations:  req.MaxIterations,
		SearchMode:     req.SearchMode,
		RerankerModel:  req.RerankerModel,
		Filters:        req.Filters,
	}

	// 调用RAG微服务进行深度搜索
	deepSearchResp, err := r.ragClient.DeepSearch(ctx, deepSearchReq)
	if err != nil {
		return nil, fmt.Errorf("RAG deep search failed: %w", err)
	}

	// 转换为编排响应格式
	response := &entity.RAGDeepSearchOrchestrationResponse{
		FinalResults:     deepSearchResp.FinalResults,
		IterationResults: deepSearchResp.IterationResults,
		SearchID:         deepSearchResp.SearchID,
		UsageStats:       deepSearchResp.UsageStats,
		// 工作流相关字段
		NodeID:        req.NodeID,
		WorkflowID:    req.WorkflowID,
		ExecutionTime: deepSearchResp.ExecutionTime,
	}

	logs.CtxInfof(ctx, "RAG deep search completed: %d iterations, %d final results", 
		len(deepSearchResp.IterationResults), len(deepSearchResp.FinalResults))
	return response, nil
}

// GetAvailableKnowledgeBases 获取可用的RAG知识库列表
// 用于工作流配置时展示可选的知识库
func (r *ragOrchestrationImpl) GetAvailableKnowledgeBases(ctx context.Context, teamID string) ([]*entity.RAGKnowledgeBase, error) {
	logs.CtxInfof(ctx, "Getting available RAG knowledge bases for team: %s", teamID)

	knowledgeBases, err := r.ragClient.ListKnowledgeBases(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to list RAG knowledge bases: %w", err)
	}

	logs.CtxInfof(ctx, "Found %d available RAG knowledge bases", len(knowledgeBases))
	return knowledgeBases, nil
}

// ValidateRAGConnection 验证RAG服务连接状态
// 确保RAG微服务可用，用于工作流健康检查
func (r *ragOrchestrationImpl) ValidateRAGConnection(ctx context.Context) (*entity.RAGConnectionStatus, error) {
	logs.CtxInfof(ctx, "Validating RAG service connection")

	// 检查RAG服务健康状态
	health, err := r.ragClient.GetHealth(ctx)
	if err != nil {
		return &entity.RAGConnectionStatus{
			IsConnected: false,
			Error:       err.Error(),
			LastCheck:   ctx.Value("timestamp"),
		}, nil
	}

	status := &entity.RAGConnectionStatus{
		IsConnected:    health.Status == "healthy",
		ServiceVersion: health.Version,
		LastCheck:      ctx.Value("timestamp"),
		Capabilities:   health.Capabilities,
	}

	if !status.IsConnected {
		status.Error = "RAG service is not healthy"
	}

	logs.CtxInfof(ctx, "RAG connection validation completed: connected=%v", status.IsConnected)
	return status, nil
}
