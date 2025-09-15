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

package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
	"github.com/coze-dev/coze-studio/backend/domain/knowledge/service"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// Config RAG客户端配置
type Config struct {
	BaseURL    string        `yaml:"base_url"`
	Timeout    time.Duration `yaml:"timeout"`
	MaxRetries int           `yaml:"max_retries"`
	AuthToken  string        `yaml:"auth_token"`
}

// Client RAG微服务客户端实现
type Client struct {
	config     *Config
	httpClient *http.Client
}

// NewRAGClient 创建RAG客户端
func NewRAGClient(config *Config) service.RAGClient {
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// parseTimeToUnix 解析时间字符串为Unix时间戳
func parseTimeToUnix(timeStr string) int64 {
	if timeStr == "" {
		return 0
	}
	
	// 尝试解析ISO 8601格式时间
	if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
		return t.Unix()
	}
	
	// 尝试解析为Unix时间戳字符串
	if timestamp, err := strconv.ParseInt(timeStr, 10, 64); err == nil {
		// 如果是毫秒时间戳，转换为秒
		if timestamp > 1000000000000 {
			return timestamp / 1000
		}
		return timestamp
	}
	
	// 解析失败，返回当前时间
	return time.Now().Unix()
}

// CreateDataset 创建RAG数据集
func (c *Client) CreateDataset(ctx context.Context, dataset *entity.RAGDataset) error {
	reqBody := map[string]interface{}{
		"name":        dataset.Name,
		"description": dataset.Description,
		"type":        dataset.Type,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    string `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/core/dataset", reqBody, "", "", &resp)
	if err != nil {
		return fmt.Errorf("create RAG dataset failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("create RAG dataset failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	dataset.ID = resp.Data
	return nil
}

// GetDataset 获取RAG数据集
func (c *Client) GetDataset(ctx context.Context, datasetID string) (*entity.RAGDataset, error) {
	var resp struct {
		Code    int `json:"code"`
		Message string `json:"message"`
		Data    struct {
			ID          string `json:"_id"`
			Name        string `json:"name"`
			Description string `json:"intro"`
			TeamID      string `json:"teamId"`
			UserID      string `json:"tmbId"`
			VectorModel string `json:"vectorModel"`
			AgentModel  string `json:"agentModel"`
			CreateTime  string `json:"createTime"`
			UpdateTime  string `json:"updateTime"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/core/dataset/%s", datasetID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get RAG dataset failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get RAG dataset failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	dataset := &entity.RAGDataset{
		ID:          resp.Data.ID,
		Name:        resp.Data.Name,
		Description: resp.Data.Description,
		TeamID:      resp.Data.TeamID,
		UserID:      resp.Data.UserID,
		Type:        "default",
		Status:      "active",
		VectorModel: resp.Data.VectorModel,
		AgentModel:  resp.Data.AgentModel,
		CreatedAt:   parseTimeToUnix(resp.Data.CreateTime),
		UpdatedAt:   parseTimeToUnix(resp.Data.UpdateTime),
	}

	return dataset, nil
}

// UpdateDataset 更新RAG数据集
func (c *Client) UpdateDataset(ctx context.Context, dataset *entity.RAGDataset) error {
	reqBody := map[string]interface{}{
		"name":  dataset.Name,
		"intro": dataset.Description,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "PUT", fmt.Sprintf("/api/core/dataset/%s", dataset.ID), reqBody, "", "", &resp)
	if err != nil {
		return fmt.Errorf("update RAG dataset failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("update RAG dataset failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// DeleteDataset 删除RAG数据集
func (c *Client) DeleteDataset(ctx context.Context, datasetID string) error {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/api/core/dataset/%s", datasetID), nil, "", "", &resp)
	if err != nil {
		return fmt.Errorf("delete RAG dataset failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("delete RAG dataset failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// ListDatasets 获取数据集列表（修复签名以匹配接口）
func (c *Client) ListDatasets(ctx context.Context, teamID string) ([]*entity.RAGDataset, error) {
	queryParams := map[string]string{}
	if teamID != "" {
		queryParams["teamId"] = teamID
	}

	// Build query string
	queryString := ""
	for key, value := range queryParams {
		if queryString == "" {
			queryString = "?"
		} else {
			queryString += "&"
		}
		queryString += fmt.Sprintf("%s=%s", key, value)
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			List []struct {
				ID          string `json:"_id"`
				Name        string `json:"name"`
				Description string `json:"intro"`
				TeamID      string `json:"teamId"`
				UserID      string `json:"tmbId"`
				Type        string `json:"type"`
				VectorModel string `json:"vectorModel"`
				AgentModel  string `json:"agentModel"`
				Status      string `json:"status"`
				FileCount   int32  `json:"fileCount"`
				DataCount   int32  `json:"dataCount"`
				CreatedAt   string `json:"createTime"`
				UpdatedAt   string `json:"updateTime"`
			} `json:"list"`
			Total int `json:"total"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", "/api/core/dataset"+queryString, nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("list datasets failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("list datasets failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 转换为RAGDataset列表
	datasets := make([]*entity.RAGDataset, len(resp.Data.List))
	for i, item := range resp.Data.List {
		datasets[i] = &entity.RAGDataset{
			ID:          item.ID,
			Name:        item.Name,
			Description: item.Description,
			TeamID:      item.TeamID,
			UserID:      item.UserID,
			Type:        item.Type,
			VectorModel: item.VectorModel,
			AgentModel:  item.AgentModel,
			Status:      item.Status,
			FileCount:   item.FileCount,
			DataCount:   item.DataCount,
			CreatedAt:   parseTimeToUnix(item.CreatedAt),
			UpdatedAt:   parseTimeToUnix(item.UpdatedAt),
		}
	}

	return datasets, nil
}









// Search 执行RAG搜索
func (c *Client) Search(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error) {
	reqBody := map[string]interface{}{
		"knowledgeBaseId": req.KnowledgeBaseID,
		"query":           req.Query,
		"topK":            req.TopK,
		"scoreThreshold":  req.ScoreThreshold,
		"searchMode":      req.SearchMode,
		"usingReRank":     req.UsingReRank,
		"rerankModel":     req.RerankModel,
	}

	if len(req.DatasetIDs) > 0 {
		reqBody["datasetIds"] = req.DatasetIDs
	}
	if len(req.Filters) > 0 {
		reqBody["filters"] = req.Filters
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			List                 []map[string]interface{} `json:"list"`
			Total                int                      `json:"total"`
			SearchMode           string                   `json:"searchMode"`
			Limit                int                      `json:"limit"`
			Similarity           float64                  `json:"similarity"`
			UsingReRank          bool                     `json:"usingReRank"`
			EmbeddingTokens      int                      `json:"embeddingTokens"`
			ReRankInputTokens    int                      `json:"reRankInputTokens"`
			Duration             string                   `json:"duration"`
			QueryExtensionResult string                   `json:"queryExtensionResult"`
			DeepSearchResult     map[string]string        `json:"deepSearchResult"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/search", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("RAG search failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("RAG search failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 转换搜索结果
	searchItems := make([]*entity.RAGSearchItem, len(resp.Data.List))
	for i, item := range resp.Data.List {
		searchItems[i] = &entity.RAGSearchItem{
			ID:             fmt.Sprintf("%v", item["id"]),
			Content:        fmt.Sprintf("%v", item["q"]),
			Score:          parseFloat64(item["score"]),
			CollectionID:   fmt.Sprintf("%v", item["collectionId"]),
			CollectionName: fmt.Sprintf("%v", item["collectionName"]),
			SourceName:     fmt.Sprintf("%v", item["sourceName"]),
			ChunkIndex:     parseInt(item["chunkIndex"]),
		}
		
		if metadata, ok := item["metadata"].(map[string]interface{}); ok {
			searchItems[i].Metadata = make(map[string]string)
			for k, v := range metadata {
				searchItems[i].Metadata[k] = fmt.Sprintf("%v", v)
			}
		}
	}

	// 创建使用统计
	usageStats := &entity.RAGSearchUsageStats{
		EmbeddingTokens: resp.Data.EmbeddingTokens,
		ReRankTokens:    resp.Data.ReRankInputTokens,
		LLMTokens:       0, // 从响应中获取或设置默认值
	}

	response := &entity.RAGSearchResponse{
		Results:       searchItems,
		TotalCount:    resp.Data.Total,
		SearchID:      "", // 从响应中获取或生成
		SearchMode:    resp.Data.SearchMode,
		ExecutionTime: 0, // 从响应中获取或计算
		UsageStats:    usageStats,
	}

	return response, nil
}







// GetHealth 获取RAG服务健康状态
func (c *Client) GetHealth(ctx context.Context) (*entity.RAGHealthStatus, error) {
	var resp struct {
		Status    string            `json:"status"`
		Version   string            `json:"version"`
		Timestamp int64             `json:"timestamp"`
		Components map[string]string `json:"components"`
	}

	err := c.doRequest(ctx, "GET", "/health", nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get RAG health failed: %w", err)
	}

	// 转换 Components
	capabilities := make([]string, 0, len(resp.Components))
	for key := range resp.Components {
		capabilities = append(capabilities, key)
	}

	health := &entity.RAGHealthStatus{
		Status:       resp.Status,
		Version:      resp.Version,
		Timestamp:    resp.Timestamp,
		Capabilities: capabilities,
	}

	return health, nil
}

// GetUsageStats 获取使用统计
func (c *Client) GetUsageStats(ctx context.Context, teamID string) (*entity.RAGUsageStats, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			UsageRecords []map[string]interface{} `json:"usageRecords"`
			Summary      map[string]interface{}   `json:"summary"`
		} `json:"data"`
	}

	url := fmt.Sprintf("/api/monitoring/usage?teamId=%s", teamID)
	err := c.doRequest(ctx, "GET", url, nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get RAG usage stats failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get RAG usage stats failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 转换使用记录
	usageRecords := make([]*entity.RAGUsageRecord, len(resp.Data.UsageRecords))
	for i, record := range resp.Data.UsageRecords {
		usageRecords[i] = &entity.RAGUsageRecord{
			Date:            fmt.Sprintf("%v", record["date"]),
			SearchCount:     parseInt(record["searchCount"]),
			EmbeddingTokens: parseInt(record["embeddingTokens"]),
			LLMTokens:       parseInt(record["llmTokens"]),
			AvgResponseTime: parseFloat64(record["avgResponseTime"]),
		}
	}

	// 转换汇总信息
	summary := &entity.RAGUsageSummary{
		TotalSearches:        parseInt(resp.Data.Summary["totalSearches"]),
		TotalEmbeddingTokens: parseInt(resp.Data.Summary["totalEmbeddingTokens"]),
		TotalLLMTokens:       parseInt(resp.Data.Summary["totalLLMTokens"]),
		AvgResponseTime:      parseFloat64(resp.Data.Summary["avgResponseTime"]),
	}

	stats := &entity.RAGUsageStats{
		UsageRecords: usageRecords,
		Summary:      summary,
	}

	return stats, nil
}

// UploadFile 上传文件到RAG（已弃用，使用CreateCollectionFromFile代替）
func (c *Client) UploadFile(ctx context.Context, req *entity.RAGFileUploadRequest) (*entity.RAGFileUploadResponse, error) {
	// FastGPT RAG服务没有单独的文件上传接口，需要直接创建集合
	// 这里返回错误，提示使用正确的方法
	return nil, fmt.Errorf("UploadFile is deprecated, use CreateCollectionFromFile instead")
}

// ProcessFile 处理RAG文件
func (c *Client) ProcessFile(ctx context.Context, req *entity.RAGFileProcessRequest) (*entity.RAGFileProcessResponse, error) {
	reqBody := map[string]interface{}{
		"fileId":            req.FileID,
		"fileUrl":           req.FileURL,
		"fileName":          req.FileName,
		"fileType":          req.FileType,
		"chunkSize":         req.ChunkSize,
		"chunkOverlap":      req.ChunkOverlap,
		"preserveStructure": req.PreserveStructure,
		"extractImages":     req.ExtractImages,
		"processingOptions": req.ProcessingOptions,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			JobID         string                     `json:"jobId"`
			Status        entity.FileProcessingStatus `json:"status"`
			ProcessedText string                     `json:"processedText"`
			Chunks        []entity.RAGFileChunk      `json:"chunks"`
			Images        []entity.RAGFileImage      `json:"images"`
			Metadata      map[string]interface{}     `json:"metadata"`
			ProcessTime   int64                      `json:"processTime"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/file/process", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("process file failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("process file failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGFileProcessResponse{
		JobID:         resp.Data.JobID,
		Status:        resp.Data.Status,
		ProcessedText: resp.Data.ProcessedText,
		Chunks:        resp.Data.Chunks,
		Images:        resp.Data.Images,
		Metadata:      resp.Data.Metadata,
		ProcessTime:   resp.Data.ProcessTime,
	}, nil
}

// GetSupportedFileTypes 获取支持的文件类型
func (c *Client) GetSupportedFileTypes(ctx context.Context) ([]string, error) {
	var resp struct {
		Code    int      `json:"code"`
		Message string   `json:"message"`
		Data    []string `json:"data"`
	}

	err := c.doRequest(ctx, "GET", "/api/file/types", nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get supported file types failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get supported file types failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return resp.Data, nil
}

// ValidateFile 验证RAG文件
func (c *Client) ValidateFile(ctx context.Context, req *entity.RAGFileValidationRequest) (*entity.RAGFileValidationResponse, error) {
	reqBody := map[string]interface{}{
		"fileName": req.FileName,
		"fileSize": req.FileSize,
		"fileType": req.FileType,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			IsValid       bool     `json:"isValid"`
			ErrorMessages []string `json:"errorMessages"`
			Warnings      []string `json:"warnings"`
			MaxFileSize   int64    `json:"maxFileSize"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/file/validate", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("validate file failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("validate file failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGFileValidationResponse{
		IsValid:       resp.Data.IsValid,
		ErrorMessages: resp.Data.ErrorMessages,
		Warnings:      resp.Data.Warnings,
		MaxFileSize:   resp.Data.MaxFileSize,
	}, nil
}

// GetFileProcessingStatus 获取文件处理状态
func (c *Client) GetFileProcessingStatus(ctx context.Context, jobID string) (*entity.RAGFileProcessingStatus, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			JobID       string                     `json:"jobId"`
			Status      entity.FileProcessingStatus `json:"status"`
			Progress    int                        `json:"progress"`
			Message     string                     `json:"message"`
			Error       string                     `json:"error"`
			StartTime   int64                      `json:"startTime"`
			EndTime     *int64                     `json:"endTime"`
			ProcessTime int64                      `json:"processTime"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/file/status/%s", jobID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get file processing status failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get file processing status failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGFileProcessingStatus{
		JobID:       resp.Data.JobID,
		Status:      resp.Data.Status,
		Progress:    resp.Data.Progress,
		Message:     resp.Data.Message,
		Error:       resp.Data.Error,
		StartTime:   resp.Data.StartTime,
		EndTime:     resp.Data.EndTime,
		ProcessTime: resp.Data.ProcessTime,
	}, nil
}

// AddTextData 添加文本数据到RAG
func (c *Client) AddTextData(ctx context.Context, kbID string, req *entity.RAGTextDataRequest) error {
	reqBody := map[string]interface{}{
		"content":  req.Content,
		"title":    req.Title,
		"metadata": req.Metadata,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "POST", fmt.Sprintf("/api/core/dataset/%s/text", kbID), reqBody, "", "", &resp)
	if err != nil {
		return fmt.Errorf("add text data to RAG failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("add text data to RAG failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// CreateKnowledgeBase 创建知识库
func (c *Client) CreateKnowledgeBase(ctx context.Context, kb *entity.RAGKnowledgeBase) error {
	reqBody := map[string]interface{}{
		"name":        kb.Name,
		"description": kb.Description,
		"vectorModel": kb.VectorModel,
		"agentModel":  kb.AgentModel,
		"status":      kb.Status,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    string `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/core/kb", reqBody, kb.TeamID, "", &resp)
	if err != nil {
		return fmt.Errorf("create knowledge base failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("create knowledge base failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	kb.ID = resp.Data
	return nil
}

// GetKnowledgeBase 获取知识库
func (c *Client) GetKnowledgeBase(ctx context.Context, kbID string) (*entity.RAGKnowledgeBase, error) {
	var resp struct {
		Code    int `json:"code"`
		Message string `json:"message"`
		Data    struct {
			ID          string `json:"_id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			TeamID      string `json:"teamId"`
			UserID      string `json:"userId"`
			VectorModel string `json:"vectorModel"`
			AgentModel  string `json:"agentModel"`
			Status      string `json:"status"`
			CreatedAt   int64  `json:"createdAt"`
			UpdatedAt   int64  `json:"updatedAt"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/core/kb/%s", kbID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get knowledge base failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get knowledge base failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	kb := &entity.RAGKnowledgeBase{
		ID:          resp.Data.ID,
		Name:        resp.Data.Name,
		Description: resp.Data.Description,
		TeamID:      resp.Data.TeamID,
		VectorModel: resp.Data.VectorModel,
		AgentModel:  resp.Data.AgentModel,
		Status:      resp.Data.Status,
		DataCount:   0, // 初始值，可以从响应中获取
		CreatedAt:   resp.Data.CreatedAt,
		UpdatedAt:   resp.Data.UpdatedAt,
	}

	return kb, nil
}

// UpdateKnowledgeBase 更新知识库
func (c *Client) UpdateKnowledgeBase(ctx context.Context, kb *entity.RAGKnowledgeBase) error {
	reqBody := map[string]interface{}{
		"name":        kb.Name,
		"description": kb.Description,
		"vectorModel": kb.VectorModel,
		"agentModel":  kb.AgentModel,
		"status":      kb.Status,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "PUT", fmt.Sprintf("/api/core/kb/%s", kb.ID), reqBody, kb.TeamID, "", &resp)
	if err != nil {
		return fmt.Errorf("update knowledge base failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("update knowledge base failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// DeleteKnowledgeBase 删除知识库
func (c *Client) DeleteKnowledgeBase(ctx context.Context, kbID string) error {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/api/core/kb/%s", kbID), nil, "", "", &resp)
	if err != nil {
		return fmt.Errorf("delete knowledge base failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("delete knowledge base failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}





// DeepSearch 深度搜索
func (c *Client) DeepSearch(ctx context.Context, req *entity.RAGDeepSearchRequest) (*entity.RAGDeepSearchResponse, error) {
	reqBody := map[string]interface{}{
		"knowledgeBaseId": req.KnowledgeBaseID,
		"query":           req.Query,
		"maxIterations":   req.MaxIterations,
		"searchMode":      req.SearchMode,
		"rerankerModel":   req.RerankerModel,
		"filters":         req.Filters,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			FinalResults     []interface{} `json:"finalResults"`
			IterationResults []interface{} `json:"iterationResults"`
			SearchID         string        `json:"searchId"`
			ExecutionTime    int64         `json:"executionTime"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/search/deep-search", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("deep search failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("deep search failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 这里应该解析实际的搜索结果，暂时返回空结果
	return &entity.RAGDeepSearchResponse{
		FinalResults:     []*entity.RAGSearchItem{},
		IterationResults: []*entity.DeepSearchIteration{},
		SearchID:         resp.Data.SearchID,
		ExecutionTime:    resp.Data.ExecutionTime,
	}, nil
}

// StartTraining 开始训练
func (c *Client) StartTraining(ctx context.Context, kbID string) (*entity.RAGTrainingJob, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			JobID string `json:"jobId"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", fmt.Sprintf("/api/collection/%s/retrain", kbID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("start training failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("start training failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGTrainingJob{
		ID:     resp.Data.JobID,
		Status: "started",
	}, nil
}

// GetTrainingStatus 获取训练状态
func (c *Client) GetTrainingStatus(ctx context.Context, jobID string) (*entity.RAGTrainingJob, error) {
	var resp struct {
		Code    int `json:"code"`
		Message string `json:"message"`
		Data    struct {
			ID               string  `json:"id"`
			Status           string  `json:"status"`
			Progress         float64 `json:"progress"`
			ErrorMessage     string  `json:"errorMessage"`
			ProcessedChunks  int     `json:"processedChunks"`
			TotalChunks      int     `json:"totalChunks"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/core/training/%s", jobID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get training status failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get training status failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGTrainingJob{
		ID:               resp.Data.ID,
		Status:           resp.Data.Status,
		Progress:         resp.Data.Progress,
		ErrorMessage:     resp.Data.ErrorMessage,
		ProcessedChunks:  resp.Data.ProcessedChunks,
		TotalChunks:      resp.Data.TotalChunks,
	}, nil
}

// ========== 集合管理实现 ==========

// CreateCollection 创建集合
func (c *Client) CreateCollection(ctx context.Context, req *entity.RAGCreateCollectionRequest) (*entity.RAGCollection, error) {
	reqBody := map[string]interface{}{
		"datasetId":     req.DatasetID,
		"parentId":      req.ParentID,
		"type":          req.Type,
		"name":          req.Name,
		"tags":          req.Tags,
		"rawText":       req.RawText,
		"rawLink":       req.RawLink,
		"chunkSize":     req.ChunkSize,
		"chunkSplitter": req.ChunkSplitter,
		"trainingType":  req.TrainingType,
		"metadata":      req.Metadata,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    string `json:"data"` // Collection ID
	}

	err := c.doRequest(ctx, "POST", "/api/collection", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("create collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("create collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// Return collection with ID
	return &entity.RAGCollection{
		ID:           resp.Data,
		DatasetID:    req.DatasetID,
		ParentID:     req.ParentID,
		Type:         req.Type,
		Name:         req.Name,
		Tags:         req.Tags,
		ChunkSize:    req.ChunkSize,
		ChunkSplitter: req.ChunkSplitter,
		TrainingType: req.TrainingType,
		Metadata:     req.Metadata,
	}, nil
}

// GetCollection 获取集合详情
func (c *Client) GetCollection(ctx context.Context, collectionID string) (*entity.RAGCollection, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			ID            string                 `json:"_id"`
			DatasetID     string                 `json:"datasetId"`
			ParentID      string                 `json:"parentId"`
			TeamID        string                 `json:"teamId"`
			UserID        string                 `json:"tmbId"`
			Name          string                 `json:"name"`
			Type          string                 `json:"type"`
			Tags          []string               `json:"tags"`
			FileURL       string                 `json:"fileUrl"`
			FileID        string                 `json:"fileId"`
			RawText       string                 `json:"rawText"`
			RawLink       string                 `json:"rawLink"`
			TrainingType  string                 `json:"trainingType"`
			ChunkSize     int                    `json:"chunkSize"`
			ChunkSplitter string                 `json:"chunkSplitter"`
			Status        string                 `json:"status"`
			Metadata      map[string]interface{} `json:"metadata"`
			CreateTime    interface{}            `json:"createTime"` // 可能是字符串或数字
			UpdateTime    interface{}            `json:"updateTime"` // 可能是字符串或数字
		} `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/collection/%s", collectionID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 转换时间字段为字符串
	createTime := convertTimeToString(resp.Data.CreateTime)
	updateTime := convertTimeToString(resp.Data.UpdateTime)

	// 直接使用FastGPT RAG服务返回的status字段
	status := resp.Data.Status
	if status == "" {
		status = "pending" // 默认状态
	}

	return &entity.RAGCollection{
		ID:            resp.Data.ID,
		DatasetID:     resp.Data.DatasetID,
		ParentID:      resp.Data.ParentID,
		TeamID:        resp.Data.TeamID,
		UserID:        resp.Data.UserID,
		Name:          resp.Data.Name,
		Type:          resp.Data.Type,
		Tags:          resp.Data.Tags,
		FileURL:       resp.Data.FileURL,
		FileID:        resp.Data.FileID,
		RawText:       resp.Data.RawText,
		RawLink:       resp.Data.RawLink,
		TrainingType:  resp.Data.TrainingType,
		ChunkSize:     resp.Data.ChunkSize,
		ChunkSplitter: resp.Data.ChunkSplitter,
		Status:        status,
		Metadata:      resp.Data.Metadata,
		CreateTime:    createTime,
		UpdateTime:    updateTime,
	}, nil
}

// UpdateCollection 更新集合
func (c *Client) UpdateCollection(ctx context.Context, collectionID string, updates *entity.RAGUpdateCollectionRequest) (*entity.RAGCollection, error) {
	reqBody := map[string]interface{}{
		"name":         updates.Name,
		"tags":         updates.Tags,
		"chunkSize":    updates.ChunkSize,
		"chunkSplitter": updates.ChunkSplitter,
		"trainingType": updates.TrainingType,
		"metadata":     updates.Metadata,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGCollection `json:"data"`
	}

	err := c.doRequest(ctx, "PUT", fmt.Sprintf("/api/collection/%s", collectionID), reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("update collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("update collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// DeleteCollection 删除集合
func (c *Client) DeleteCollection(ctx context.Context, collectionID string) error {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/api/collection/%s", collectionID), nil, "", "", &resp)
	if err != nil {
		return fmt.Errorf("delete collection failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("delete collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// ListCollections 获取集合列表
func (c *Client) ListCollections(ctx context.Context, req *entity.RAGListCollectionsRequest) (*entity.RAGListCollectionsResponse, error) {
	queryParams := map[string]string{
		"datasetId": req.DatasetID,
	}
	
	if req.ParentID != "" {
		queryParams["parentId"] = req.ParentID
	}
	if req.Type != "" {
		queryParams["type"] = req.Type
	}
	if req.SearchKey != "" {
		queryParams["searchKey"] = req.SearchKey
	}
	if req.Current > 0 {
		queryParams["current"] = fmt.Sprintf("%d", req.Current)
	}
	if req.PageSize > 0 {
		queryParams["pageSize"] = fmt.Sprintf("%d", req.PageSize)
	}

	// Build query string
	queryString := ""
	for key, value := range queryParams {
		if queryString == "" {
			queryString = "?"
		} else {
			queryString += "&"
		}
		queryString += fmt.Sprintf("%s=%s", key, value)
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGListCollectionsResponse `json:"data"`
	}

	err := c.doRequest(ctx, "GET", "/api/collection"+queryString, nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("list collections failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("list collections failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// SyncCollection 同步集合
func (c *Client) SyncCollection(ctx context.Context, collectionID string) (*entity.RAGSyncCollectionResponse, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGSyncCollectionResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", fmt.Sprintf("/api/collection/%s/sync", collectionID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("sync collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("sync collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// RetrainCollection 重训练集合
func (c *Client) RetrainCollection(ctx context.Context, collectionID string) (*entity.RAGRetrainCollectionResponse, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGRetrainCollectionResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", fmt.Sprintf("/api/collection/%s/retrain", collectionID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("retrain collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("retrain collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// GetCollectionTrainingDetail 获取集合训练详情
func (c *Client) GetCollectionTrainingDetail(ctx context.Context, collectionID string) (*entity.RAGCollectionTrainingDetail, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGCollectionTrainingDetail `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/collection/%s/training", collectionID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get collection training detail failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get collection training detail failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// ExportCollection 导出集合
func (c *Client) ExportCollection(ctx context.Context, collectionID string) (*entity.RAGExportCollectionResponse, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGExportCollectionResponse `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/collection/%s/export", collectionID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("export collection failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("export collection failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// CreateCollectionFromFile 从文件创建集合
func (c *Client) CreateCollectionFromFile(ctx context.Context, req *entity.RAGCreateCollectionFromFileRequest) (*entity.RAGCreateCollectionFromFileResponse, error) {
	// 构建multipart form请求
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	
	// 添加文件字段
	part, err := writer.CreateFormFile("file", req.FileName)
	if err != nil {
		return nil, fmt.Errorf("create form file failed: %w", err)
	}
	
	_, err = part.Write(req.FileData)
	if err != nil {
		return nil, fmt.Errorf("write file content failed: %w", err)
	}
	
	// 添加data字段（JSON格式）
	dataField := map[string]interface{}{
		"datasetId":    req.DatasetID,
		"name":         req.Name,
		"trainingType": req.TrainingType,
		"chunkSize":    req.ChunkSize,
	}
	
	if req.ChunkOverlap > 0 {
		dataField["chunkOverlap"] = req.ChunkOverlap
	}
	if req.PreserveStructure {
		dataField["preserveStructure"] = req.PreserveStructure
	}
	if req.ExtractImages {
		dataField["extractImages"] = req.ExtractImages
	}
	if req.Metadata != nil {
		dataField["metadata"] = req.Metadata
	}
	
	dataJSON, err := json.Marshal(dataField)
	if err != nil {
		return nil, fmt.Errorf("marshal data field failed: %w", err)
	}
	
	writer.WriteField("data", string(dataJSON))
	
	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("close multipart writer failed: %w", err)
	}
	
	// 创建HTTP请求
	url := c.config.BaseURL + "/api/core/dataset/collection/create/file"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, &buf)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}
	
	// 设置请求头
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	if c.config.AuthToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.config.AuthToken)
	}
	// 添加team-id和user-id头
	httpReq.Header.Set("x-team-id", "000000000000000000000001")
	httpReq.Header.Set("x-user-id", "000000000000000000000002")
	
	// 执行请求
	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute request failed: %w", err)
	}
	defer httpResp.Body.Close()
	
	// 读取响应
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}
	
	// 解析响应
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			CollectionId string `json:"collectionId"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}
	
	if resp.Code != 200 {
		return nil, fmt.Errorf("create collection from file failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGCreateCollectionFromFileResponse{
		CollectionID: resp.Data.CollectionId,
	}, nil
}

// CreateCollectionFromLink 从链接创建集合
func (c *Client) CreateCollectionFromLink(ctx context.Context, req *entity.RAGCreateCollectionFromLinkRequest) (*entity.RAGCreateCollectionFromLinkResponse, error) {
	reqBody := map[string]interface{}{
		"datasetId":     req.DatasetID,
		"name":          req.Name,
		"link":          req.Link,
		"chunkSize":     req.ChunkSize,
		"chunkSplitter": req.ChunkSplitter,
		"trainingType":  req.TrainingType,
		"metadata":      req.Metadata,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGCreateCollectionFromLinkResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/collection/create/link", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("create collection from link failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("create collection from link failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// CreateCollectionFromText 从文本创建集合
func (c *Client) CreateCollectionFromText(ctx context.Context, req *entity.RAGCreateCollectionFromTextRequest) (*entity.RAGCreateCollectionFromTextResponse, error) {
	reqBody := map[string]interface{}{
		"datasetId":     req.DatasetID,
		"name":          req.Name,
		"text":          req.Text,
		"chunkSize":     req.ChunkSize,
		"chunkSplitter": req.ChunkSplitter,
		"trainingType":  req.TrainingType,
		"metadata":      req.Metadata,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGCreateCollectionFromTextResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/collection/text", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("create collection from text failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("create collection from text failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// ========== 数据管理实现 ==========

// InsertData 插入单条数据
func (c *Client) InsertData(ctx context.Context, req *entity.RAGInsertDataRequest) (*entity.RAGInsertDataResponse, error) {
	reqBody := map[string]interface{}{
		"collectionId": req.CollectionID,
		"q":            req.Q,
		"a":            req.A,
		"chunkIndex":   req.ChunkIndex,
		"indexes":      req.Indexes,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    string `json:"data"` // Data ID
	}

	err := c.doRequest(ctx, "POST", "/api/data", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("insert data failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("insert data failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &entity.RAGInsertDataResponse{
		DataID: resp.Data,
	}, nil
}

// PushDataBatch 批量推送数据
func (c *Client) PushDataBatch(ctx context.Context, req *entity.RAGPushDataBatchRequest) (*entity.RAGPushDataBatchResponse, error) {
	reqBody := map[string]interface{}{
		"collectionId": req.CollectionID,
		"data":         req.Data,
		"mode":         req.Mode,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGPushDataBatchResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/data/push", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("push data batch failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("push data batch failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// GetDataList 获取数据列表
func (c *Client) GetDataList(ctx context.Context, req *entity.RAGGetDataListRequest) (*entity.RAGGetDataListResponse, error) {
	queryParams := map[string]string{}
	
	if req.CollectionID != "" {
		queryParams["collectionId"] = req.CollectionID
	}
	if req.DatasetID != "" {
		queryParams["datasetId"] = req.DatasetID
	}
	if req.SearchText != "" {
		queryParams["searchText"] = req.SearchText
	}
	if req.Current > 0 {
		queryParams["current"] = fmt.Sprintf("%d", req.Current)
	}
	if req.PageSize > 0 {
		queryParams["pageSize"] = fmt.Sprintf("%d", req.PageSize)
	}

	// Build query string
	queryString := ""
	for key, value := range queryParams {
		if queryString == "" {
			queryString = "?"
		} else {
			queryString += "&"
		}
		queryString += fmt.Sprintf("%s=%s", key, value)
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGGetDataListResponse `json:"data"`
	}

	err := c.doRequest(ctx, "GET", "/api/data/list"+queryString, nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get data list failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get data list failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// GetDataById 获取数据详情
func (c *Client) GetDataById(ctx context.Context, dataID string) (*entity.RAGData, error) {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGData `json:"data"`
	}

	err := c.doRequest(ctx, "GET", fmt.Sprintf("/api/data/%s", dataID), nil, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("get data by id failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("get data by id failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// UpdateData 更新数据
func (c *Client) UpdateData(ctx context.Context, dataID string, updates *entity.RAGUpdateDataRequest) (*entity.RAGData, error) {
	reqBody := map[string]interface{}{
		"q":       updates.Q,
		"a":       updates.A,
		"indexes": updates.Indexes,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGData `json:"data"`
	}

	err := c.doRequest(ctx, "PUT", fmt.Sprintf("/api/data/%s", dataID), reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("update data failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("update data failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// DeleteData 删除数据
func (c *Client) DeleteData(ctx context.Context, dataID string) error {
	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	err := c.doRequest(ctx, "DELETE", fmt.Sprintf("/api/data/%s", dataID), nil, "", "", &resp)
	if err != nil {
		return fmt.Errorf("delete data failed: %w", err)
	}

	if resp.Code != 200 {
		return fmt.Errorf("delete data failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return nil
}

// BatchUpdateData 批量更新数据
func (c *Client) BatchUpdateData(ctx context.Context, req *entity.RAGBatchUpdateDataRequest) (*entity.RAGBatchUpdateDataResponse, error) {
	reqBody := map[string]interface{}{
		"updates": req.Updates,
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    entity.RAGBatchUpdateDataResponse `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/data/batch/update", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("batch update data failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("batch update data failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	return &resp.Data, nil
}

// doRequest 执行HTTP请求
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, teamID, userID string, response interface{}) error {
	url := c.config.BaseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body failed: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	if c.config.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.AuthToken)
	}
	if teamID != "" {
		req.Header.Set("x-team-id", teamID)
	}
	if userID != "" {
		req.Header.Set("x-user-id", userID)
	}

	// 执行请求
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request failed: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response failed: %w", err)
	}

	// 记录日志
	logs.Infof("RAG API Request: %s %s, Status: %d, Response: %s", method, path, resp.StatusCode, string(respBody))

	// 解析响应
	if err := json.Unmarshal(respBody, response); err != nil {
		return fmt.Errorf("unmarshal response failed: %w", err)
	}

	return nil
}

// 辅助函数
func parseFloat64(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	if f, ok := v.(float32); ok {
		return float64(f)
	}
	return 0.0
}

func parseInt(v interface{}) int {
	if i, ok := v.(int); ok {
		return i
	}
	if f, ok := v.(float64); ok {
		return int(f)
	}
	return 0
}

func parseTimeField(v interface{}) int64 {
	if v == nil {
		return time.Now().Unix()
	}
	
	// 如果是数字类型（Unix时间戳）
	if f, ok := v.(float64); ok {
		return int64(f)
	}
	if i, ok := v.(int64); ok {
		return i
	}
	if i, ok := v.(int); ok {
		return int64(i)
	}
	
	// 如果是字符串类型（ISO日期）
	if s, ok := v.(string); ok {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			return t.Unix()
		}
		// 尝试其他时间格式
		if t, err := time.Parse("2006-01-02T15:04:05.000Z", s); err == nil {
			return t.Unix()
		}
		if t, err := time.Parse("2006-01-02T15:04:05Z", s); err == nil {
			return t.Unix()
		}
	}
	
	// 默认返回当前时间
	return time.Now().Unix()
}


// ========== 缺失的搜索方法实现 ==========

// SearchDataset 搜索数据集（对应FastGPT的dataset搜索）
func (c *Client) SearchDataset(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error) {
	reqBody := map[string]interface{}{
		"datasetId":       req.DatasetID,
		"text":            req.Query,
		"limit":           req.TopK,
		"similarity":      req.ScoreThreshold,
		"searchMode":      req.SearchMode,
		"usingReRank":     req.UsingReRank,
		"rerankModel":     req.RerankModel,
	}

	if len(req.CollectionIDs) > 0 {
		reqBody["collectionIds"] = req.CollectionIDs
	}
	if len(req.Filters) > 0 {
		reqBody["filters"] = req.Filters
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			List                 []map[string]interface{} `json:"list"`
			Total                int                      `json:"total"`
			SearchMode           string                   `json:"searchMode"`
			Limit                int                      `json:"limit"`
			Similarity           float64                  `json:"similarity"`
			UsingReRank          bool                     `json:"usingReRank"`
			EmbeddingTokens      int                      `json:"embeddingTokens"`
			ReRankInputTokens    int                      `json:"reRankInputTokens"`
			Duration             string                   `json:"duration"`
			QueryExtensionResult string                   `json:"queryExtensionResult"`
			DeepSearchResult     map[string]string        `json:"deepSearchResult"`
		} `json:"data"`
	}

	err := c.doRequest(ctx, "POST", "/api/core/dataset/searchTest", reqBody, "", "", &resp)
	if err != nil {
		return nil, fmt.Errorf("dataset search failed: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("dataset search failed: code=%d, message=%s", resp.Code, resp.Message)
	}

	// 转换搜索结果
	searchItems := make([]*entity.RAGSearchItem, len(resp.Data.List))
	for i, item := range resp.Data.List {
		searchItems[i] = &entity.RAGSearchItem{
			ID:             fmt.Sprintf("%v", item["id"]),
			Content:        fmt.Sprintf("%v", item["q"]),
			Score:          parseFloat64(item["score"]),
			CollectionID:   fmt.Sprintf("%v", item["collectionId"]),
			CollectionName: fmt.Sprintf("%v", item["collectionName"]),
			Metadata:       make(map[string]string),
		}
		if meta, ok := item["metadata"].(map[string]interface{}); ok {
			// 转换 map[string]interface{} 到 map[string]string
			stringMeta := make(map[string]string)
			for k, v := range meta {
				stringMeta[k] = fmt.Sprintf("%v", v)
			}
			searchItems[i].Metadata = stringMeta
		}
	}

	// 构建响应
	response := &entity.RAGSearchResponse{
		Results:    searchItems,
		TotalCount: resp.Data.Total,
		SearchID:   fmt.Sprintf("search_%d", time.Now().Unix()),
		UsageStats: &entity.RAGSearchUsageStats{
			EmbeddingTokens:   resp.Data.EmbeddingTokens,
			ReRankTokens:      resp.Data.ReRankInputTokens,
			SearchDuration:    resp.Data.Duration,
			QueryExtension:    resp.Data.QueryExtensionResult,
			SearchMode:        resp.Data.SearchMode,
			ResultsReturned:   len(searchItems),
			SimilarityThreshold: resp.Data.Similarity,
		},
	}

	return response, nil
}

// SearchKnowledgeBase 搜索知识库（兼容方法，实际调用SearchDataset）
func (c *Client) SearchKnowledgeBase(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error) {
	// 直接调用SearchDataset，因为在FastGPTRAG中，dataset就是知识库
	return c.SearchDataset(ctx, req)
}

// ListKnowledgeBases 获取知识库列表（兼容方法，实际调用ListDatasets）
func (c *Client) ListKnowledgeBases(ctx context.Context, teamID string) ([]*entity.RAGKnowledgeBase, error) {
	// 调用ListDatasets获取dataset列表
	datasets, err := c.ListDatasets(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("list datasets failed: %w", err)
	}

	// 转换为RAGKnowledgeBase格式
	knowledgeBases := make([]*entity.RAGKnowledgeBase, len(datasets))
	for i, dataset := range datasets {
		knowledgeBases[i] = &entity.RAGKnowledgeBase{
			ID:          dataset.ID,
			Name:        dataset.Name,
			Description: dataset.Description,
			TeamID:      dataset.TeamID,
			Status:      dataset.Status,
			VectorModel: dataset.VectorModel,
			AgentModel:  dataset.AgentModel,
			DataCount:   dataset.DataCount,
			CreatedAt:   dataset.CreatedAt,
			UpdatedAt:   dataset.UpdatedAt,
		}
	}

	return knowledgeBases, nil
}

// convertTimeToString 将时间字段转换为字符串
func convertTimeToString(v interface{}) string {
	if v == nil {
		return ""
	}
	
	switch t := v.(type) {
	case string:
		// 如果已经是字符串，直接返回
		return t
	case float64:
		// 如果是数字（Unix时间戳），转换为ISO 8601格式
		return time.Unix(int64(t), 0).Format(time.RFC3339)
	case int64:
		// 如果是int64（Unix时间戳），转换为ISO 8601格式
		return time.Unix(t, 0).Format(time.RFC3339)
	case int:
		// 如果是int（Unix时间戳），转换为ISO 8601格式
		return time.Unix(int64(t), 0).Format(time.RFC3339)
	default:
		// 其他类型，返回空字符串
		return ""
	}
}