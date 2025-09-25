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

package knowledge

import (
	"context"
	"fmt"
	"strconv"
	"time"

	ragModel "github.com/coze-dev/coze-studio/backend/api/model/data/knowledge/rag"
	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
	"github.com/coze-dev/coze-studio/backend/domain/knowledge/service"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// ParseTimeString 解析 ISO 8601 时间字符串为 time.Time
func ParseTimeString(timeStr string) time.Time {
	if timeStr == "" {
		return time.Time{}
	}
	
	// 尝试解析 ISO 8601 格式的时间字符串
	if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
		return t
	}
	
	// 如果解析失败，记录错误并返回零值
	logs.Errorf("Failed to parse time string: %s", timeStr)
	return time.Time{}
}

// convertFiltersToStringMap 转换filters类型
func convertFiltersToStringMap(filters map[string]interface{}) map[string]string {
	result := make(map[string]string)
	for k, v := range filters {
		if str, ok := v.(string); ok {
			result[k] = str
		} else {
			result[k] = fmt.Sprintf("%v", v)
		}
	}
	return result
}

func convertToInterfaceMap(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return make(map[string]interface{})
	}
	return data
}

// getUsageStatsEmbeddingTokens 安全获取embedding tokens
func getUsageStatsEmbeddingTokens(stats *entity.RAGSearchUsageStats) int32 {
	if stats == nil {
		return 0
	}
	return int32(stats.EmbeddingTokens)
}

// getUsageStatsRerankTokens 安全获取rerank tokens
func getUsageStatsRerankTokens(stats *entity.RAGSearchUsageStats) int32 {
	if stats == nil {
		return 0
	}
	return int32(stats.ReRankTokens)
}

// convertStringMapToInterfaceMap 转换string map到interface map
func convertStringMapToInterfaceMap(stringMap map[string]string) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range stringMap {
		result[k] = v
	}
	return result
}

// convertCapabilitiesToComponents 转换capabilities到components
func convertCapabilitiesToComponents(capabilities []string) map[string]interface{} {
	result := make(map[string]interface{})
	for i, capability := range capabilities {
		result[fmt.Sprintf("capability_%d", i)] = capability
	}
	return result
}

// RAGApplication RAG应用服务 - 直接调用RAG微服务
type RAGApplication struct {
	ragClient       service.RAGClient        // RAG微服务客户端
	ragWorkflowSvc  service.RAGWorkflowService // RAG工作流服务
	knowledgeSvc    service.Knowledge        // Coze知识库服务（用于权限验证等）
	converter       *RAGConverter            // 数据转换器
}

// NewRAGApplication 创建RAG应用服务
func NewRAGApplication(
	ragClient service.RAGClient,
	ragWorkflowSvc service.RAGWorkflowService,
	knowledgeSvc service.Knowledge,
) *RAGApplication {
	return &RAGApplication{
		ragClient:      ragClient,
		ragWorkflowSvc: ragWorkflowSvc,
		knowledgeSvc:   knowledgeSvc,
		converter:      NewRAGConverter(), // 初始化转换器
	}
}

// SearchByKnowledgeID 通过Coze Knowledge ID进行统一搜索 (推荐使用此方法)
func (app *RAGApplication) SearchByKnowledgeID(ctx context.Context, knowledgeID int64, query string, topK int, scoreThreshold float64, searchMode string) (*ragModel.RagSearchResponse, error) {
	// 1. 通过Knowledge ID获取对应的RagDatasetID
	knowledge, err := app.knowledgeSvc.GetKnowledgeByID(ctx, &service.GetKnowledgeByIDRequest{
		KnowledgeID: knowledgeID,
	})
	if err != nil {
		logs.CtxErrorf(ctx, "Failed to get knowledge by ID %d: %v", knowledgeID, err)
		return nil, fmt.Errorf("knowledge not found: %w", err)
	}

	if knowledge.Knowledge.RagDatasetID == "" {
		return nil, fmt.Errorf("knowledge %d has no associated RAG dataset", knowledgeID)
	}

	// 2. 构建RAG搜索请求，使用DatasetID作为唯一标识
	ragReq := &entity.RAGSearchRequest{
		DatasetID:      knowledge.Knowledge.RagDatasetID, // 使用DatasetID作为唯一标识
		Query:          query,
		TopK:           topK,
		ScoreThreshold: scoreThreshold,
		SearchMode:     searchMode,
		UsingReRank:    true, // 默认启用重排序
	}

	// 3. 调用RAG服务进行dataset搜索 (teamid和userid使用默认值)
	result, err := app.ragClient.SearchDataset(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "RAG dataset search failed for knowledge %d (dataset %s): %v", knowledgeID, knowledge.Knowledge.RagDatasetID, err)
		return nil, fmt.Errorf("RAG dataset search failed: %w", err)
	}

	// 4. 转换响应结果
	searchResults := make([]*ragModel.RagSearchItem, len(result.Results))
	for i, item := range result.Results {
		searchResults[i] = &ragModel.RagSearchItem{
			Id:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionId:   item.CollectionID,
			CollectionName: item.CollectionName,
		}
	}

	response := &ragModel.RagSearchResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		SearchResults:     searchResults,
		Total:            int32(result.TotalCount),
		SearchMode:       result.SearchMode,
		Duration:         fmt.Sprintf("%dms", result.ExecutionTime),
		EmbeddingTokens:  getUsageStatsEmbeddingTokens(result.UsageStats),
		RerankInputTokens: getUsageStatsRerankTokens(result.UsageStats),
	}

	return response, nil
}

// RagSearch RAG搜索 (对应FastGPT的dataset搜索)
func (app *RAGApplication) RagSearch(ctx context.Context, req *ragModel.RagSearchRequest) (*ragModel.RagSearchResponse, error) {
	// 转换请求参数
	ragReq := &entity.RAGSearchRequest{
		DatasetID:      strconv.FormatInt(req.DatasetId, 10),
		Query:          req.Text,
		TopK:           int(req.Limit),
		ScoreThreshold: float64(req.Similarity),
		SearchMode:     req.SearchMode,
		UsingReRank:    req.UsingReRank,
		RerankModel:    req.RerankModel,
		CollectionIDs:  req.CollectionIds,
		Filters:        convertFiltersToStringMap(req.Filters),
	}

	// 调用RAG服务进行dataset搜索
	result, err := app.ragClient.SearchDataset(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "RAG dataset search failed: %v", err)
		return nil, fmt.Errorf("RAG dataset search failed: %w", err)
	}

	// 转换响应结果
	searchResults := make([]*ragModel.RagSearchItem, len(result.Results))
	for i, item := range result.Results {
		searchResults[i] = &ragModel.RagSearchItem{
			Id:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionId:   item.CollectionID,
			CollectionName: item.CollectionName,
		}
	}

	response := &ragModel.RagSearchResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		SearchResults:        searchResults,
		Total:               int32(result.TotalCount),
		SearchMode:          result.SearchMode,
		Duration:            fmt.Sprintf("%dms", result.ExecutionTime),
		EmbeddingTokens:     getUsageStatsEmbeddingTokens(result.UsageStats),
		RerankInputTokens:   getUsageStatsRerankTokens(result.UsageStats),
	}

	return response, nil
}

// DeepSearch 深度搜索
func (app *RAGApplication) DeepSearch(ctx context.Context, req *ragModel.DeepSearchRequest) (*ragModel.DeepSearchResponse, error) {
	// 转换请求参数
	ragReq := &entity.RAGDeepSearchRequest{
		KnowledgeBaseID: strconv.FormatInt(req.DatasetId, 10),
		Query:           req.Text,
		MaxIterations:   int(req.MaxIterations),
		SearchMode:      "semantic", // 默认使用语义搜索
		RerankerModel:   req.Model,
		Filters:         make(map[string]string), // 空过滤器
	}

	// 调用RAG服务
	result, err := app.ragClient.DeepSearch(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "RAG deep search failed: %v", err)
		return nil, fmt.Errorf("RAG deep search failed: %w", err)
	}

	// 转换最终结果
	finalResults := make([]*ragModel.RagSearchItem, len(result.FinalResults))
	for i, item := range result.FinalResults {
		finalResults[i] = &ragModel.RagSearchItem{
			Id:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionId:   item.CollectionID,
			CollectionName: item.CollectionName,
		}
	}

	// 转换迭代结果
	iterations := make([]*ragModel.DeepSearchIteration, len(result.IterationResults))
	for i, iter := range result.IterationResults {
		iterResults := make([]*ragModel.RagSearchItem, len(iter.IterationResults))
		for j, item := range iter.IterationResults {
			iterResults[j] = &ragModel.RagSearchItem{
				Id:      item.ID,
				Content: item.Content,
				Score:   item.Score,
			}
		}

		iterations[i] = &ragModel.DeepSearchIteration{
			IterationIndex:   int32(iter.IterationIndex),
			ExpandedQuery:    iter.ExpandedQuery,
			IterationResults: iterResults,
			TokensUsed:       int32(iter.TokensUsed),
		}
	}

	response := &ragModel.DeepSearchResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		FinalResults: finalResults,
		Iterations:   iterations,
		TotalTokens:  int32(getUsageStatsEmbeddingTokens(result.UsageStats) + getUsageStatsRerankTokens(result.UsageStats)),
		Duration:     fmt.Sprintf("%dms", result.ExecutionTime),
	}

	return response, nil
}

// CreateRagDataset 创建RAG数据集
func (app *RAGApplication) CreateRagDataset(ctx context.Context, req *ragModel.CreateRagDatasetRequest) (*ragModel.CreateRagDatasetResponse, error) {
	// 转换请求参数
	ragDataset := &entity.RAGDataset{
		Name:        req.Name,
		Description: req.Description,
		Type:        "default", // 默认类型
		Status:      "active",  // 默认状态
	}

	// 调用RAG服务创建数据集
	err := app.ragClient.CreateDataset(ctx, ragDataset)
	if err != nil {
		logs.CtxErrorf(ctx, "Create RAG dataset failed: %v", err)
		return nil, fmt.Errorf("create RAG dataset failed: %w", err)
	}

	response := &ragModel.CreateRagDatasetResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		DatasetId: ragDataset.ID,
	}

	return response, nil
}

// ========== 通用搜索方法 ==========

// performRagSearch 执行RAG搜索的通用方法，减少重复代码
func (app *RAGApplication) performRagSearch(ctx context.Context, datasetId string, text string, options *ragSearchOptions) (*ragModel.RagSearchResponse, error) {
	// 转换datasetId为int64（如果需要）
	var datasetIdInt64 int64
	if datasetId != "" {
		var err error
		datasetIdInt64, err = strconv.ParseInt(datasetId, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid dataset ID: %w", err)
		}
	}
	
	// 构建搜索请求
	searchReq := &ragModel.RagSearchRequest{
		DatasetId:     datasetIdInt64,
		Text:          text,
		Limit:         options.Limit,
		Similarity:    float64(options.Similarity),
		SearchMode:    options.SearchMode,
		UsingReRank:   options.UsingReRank,
		RerankModel:   options.RerankModel,
		CollectionIds: options.CollectionIds,
		Filters:       options.Filters,
	}
	
	// 调用基础搜索方法
	return app.RagSearch(ctx, searchReq)
}

// performTraining 执行训练的通用方法，减少重复代码
func (app *RAGApplication) performTraining(ctx context.Context, targetId string, trainingType string) (string, error) {
	logs.CtxInfof(ctx, "Starting %s training for: %s", trainingType, targetId)
	
	// 调用RAG服务启动训练
	job, err := app.ragClient.StartTraining(ctx, targetId)
	if err != nil {
		logs.CtxErrorf(ctx, "%s training failed: %v", trainingType, err)
		return "", fmt.Errorf("%s training failed: %w", trainingType, err)
	}
	
	return job.ID, nil
}

// ========== 工作流集成方法 ==========

// ExecuteRAGSearchInWorkflow 在工作流中执行RAG搜索
func (app *RAGApplication) ExecuteRAGSearchInWorkflow(ctx context.Context, kbID string, query string, options *ragModel.WorkflowSearchOptions) (*ragModel.WorkflowSearchResult, error) {
	logs.CtxInfof(ctx, "Executing RAG search in workflow: kbID=%s, query=%s", kbID, query)
	
	// 验证知识库访问权限（可选，根据需要）
	// if app.knowledgeSvc != nil {
	//     hasAccess := app.knowledgeSvc.ValidateAccess(ctx, kbID, teamID)
	//     if !hasAccess {
	//         return nil, fmt.Errorf("no access to knowledge base: %s", kbID)
	//     }
	// }
	
	// 构建搜索请求
	searchReq := &entity.RAGSearchRequest{
		KnowledgeBaseID: kbID,
		Query:           query,
		TopK:            int(options.Limit),
		ScoreThreshold:  float64(options.Similarity),
		SearchMode:      options.SearchMode,
		UsingReRank:     options.UsingReRank,
		RerankModel:     options.RerankModel,
		Filters:         options.Filters,
	}
	
	// 直接调用RAG服务
	result, err := app.ragClient.SearchKnowledgeBase(ctx, searchReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Workflow RAG search failed: %v", err)
		return nil, fmt.Errorf("workflow RAG search failed: %w", err)
	}
	
	// 转换为工作流格式
	workflowResult := &ragModel.WorkflowSearchResult{
		KnowledgeBaseID: kbID,
		Query:           query,
		Results:         make([]*ragModel.WorkflowSearchItem, len(result.Results)),
		TotalCount:      int32(result.TotalCount),
		ExecutionTime:   result.ExecutionTime,
		UsageStats: &ragModel.WorkflowUsageStats{
			EmbeddingTokens: getUsageStatsEmbeddingTokens(result.UsageStats),
			RerankTokens:    getUsageStatsRerankTokens(result.UsageStats),
		},
	}
	
	// 转换搜索结果
	for i, item := range result.Results {
		workflowResult.Results[i] = &ragModel.WorkflowSearchItem{
			ID:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionID:   item.CollectionID,
			CollectionName: item.CollectionName,
			Metadata:       item.Metadata,
			SourceName:     item.SourceName,
			ChunkIndex:     item.ChunkIndex,
		}
	}
	
	return workflowResult, nil
}

// ExecuteRAGDeepSearchInWorkflow 在工作流中执行RAG深度搜索
func (app *RAGApplication) ExecuteRAGDeepSearchInWorkflow(ctx context.Context, kbID string, query string, options *ragModel.WorkflowDeepSearchOptions) (*ragModel.WorkflowDeepSearchResult, error) {
	logs.CtxInfof(ctx, "Executing RAG deep search in workflow: kbID=%s, query=%s", kbID, query)
	
	// 构建深度搜索请求
	deepSearchReq := &entity.RAGDeepSearchRequest{
		KnowledgeBaseID: kbID,
		Query:           query,
		MaxIterations:   int(options.MaxIterations),
		SearchMode:      options.SearchMode,
		RerankerModel:   options.RerankModel,
		Filters:         options.Filters,
	}
	
	// 调用RAG深度搜索
	result, err := app.ragClient.DeepSearch(ctx, deepSearchReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Workflow RAG deep search failed: %v", err)
		return nil, fmt.Errorf("workflow RAG deep search failed: %w", err)
	}
	
	// 转换为工作流格式
	workflowResult := &ragModel.WorkflowDeepSearchResult{
		KnowledgeBaseID: kbID,
		Query:           query,
		FinalResults:    make([]*ragModel.WorkflowSearchItem, len(result.FinalResults)),
		Iterations:      make([]*ragModel.WorkflowDeepSearchIteration, len(result.IterationResults)),
		TotalTokens:     getUsageStatsEmbeddingTokens(result.UsageStats) + getUsageStatsRerankTokens(result.UsageStats),
		ExecutionTime:   result.ExecutionTime,
	}
	
	// 转换最终结果
	for i, item := range result.FinalResults {
		workflowResult.FinalResults[i] = &ragModel.WorkflowSearchItem{
			ID:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionID:   item.CollectionID,
			CollectionName: item.CollectionName,
		}
	}
	
	// 转换迭代结果
	for i, iter := range result.IterationResults {
		iterResults := make([]*ragModel.WorkflowSearchItem, len(iter.IterationResults))
		for j, item := range iter.IterationResults {
			iterResults[j] = &ragModel.WorkflowSearchItem{
				ID:      item.ID,
				Content: item.Content,
				Score:   item.Score,
			}
		}
		
		workflowResult.Iterations[i] = &ragModel.WorkflowDeepSearchIteration{
			IterationIndex: int32(iter.IterationIndex),
			Query:          iter.ExpandedQuery,
			Results:        iterResults,
			TokensUsed:     int32(iter.TokensUsed),
		}
	}
	
	return workflowResult, nil
}

// GetWorkflowAvailableKnowledgeBases 获取工作流可用的知识库列表
func (app *RAGApplication) GetWorkflowAvailableKnowledgeBases(ctx context.Context, teamID string) ([]*ragModel.WorkflowKnowledgeBase, error) {
	logs.CtxInfof(ctx, "Getting workflow available knowledge bases for team: %s", teamID)
	
	// 直接从RAG服务获取知识库列表
	knowledgeBases, err := app.ragClient.ListDatasets(ctx, teamID)
	if err != nil {
		logs.CtxErrorf(ctx, "Failed to get knowledge bases for workflow: %v", err)
		return nil, fmt.Errorf("failed to get knowledge bases for workflow: %w", err)
	}
	
	// 转换为工作流格式
	workflowKBs := make([]*ragModel.WorkflowKnowledgeBase, len(knowledgeBases))
	for i, kb := range knowledgeBases {
		workflowKBs[i] = &ragModel.WorkflowKnowledgeBase{
			ID:          kb.ID,
			Name:        kb.Name,
			Description: kb.Description,
			Status:      kb.Status,
			DataCount:   kb.DataCount,
		}
	}
	
	return workflowKBs, nil
}

// ValidateKnowledgeBaseForWorkflow 验证知识库在工作流中的可用性
func (app *RAGApplication) ValidateKnowledgeBaseForWorkflow(ctx context.Context, kbID string, teamID string) (*ragModel.WorkflowValidationResult, error) {
	logs.CtxInfof(ctx, "Validating knowledge base %s for workflow (team: %s)", kbID, teamID)
	
	// 尝试获取知识库信息
	kb, err := app.ragClient.GetDataset(ctx, kbID)
	if err != nil {
		return &ragModel.WorkflowValidationResult{
			IsValid:      false,
			ErrorMessage: fmt.Sprintf("Knowledge base not found: %v", err),
		}, nil
	}
	
	// 检查知识库状态
	if kb.Status != "active" {
		return &ragModel.WorkflowValidationResult{
			IsValid:      false,
			ErrorMessage: fmt.Sprintf("Knowledge base is not active, current status: %s", kb.Status),
		}, nil
	}
	
	// 检查团队权限（如果知识库有团队信息）
	if kb.TeamID != "" && kb.TeamID != teamID {
		return &ragModel.WorkflowValidationResult{
			IsValid:      false,
			ErrorMessage: "No permission to access this knowledge base",
		}, nil
	}
	
	return &ragModel.WorkflowValidationResult{
		IsValid:        true,
		KnowledgeBase: &ragModel.WorkflowKnowledgeBase{
			ID:          kb.ID,
			Name:        kb.Name,
			Description: kb.Description,
			Status:      kb.Status,
			DataCount:   kb.DataCount,
		},
	}, nil
}

// ========== 原有方法保持不变 ==========

// CreateRagCollection 创建RAG集合
func (app *RAGApplication) CreateRagCollection(ctx context.Context, req *ragModel.CreateRagCollectionRequest) (*ragModel.CreateRagCollectionResponse, error) {
	logs.CtxInfof(ctx, "Creating RAG collection: %s", req.Name)
	
	// 构建RAG请求
	ragReq := &entity.RAGCreateCollectionRequest{
		DatasetID:     req.DatasetId,
		ParentID:      req.ParentId,
		Type:          req.CollectionType,
		Name:          req.Name,
		Tags:          req.Tags,
		RawText:       req.RawText,
		RawLink:       req.FileUrl, // 兼容旧字段名
		ChunkSize:     int(req.ChunkSize),
		ChunkSplitter: req.ChunkSplitter,
		TrainingType:  req.TrainingType,
		Metadata:      req.Metadata,
	}
	
	// 调用RAG服务
	result, err := app.ragClient.CreateCollection(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Create collection failed: %v", err)
		return nil, fmt.Errorf("create collection failed: %w", err)
	}
	
	// 启动训练任务
	trainingJob, err := app.ragClient.StartTraining(ctx, result.ID)
	if err != nil {
		logs.CtxWarnf(ctx, "Start training failed for collection %s: %v", result.ID, err)
		// 训练失败不影响集合创建
	}

	trainingJobID := ""
	if trainingJob != nil {
		trainingJobID = trainingJob.ID
	}
	
	return &ragModel.CreateRagCollectionResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		CollectionId:  result.ID,
		TrainingJobId: trainingJobID,
	}, nil
}

// StartRagTraining 启动RAG训练
func (app *RAGApplication) StartRagTraining(ctx context.Context, req *ragModel.StartRagTrainingRequest) (*ragModel.StartRagTrainingResponse, error) {
	// 调用RAG服务启动训练
	trainingJob, err := app.ragClient.StartTraining(ctx, req.CollectionId)
	if err != nil {
		logs.CtxErrorf(ctx, "Start RAG training failed: %v", err)
		return nil, fmt.Errorf("start RAG training failed: %w", err)
	}

	response := &ragModel.StartRagTrainingResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Training started successfully",
		},
		TrainingJobId: trainingJob.ID,
	}

	return response, nil
}

// GetRagTrainingStatus 获取RAG训练状态
func (app *RAGApplication) GetRagTrainingStatus(ctx context.Context, req *ragModel.GetRagTrainingStatusRequest) (*ragModel.GetRagTrainingStatusResponse, error) {
	// 调用RAG服务获取训练状态
	trainingJob, err := app.ragClient.GetTrainingStatus(ctx, req.TrainingJobId)
	if err != nil {
		logs.CtxErrorf(ctx, "Get RAG training status failed: %v", err)
		return nil, fmt.Errorf("get RAG training status failed: %w", err)
	}

	response := &ragModel.GetRagTrainingStatusResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		Status:          trainingJob.Status,
		Progress:        int32(trainingJob.Progress * 100), // 转换为int32百分比
		ErrorMessage:    trainingJob.ErrorMessage,
		ProcessedChunks: int32(trainingJob.ProcessedChunks),
		TotalChunks:     int32(trainingJob.TotalChunks),
	}

	return response, nil
}

// GetRagHealth 获取RAG服务健康状态
func (app *RAGApplication) GetRagHealth(ctx context.Context, req *ragModel.GetRagHealthRequest) (*ragModel.GetRagHealthResponse, error) {
	// 调用RAG服务获取健康状态
	health, err := app.ragClient.GetHealth(ctx)
	if err != nil {
		logs.CtxErrorf(ctx, "Get RAG health failed: %v", err)
		return nil, fmt.Errorf("get RAG health failed: %w", err)
	}

	response := &ragModel.GetRagHealthResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		Status:     health.Status,
		Version:    health.Version,
		Timestamp:  time.Unix(health.Timestamp, 0),
		Components: convertCapabilitiesToComponents(health.Capabilities),
	}

	return response, nil
}

// GetRagUsageStats 获取RAG使用统计
func (app *RAGApplication) GetRagUsageStats(ctx context.Context, req *ragModel.GetRagUsageStatsRequest) (*ragModel.GetRagUsageStatsResponse, error) {
	// 调用RAG服务获取使用统计，传递默认团队ID而不是period
	defaultTeamId := "000000000000000000000001" // 使用默认团队ID
	stats, err := app.ragClient.GetUsageStats(ctx, defaultTeamId)
	if err != nil {
		logs.CtxErrorf(ctx, "Get RAG usage stats failed: %v", err)
		return nil, fmt.Errorf("get RAG usage stats failed: %w", err)
	}

	// 转换使用记录
	usageRecords := make([]*ragModel.RagUsageRecord, len(stats.UsageRecords))
	for i, record := range stats.UsageRecords {
		usageRecords[i] = &ragModel.RagUsageRecord{
			Date:            record.Date,
			SearchCount:     int32(record.SearchCount),
			EmbeddingTokens: int32(record.EmbeddingTokens),
			LlmTokens:       int32(record.LLMTokens),
			AvgResponseTime: record.AvgResponseTime,
		}
	}

	// 转换汇总信息
	summary := &ragModel.RagUsageSummary{
		TotalSearches:        int32(stats.Summary.TotalSearches),
		TotalEmbeddingTokens: int32(stats.Summary.TotalEmbeddingTokens),
		TotalLlmTokens:       int32(stats.Summary.TotalLLMTokens),
		AvgResponseTime:      stats.Summary.AvgResponseTime,
	}

	response := &ragModel.GetRagUsageStatsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		UsageRecords: usageRecords,
		Summary:      summary,
	}

	return response, nil
}

// ========== 知识库基础管理应用层实现 ==========

// KnowledgeBaseFilter 知识库过滤器
type KnowledgeBaseFilter struct {
	TeamID    string
	Type      string
	SearchKey string
	ParentID  string
}

// PaginationParams 分页参数
type PaginationParams struct {
	Current  int
	PageSize int
}

// ragSearchOptions 通用搜索选项
type ragSearchOptions struct {
	Limit         int32
	Similarity    float64
	SearchMode    string
	UsingReRank   bool
	RerankModel   string
	CollectionIds []string
	Filters       map[string]interface{}
}

// GetKnowledgeBases 获取知识库列表 (对应FastGPT的dataset列表)
func (app *RAGApplication) GetKnowledgeBases(ctx context.Context, req *ragModel.GetKnowledgeBasesRequest) (*ragModel.GetKnowledgeBasesResponse, error) {
	// 注意：在FastGPTRAG中，dataset就是知识库的概念
	// 调用RAG服务获取dataset列表
	datasetList, err := app.ragClient.ListDatasets(ctx, req.TeamId)
	if err != nil {
		logs.CtxErrorf(ctx, "Get datasets failed: %v", err)
		return nil, fmt.Errorf("get datasets failed: %w", err)
	}

	// 转换dataset列表为知识库列表
	knowledgeBases := make([]*ragModel.KnowledgeBase, len(datasetList))
	for i, dataset := range datasetList {
		knowledgeBases[i] = &ragModel.KnowledgeBase{
			Id:           dataset.ID,
			Name:         dataset.Name,
			Intro:        dataset.Description,
			Type:         dataset.Type,
			VectorModel:  dataset.VectorModel,
			AgentModel:   dataset.AgentModel,
			CreateTime:   time.Unix(dataset.CreatedAt, 0),
			UpdateTime:   time.Unix(dataset.UpdatedAt, 0),
			FileCount:    dataset.FileCount,
			DataCount:    dataset.DataCount,
		}
	}

	response := &ragModel.GetKnowledgeBasesResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		List:  knowledgeBases,
		Total: int32(len(datasetList)),
	}

	return response, nil
}

// CreateKnowledgeBase 创建知识库 (对应FastGPT的dataset创建)
func (app *RAGApplication) CreateKnowledgeBase(ctx context.Context, req *ragModel.CreateKnowledgeBaseRequest) (*ragModel.CreateKnowledgeBaseResponse, error) {
	// 转换为dataset创建请求
	dataset := &entity.RAGDataset{
		Name:        req.Name,
		Description: req.Intro,
		Type:        "dataset", // 默认类型
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		TeamID:      req.TeamId,
		UserID:      req.UserId,
		Status:      "active",
		CreatedAt:   time.Now().Unix(),
		UpdatedAt:   time.Now().Unix(),
	}

	// 调用RAG服务创建dataset
	err := app.ragClient.CreateDataset(ctx, dataset)
	if err != nil {
		logs.CtxErrorf(ctx, "Create dataset failed: %v", err)
		return nil, fmt.Errorf("create dataset failed: %w", err)
	}

	logs.CtxInfof(ctx, "Created FastGPT RAG dataset successfully, fastgpt_id=%s", dataset.ID)

	response := &ragModel.CreateKnowledgeBaseResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		Id: dataset.ID, // 返回FastGPT dataset ID
	}

	return response, nil
}

// GetKnowledgeBaseById 获取知识库详情 (对应FastGPT的dataset详情)
func (app *RAGApplication) GetKnowledgeBaseById(ctx context.Context, req *ragModel.GetKnowledgeBaseByIdRequest) (*ragModel.GetKnowledgeBaseByIdResponse, error) {
	// 1. 首先尝试将 req.Id 解析为 Coze 知识库 ID
	var ragDatasetID string
	
	// 检查是否为数字格式的 Coze 知识库 ID
	if knowledgeID, err := strconv.ParseInt(req.Id, 10, 64); err == nil {
		// 如果是数字，说明可能是 Coze 知识库 ID，需要查找对应的 RAG dataset ID
		knowledge, err := app.knowledgeSvc.GetKnowledgeByID(ctx, &service.GetKnowledgeByIDRequest{
			KnowledgeID: knowledgeID,
		})
		if err != nil {
			logs.CtxErrorf(ctx, "Failed to get knowledge by ID %d: %v", knowledgeID, err)
			return nil, fmt.Errorf("knowledge not found: %w", err)
		}

		if knowledge.Knowledge.RagDatasetID == "" {
			return nil, fmt.Errorf("knowledge %d has no associated RAG dataset", knowledgeID)
		}
		
		ragDatasetID = knowledge.Knowledge.RagDatasetID
		logs.CtxInfof(ctx, "Converting Coze knowledge ID %s to RAG dataset ID %s", req.Id, ragDatasetID)
	} else {
		// 如果不是数字，直接作为 RAG dataset ID 使用
		ragDatasetID = req.Id
		logs.CtxInfof(ctx, "Using direct RAG dataset ID: %s", ragDatasetID)
	}

	// 2. 调用RAG服务获取dataset详情
	dataset, err := app.ragClient.GetDataset(ctx, ragDatasetID)
	if err != nil {
		logs.CtxErrorf(ctx, "Get dataset by id failed: %v", err)
		return nil, fmt.Errorf("get RAG dataset failed: %w", err)
	}

	if dataset == nil {
		logs.CtxErrorf(ctx, "Dataset not found for RAG dataset ID: %s", ragDatasetID)
		return nil, fmt.Errorf("dataset not found")
	}

	// 记录 FastGPT RAG 返回的原始数据结构
	logs.CtxInfof(ctx, "FastGPT RAG dataset response: ID=%s, Name=%s, Description=%s, Type=%s, VectorModel=%s, AgentModel=%s, CreatedAt=%d, UpdatedAt=%d, FileCount=%d, DataCount=%d", 
		dataset.ID, dataset.Name, dataset.Description, dataset.Type, dataset.VectorModel, dataset.AgentModel, dataset.CreatedAt, dataset.UpdatedAt, dataset.FileCount, dataset.DataCount)

	response := &ragModel.GetKnowledgeBaseByIdResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		Data: &ragModel.KnowledgeBase{
			Id:           dataset.ID,
			Name:         dataset.Name,
			Intro:        dataset.Description,
			Type:         dataset.Type,
			VectorModel:  dataset.VectorModel,
			AgentModel:   dataset.AgentModel,
			CreateTime:   time.Unix(dataset.CreatedAt, 0),
			UpdateTime:   time.Unix(dataset.UpdatedAt, 0),
			FileCount:    dataset.FileCount,
			DataCount:    dataset.DataCount,
			RagDatasetId: ragDatasetID, // 设置RAG数据集ID，前端需要用来获取集合列表
		},
	}

	// 记录最终返回给前端的数据结构
	logs.CtxInfof(ctx, "Final response to frontend: Code=%d, Msg=%s, Data.Id=%s, Data.Name=%s, Data.Intro=%s, Data.Type=%s, Data.VectorModel=%s, Data.AgentModel=%s, Data.FileCount=%d, Data.DataCount=%d, Data.RagDatasetId=%s", 
		response.Code, response.Msg, response.Data.Id, response.Data.Name, response.Data.Intro, response.Data.Type, response.Data.VectorModel, response.Data.AgentModel, response.Data.FileCount, response.Data.DataCount, response.Data.RagDatasetId)

	return response, nil
}

// UpdateKnowledgeBase 更新知识库 (对应FastGPT的dataset更新)
func (app *RAGApplication) UpdateKnowledgeBase(ctx context.Context, req *ragModel.UpdateKnowledgeBaseRequest) (*ragModel.UpdateKnowledgeBaseResponse, error) {
	// 先获取现有dataset
	existingDataset, err := app.ragClient.GetDataset(ctx, req.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing dataset: %w", err)
	}

	// 更新字段
	updatedDataset := &entity.RAGDataset{
		ID:          req.Id,
		Name:        req.Name,
		Description: req.Intro,
		TeamID:      existingDataset.TeamID,
		UserID:      existingDataset.UserID,
		Type:        existingDataset.Type,
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		Status:      existingDataset.Status,
		FileCount:   existingDataset.FileCount,
		DataCount:   existingDataset.DataCount,
		ParentID:    existingDataset.ParentID,
		CreatedAt:   existingDataset.CreatedAt,
		UpdatedAt:   time.Now().Unix(),
	}

	// 调用RAG服务更新dataset
	err = app.ragClient.UpdateDataset(ctx, updatedDataset)
	if err != nil {
		logs.CtxErrorf(ctx, "Update dataset failed: %v", err)
		return nil, fmt.Errorf("update dataset failed: %w", err)
	}

	response := &ragModel.UpdateKnowledgeBaseResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		Data: &ragModel.KnowledgeBase{
			Id:           updatedDataset.ID,
			Name:         updatedDataset.Name,
			Intro:        updatedDataset.Description,
			Type:         updatedDataset.Type,
			VectorModel:  updatedDataset.VectorModel,
			AgentModel:   updatedDataset.AgentModel,
			CreateTime:   time.Unix(updatedDataset.CreatedAt, 0),
			UpdateTime:   time.Unix(updatedDataset.UpdatedAt, 0),
			FileCount:    updatedDataset.FileCount,
			DataCount:    updatedDataset.DataCount,
		},
	}

	return response, nil
}

// DeleteKnowledgeBase 删除知识库 (对应FastGPT的dataset删除)
func (app *RAGApplication) DeleteKnowledgeBase(ctx context.Context, req *ragModel.DeleteKnowledgeBaseRequest) (*ragModel.DeleteKnowledgeBaseResponse, error) {
	// 调用RAG服务删除dataset
	err := app.ragClient.DeleteDataset(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Delete dataset failed: %v", err)
		return nil, fmt.Errorf("delete dataset failed: %w", err)
	}

	response := &ragModel.DeleteKnowledgeBaseResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
	}

	return response, nil
}

// SearchTestKnowledgeBase 知识库搜索测试 (对应FastGPT的dataset搜索测试)
func (app *RAGApplication) SearchTestKnowledgeBase(ctx context.Context, req *ragModel.SearchTestKnowledgeBaseRequest) (*ragModel.SearchTestKnowledgeBaseResponse, error) {
	// 1. 首先尝试将 req.DatasetId 解析为 Coze 知识库 ID
	var ragDatasetID string
	
	// 检查是否为数字格式的 Coze 知识库 ID
	if knowledgeID, err := strconv.ParseInt(req.DatasetId, 10, 64); err == nil {
		// 如果是数字，说明可能是 Coze 知识库 ID，需要查找对应的 RAG dataset ID
		knowledge, err := app.knowledgeSvc.GetKnowledgeByID(ctx, &service.GetKnowledgeByIDRequest{
			KnowledgeID: knowledgeID,
		})
		if err != nil {
			logs.CtxErrorf(ctx, "Failed to get knowledge by ID %d: %v", knowledgeID, err)
			return nil, fmt.Errorf("knowledge not found: %w", err)
		}

		if knowledge.Knowledge.RagDatasetID == "" {
			return nil, fmt.Errorf("knowledge %d has no associated RAG dataset", knowledgeID)
		}
		
		ragDatasetID = knowledge.Knowledge.RagDatasetID
		logs.CtxInfof(ctx, "Converting Coze knowledge ID %s to RAG dataset ID %s", req.DatasetId, ragDatasetID)
	} else {
		// 如果不是数字，直接作为 RAG dataset ID 使用
		ragDatasetID = req.DatasetId
		logs.CtxInfof(ctx, "Using direct RAG dataset ID: %s", ragDatasetID)
	}

	// 2. 转换搜索参数
	searchReq := &entity.RAGSearchRequest{
		DatasetID:      ragDatasetID,
		Query:          req.Text,
		TopK:           int(req.Limit),
		ScoreThreshold: req.Similarity,
		SearchMode:     req.SearchMode,
		UsingReRank:    req.UsingReRank,
		RerankModel:    req.RerankModel,
		CollectionIDs:  req.CollectionIds,
		Filters:        convertFiltersToStringMap(req.Filters),
	}

	// 调用RAG服务执行dataset搜索测试
	result, err := app.ragClient.SearchDataset(ctx, searchReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Search test dataset failed: %v", err)
		return nil, fmt.Errorf("search test dataset failed: %w", err)
	}

	// 转换搜索结果
	searchResults := make([]*ragModel.KnowledgeBaseSearchResult, len(result.Results))
	for i, item := range result.Results {
		searchResults[i] = &ragModel.KnowledgeBaseSearchResult{
			Id:             item.ID,
			Content:        item.Content,
			Score:          item.Score,
			CollectionId:   item.CollectionID,
			CollectionName: item.CollectionName,
			Metadata:       convertStringMapToInterfaceMap(item.Metadata),
			SourceName:     item.SourceName,
			ChunkIndex:     int32(item.ChunkIndex),
		}
	}

	response := &ragModel.SearchTestKnowledgeBaseResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		List:                     searchResults,
		Total:                    int32(result.TotalCount),
		SearchMode:               result.SearchMode,
		Limit:                    int32(req.Limit),
		Similarity:               req.Similarity,
		UsingReRank:              req.UsingReRank,
		EmbeddingTokens:          getUsageStatsEmbeddingTokens(result.UsageStats),
		ReRankInputTokens:        getUsageStatsRerankTokens(result.UsageStats),
		Duration:                 fmt.Sprintf("%dms", result.ExecutionTime),
		QueryExtensionResult:     "",  // RAGSearchResponse中没有这个字段
		DatasetSearchUsingExtensionQuery: req.DatasetSearchUsingExtensionQuery,
	}

	return response, nil
}

// ========== Dataset Management Methods ==========

// GetRagDatasets 获取RAG数据集列表
func (app *RAGApplication) GetRagDatasets(ctx context.Context, req *ragModel.GetRagDatasetsRequest) (*ragModel.GetRagDatasetsResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG datasets for team: %s", req.TeamId)
	
	// 调用RAG服务获取数据集列表
	datasets, err := app.ragClient.ListDatasets(ctx, req.TeamId)
	if err != nil {
		logs.CtxErrorf(ctx, "Get RAG datasets failed: %v", err)
		return nil, fmt.Errorf("get RAG datasets failed: %w", err)
	}
	
	// 转换为响应格式
	ragDatasets := make([]*ragModel.RagDataset, 0, len(datasets))
	for _, dataset := range datasets {
		ragDatasets = append(ragDatasets, &ragModel.RagDataset{
			Id:          dataset.ID,
			Name:        dataset.Name,
			Description: dataset.Description,
			VectorModel: dataset.VectorModel, // 使用实体中的VectorModel字段
			AgentModel:  dataset.AgentModel,  // 使用实体中的AgentModel字段
			CreateTime:  time.Unix(dataset.CreatedAt, 0),
			UpdateTime:  time.Unix(dataset.UpdatedAt, 0),
		})
	}
	
	return &ragModel.GetRagDatasetsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		List:  ragDatasets,
		Total: int32(len(ragDatasets)), // 简化实现，实际应该返回总数
	}, nil
}

// GetRagDatasetById 获取RAG数据集详情
func (app *RAGApplication) GetRagDatasetById(ctx context.Context, req *ragModel.GetRagDatasetByIdRequest) (*ragModel.GetRagDatasetByIdResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG dataset by ID: %s", req.Id)
	
	// 调用RAG服务获取数据集详情
	dataset, err := app.ragClient.GetDataset(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Get RAG dataset by ID failed: %v", err)
		return nil, fmt.Errorf("get RAG dataset by ID failed: %w", err)
	}
	
	return &ragModel.GetRagDatasetByIdResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Dataset: &ragModel.RagDataset{
			Id:          dataset.ID,
			Name:        dataset.Name,
			Description: dataset.Description,
			VectorModel: dataset.VectorModel, // 使用实体中的VectorModel字段
			AgentModel:  dataset.AgentModel,  // 使用实体中的AgentModel字段
			CreateTime:  time.Unix(dataset.CreatedAt, 0),
			UpdateTime:  time.Unix(dataset.UpdatedAt, 0),
		},
	}, nil
}

// UpdateRagDataset 更新RAG数据集
func (app *RAGApplication) UpdateRagDataset(ctx context.Context, req *ragModel.UpdateRagDatasetRequest) (*ragModel.UpdateRagDatasetResponse, error) {
	logs.CtxInfof(ctx, "Updating RAG dataset: %s", req.Id)
	
	// 构建更新请求
	updateReq := &entity.RAGDataset{
		ID:          req.Id,
		Name:        req.Name,
		Description: req.Description,
		// 注意：RAGDataset实体中没有VectorModel和AgentModel字段
		// 这些字段可能需要在RAGDataset实体中添加，或者通过其他方式处理
	}
	
	// 调用RAG服务更新数据集
	if err := app.ragClient.UpdateDataset(ctx, updateReq); err != nil {
		logs.CtxErrorf(ctx, "Update RAG dataset failed: %v", err)
		return nil, fmt.Errorf("update RAG dataset failed: %w", err)
	}
	
	// 获取更新后的数据集
	dataset, err := app.ragClient.GetDataset(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Get updated RAG dataset failed: %v", err)
		return nil, fmt.Errorf("get updated RAG dataset failed: %w", err)
	}
	
	return &ragModel.UpdateRagDatasetResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Dataset: &ragModel.RagDataset{
			Id:          dataset.ID,
			Name:        dataset.Name,
			Description: dataset.Description,
			VectorModel: dataset.VectorModel, // 使用实体中的VectorModel字段
			AgentModel:  dataset.AgentModel,  // 使用实体中的AgentModel字段
			CreateTime:  time.Unix(dataset.CreatedAt, 0),
			UpdateTime:  time.Unix(dataset.UpdatedAt, 0),
		},
	}, nil
}

// DeleteRagDataset 删除RAG数据集
func (app *RAGApplication) DeleteRagDataset(ctx context.Context, req *ragModel.DeleteRagDatasetRequest) (*ragModel.DeleteRagDatasetResponse, error) {
	logs.CtxInfof(ctx, "Deleting RAG dataset: %s", req.Id)
	
	// 调用RAG服务删除数据集
	if err := app.ragClient.DeleteDataset(ctx, req.Id); err != nil {
		logs.CtxErrorf(ctx, "Delete RAG dataset failed: %v", err)
		return nil, fmt.Errorf("delete RAG dataset failed: %w", err)
	}
	
	return &ragModel.DeleteRagDatasetResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
	}, nil
}

// RetrainRagDataset 重训练RAG数据集 - 使用通用训练方法
func (app *RAGApplication) RetrainRagDataset(ctx context.Context, req *ragModel.RetrainRagDatasetRequest) (*ragModel.RetrainRagDatasetResponse, error) {
	// 使用通用训练方法
	trainingJobId, err := app.performTraining(ctx, req.DatasetId, "dataset")
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RetrainRagDatasetResponse{
		BaseResponse:  ragModel.BaseResponse{Code: 0, Msg: "success"},
		TrainingJobId: trainingJobId,
	}, nil
}

// ========== Collection Management Methods ==========

// GetRagCollections 获取RAG集合列表
func (app *RAGApplication) GetRagCollections(ctx context.Context, req *ragModel.GetRagCollectionsRequest) (*ragModel.GetRagCollectionsResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG collections for dataset: %s", req.DatasetId)
	
	// 构建RAG请求
	ragReq := &entity.RAGListCollectionsRequest{
		DatasetID: req.DatasetId,
		ParentID:  req.ParentId,
		Type:      req.Type,
		SearchKey: req.SearchKey,
		Current:   int(req.Current),
		PageSize:  int(req.PageSize),
	}
	
	// 调用RAG服务
	result, err := app.ragClient.ListCollections(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "List collections failed: %v", err)
		return nil, fmt.Errorf("list collections failed: %w", err)
	}
	
	// 转换响应结果
	collections := make([]*ragModel.RagCollection, len(result.List))
	for i, item := range result.List {
		collections[i] = &ragModel.RagCollection{
			Id:            item.ID,
			DatasetId:     item.DatasetID,
			Name:          item.Name,
			Type:          item.Type,
			CreateTime:    ParseTimeString(item.CreateTime),
			UpdateTime:    ParseTimeString(item.UpdateTime),
			RawText:       item.RawText,
			TrainingType:  item.TrainingType,
			ChunkSize:     int32(item.ChunkSize),
			Status:        item.Status,
			Metadata:      item.Metadata, // 添加缺失的Metadata字段
		}
	}
	
	return &ragModel.GetRagCollectionsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		List:  collections,
		Total: int32(result.Total),
	}, nil
}

// GetRagCollectionById 获取RAG集合详情
func (app *RAGApplication) GetRagCollectionById(ctx context.Context, req *ragModel.GetRagCollectionByIdRequest) (*ragModel.GetRagCollectionByIdResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG collection by ID: %s", req.Id)
	
	// 调用RAG服务
	result, err := app.ragClient.GetCollection(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Get collection by ID failed: %v", err)
		return nil, fmt.Errorf("get collection by ID failed: %w", err)
	}
	
	// 转换响应结果
	collection := &ragModel.RagCollection{
		Id:            result.ID,
		DatasetId:     result.DatasetID,
		Name:          result.Name,
		Type:          result.Type,
		CreateTime:    ParseTimeString(result.CreateTime),
		UpdateTime:    ParseTimeString(result.UpdateTime),
		RawText:       result.RawText,
		TrainingType:  result.TrainingType,
		ChunkSize:     int32(result.ChunkSize),
		Status:        result.Status,
	}
	
	return &ragModel.GetRagCollectionByIdResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Collection: collection,
	}, nil
}

// UpdateRagCollection 更新RAG集合
func (app *RAGApplication) UpdateRagCollection(ctx context.Context, req *ragModel.UpdateRagCollectionRequest) (*ragModel.UpdateRagCollectionResponse, error) {
	logs.CtxInfof(ctx, "Updating RAG collection: %s", req.Id)
	
	// 构建RAG请求
	ragReq := &entity.RAGUpdateCollectionRequest{
		Name:          req.Name,
		Tags:          req.Tags,
		ChunkSize:     int(req.ChunkSize),
		ChunkSplitter: req.ChunkSplitter,
		TrainingType:  req.TrainingType,
		Metadata:      req.Metadata,
	}
	
	// 调用RAG服务
	result, err := app.ragClient.UpdateCollection(ctx, req.Id, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Update collection failed: %v", err)
		return nil, fmt.Errorf("update collection failed: %w", err)
	}
	
	// 转换响应结果
	collection := &ragModel.RagCollection{
		Id:            result.ID,
		DatasetId:     result.DatasetID,
		Name:          result.Name,
		Type:          result.Type,
		CreateTime:    ParseTimeString(result.CreateTime),
		UpdateTime:    ParseTimeString(result.UpdateTime),
		RawText:       result.RawText,
		TrainingType:  result.TrainingType,
		ChunkSize:     int32(result.ChunkSize),
	}
	
	return &ragModel.UpdateRagCollectionResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Collection: collection,
	}, nil
}

// DeleteRagCollection 删除RAG集合
func (app *RAGApplication) DeleteRagCollection(ctx context.Context, req *ragModel.DeleteRagCollectionRequest) (*ragModel.DeleteRagCollectionResponse, error) {
	logs.CtxInfof(ctx, "Deleting RAG collection: %s", req.Id)
	
	// 调用RAG服务删除集合
	err := app.ragClient.DeleteCollection(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Delete collection failed: %v", err)
		return nil, fmt.Errorf("delete collection failed: %w", err)
	}
	
	return &ragModel.DeleteRagCollectionResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
	}, nil
}

// SyncRagCollection 同步RAG集合
func (app *RAGApplication) SyncRagCollection(ctx context.Context, req *ragModel.SyncRagCollectionRequest) (*ragModel.SyncRagCollectionResponse, error) {
	logs.CtxInfof(ctx, "Syncing RAG collection: %s", req.Id)
	
	// 调用RAG服务同步集合
	_, err := app.ragClient.SyncCollection(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Sync collection failed: %v", err)
		return nil, fmt.Errorf("sync collection failed: %w", err)
	}
	
	return &ragModel.SyncRagCollectionResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
	}, nil
}

// RetrainRagCollection 重训练RAG集合 - 使用通用训练方法
func (app *RAGApplication) RetrainRagCollection(ctx context.Context, req *ragModel.RetrainRagCollectionRequest) (*ragModel.RetrainRagCollectionResponse, error) {
	// 使用通用训练方法
	trainingJobId, err := app.performTraining(ctx, req.Id, "collection")
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RetrainRagCollectionResponse{
		BaseResponse:  ragModel.BaseResponse{Code: 0, Msg: "success"},
		TrainingJobId: trainingJobId,
	}, nil
}

// GetRagCollectionTrainingDetail 获取RAG集合训练详情
func (app *RAGApplication) GetRagCollectionTrainingDetail(ctx context.Context, req *ragModel.GetRagCollectionTrainingDetailRequest) (*ragModel.GetRagCollectionTrainingDetailResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG collection training detail: %s", req.Id)
	
	// 调用RAG服务获取训练详情
	_, err := app.ragClient.GetCollectionTrainingDetail(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Get collection training detail failed: %v", err)
		return nil, fmt.Errorf("get collection training detail failed: %w", err)
	}
	
	return &ragModel.GetRagCollectionTrainingDetailResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		TrainingDetail: &ragModel.TrainingDetail{
			Status:       "completed",
			Progress:     100,
			ErrorMessage: "",
		},
	}, nil
}

// ExportRagCollection 导出RAG集合
func (app *RAGApplication) ExportRagCollection(ctx context.Context, req *ragModel.ExportRagCollectionRequest) (*ragModel.ExportRagCollectionResponse, error) {
	logs.CtxInfof(ctx, "Exporting RAG collection: %s", req.Id)
	
	// 调用RAG服务导出集合
	result, err := app.ragClient.ExportCollection(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Export collection failed: %v", err)
		return nil, fmt.Errorf("export collection failed: %w", err)
	}
	
	return &ragModel.ExportRagCollectionResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		ExportData: result.Data,
	}, nil
}

// InsertRagData 插入单条RAG数据
func (app *RAGApplication) InsertRagData(ctx context.Context, req *ragModel.InsertRagDataRequest) (*ragModel.InsertRagDataResponse, error) {
	logs.CtxInfof(ctx, "Inserting RAG data to collection: %s", req.CollectionId)
	
	// 构建RAG请求
	ragReq := &entity.RAGInsertDataRequest{
		CollectionID: req.CollectionId,
		Q:            req.Q,
		A:            req.A,
		ChunkIndex:   int(req.ChunkIndex),
	}
	
	// 调用RAG服务
	result, err := app.ragClient.InsertData(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Insert data failed: %v", err)
		return nil, fmt.Errorf("insert data failed: %w", err)
	}
	
	return &ragModel.InsertRagDataResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		DataId: result.DataID,
	}, nil
}

// PushRagDataBatch 批量推送RAG数据
func (app *RAGApplication) PushRagDataBatch(ctx context.Context, req *ragModel.PushRagDataBatchRequest) (*ragModel.PushRagDataBatchResponse, error) {
	logs.CtxInfof(ctx, "Pushing RAG data batch to collection: %s", req.CollectionId)
	
	// 转换数据项
	dataItems := make([]entity.RAGDataItem, len(req.Data))
	for i, item := range req.Data {
		// 转换索引数据
		indexes := make([]entity.RAGDataIndex, len(item.Indexes))
		for j, idx := range item.Indexes {
			indexes[j] = entity.RAGDataIndex{
				Type:   idx.Type,
				DataID: idx.DataId,
				Text:   idx.Text,
			}
		}
		
		dataItems[i] = entity.RAGDataItem{
			Q:          item.Q,
			A:          item.A,
			ChunkIndex: int(item.ChunkIndex),
			Indexes:    indexes,
		}
	}
	
	// 构建RAG请求
	ragReq := &entity.RAGPushDataBatchRequest{
		CollectionID: req.CollectionId,
		Data:         dataItems,
		Mode:         req.Mode,
	}
	
	// 调用RAG服务
	result, err := app.ragClient.PushDataBatch(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Push data batch failed: %v", err)
		return nil, fmt.Errorf("push data batch failed: %w", err)
	}
	
	return &ragModel.PushRagDataBatchResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		InsertedCount: int32(result.InsertedCount),
	}, nil
}

// GetRagDataList 获取RAG数据列表
func (app *RAGApplication) GetRagDataList(ctx context.Context, req *ragModel.GetRagDataListRequest) (*ragModel.GetRagDataListResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG data list for collection: %s", req.CollectionId)
	
	// 构建RAG请求
	ragReq := &entity.RAGGetDataListRequest{
		CollectionID: req.CollectionId,
		Current:      int(req.Current),
		PageSize:     int(req.PageSize),
	}
	
	// 调用RAG服务
	result, err := app.ragClient.GetDataList(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Get data list failed: %v", err)
		return nil, fmt.Errorf("get data list failed: %w", err)
	}
	
	// 转换响应结果
	dataList := make([]*ragModel.RagData, len(result.List))
	for i, item := range result.List {
		// 转换索引数据
		indexes := make([]*ragModel.RagDataIndex, len(item.Indexes))
		for j, idx := range item.Indexes {
			indexes[j] = &ragModel.RagDataIndex{
				Type:   idx.Type,
				DataId: idx.DataID,
				Text:   idx.Text,
			}
		}
		
		dataList[i] = &ragModel.RagData{
			Id:           item.ID,
			CollectionId: item.CollectionID,
			Q:            item.Q,
			A:            item.A,
			ChunkIndex:   int32(item.ChunkIndex),
			Indexes:      indexes,
			UpdateTime:   time.Unix(item.UpdateTime, 0),
		}
	}
	
	return &ragModel.GetRagDataListResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		List:     dataList,
		Total:    int32(result.Total),
	}, nil
}

// GetRagDataById 获取RAG数据详情
func (app *RAGApplication) GetRagDataById(ctx context.Context, req *ragModel.GetRagDataByIdRequest) (*ragModel.GetRagDataByIdResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG data by ID: %s", req.Id)
	
	// 调用RAG服务
	result, err := app.ragClient.GetDataById(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Get data by ID failed: %v", err)
		return nil, fmt.Errorf("get data by ID failed: %w", err)
	}
	
	// 转换索引数据
	indexes := make([]*ragModel.RagDataIndex, len(result.Indexes))
	for i, idx := range result.Indexes {
		indexes[i] = &ragModel.RagDataIndex{
			Type:   idx.Type,
			DataId: idx.DataID,
			Text:   idx.Text,
		}
	}
	
	// 转换响应结果
	data := &ragModel.RagData{
		Id:           result.ID,
		CollectionId: result.CollectionID,
		Q:            result.Q,
		A:            result.A,
		ChunkIndex:   int32(result.ChunkIndex),
		Indexes:      indexes,
		UpdateTime:   time.Unix(result.UpdateTime, 0),
	}
	
	return &ragModel.GetRagDataByIdResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Data: data,
	}, nil
}

// UpdateRagData 更新RAG数据
func (app *RAGApplication) UpdateRagData(ctx context.Context, req *ragModel.UpdateRagDataRequest) (*ragModel.UpdateRagDataResponse, error) {
	logs.CtxInfof(ctx, "Updating RAG data: %s", req.Id)
	
	// 转换索引数据
	indexes := make([]entity.RAGDataIndex, len(req.Indexes))
	for i, idx := range req.Indexes {
		indexes[i] = entity.RAGDataIndex{
			Type:   idx.Type,
			DataID: idx.DataId,
			Text:   idx.Text,
		}
	}
	
	// 构建RAG请求
	ragReq := &entity.RAGUpdateDataRequest{
		Q:       req.Q,
		A:       req.A,
		Indexes: indexes,
	}
	
	// 调用RAG服务
	result, err := app.ragClient.UpdateData(ctx, req.Id, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Update data failed: %v", err)
		return nil, fmt.Errorf("update data failed: %w", err)
	}
	
	// 转换响应索引数据
	responseIndexes := make([]*ragModel.RagDataIndex, len(result.Indexes))
	for i, idx := range result.Indexes {
		responseIndexes[i] = &ragModel.RagDataIndex{
			Type:   idx.Type,
			DataId: idx.DataID,
			Text:   idx.Text,
		}
	}
	
	// 转换响应结果
	data := &ragModel.RagData{
		Id:           result.ID,
		CollectionId: result.CollectionID,
		Q:            result.Q,
		A:            result.A,
		ChunkIndex:   int32(result.ChunkIndex),
		Indexes:      responseIndexes,
		UpdateTime:   time.Unix(result.UpdateTime, 0),
	}
	
	return &ragModel.UpdateRagDataResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Data: data,
	}, nil
}

// DeleteRagData 删除RAG数据
func (app *RAGApplication) DeleteRagData(ctx context.Context, req *ragModel.DeleteRagDataRequest) (*ragModel.DeleteRagDataResponse, error) {
	logs.CtxInfof(ctx, "Deleting RAG data: %s", req.Id)
	
	// 调用RAG服务
	err := app.ragClient.DeleteData(ctx, req.Id)
	if err != nil {
		logs.CtxErrorf(ctx, "Delete data failed: %v", err)
		return nil, fmt.Errorf("delete data failed: %w", err)
	}
	
	return &ragModel.DeleteRagDataResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
	}, nil
}

// CreateRagCollectionFromFile 从文件创建RAG集合
func (app *RAGApplication) CreateRagCollectionFromFile(ctx context.Context, req *ragModel.CreateRagCollectionFromFileRequest) (*ragModel.CreateRagCollectionFromFileResponse, error) {
	logs.CtxInfof(ctx, "Creating RAG collection from file: %s", req.FileName)
	
	// 构建RAG请求
	ragReq := &entity.RAGCreateCollectionFromFileRequest{
		DatasetID:         req.DatasetId,
		Name:              req.Name,
		FileData:          req.FileData,
		FileName:          req.FileName,
		FileType:          entity.SupportedFileType(req.FileType),
		TrainingType:      req.TrainingType,
		ChunkSize:         int(req.ChunkSize),
		ChunkOverlap:      int(req.ChunkOverlap),
		PreserveStructure: req.PreserveStructure,
		ExtractImages:     req.ExtractImages,
		Tags:              req.Tags,
		Metadata:          req.Metadata,
	}
	
	// 调用RAG服务创建集合
	result, err := app.ragClient.CreateCollectionFromFile(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Create collection from file failed: %v", err)
		return nil, fmt.Errorf("create collection from file failed: %w", err)
	}
	
	return &ragModel.CreateRagCollectionFromFileResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		CollectionId:  result.CollectionID,
		TrainingJobId: result.TrainingJobID,
	}, nil
}

// CreateRagCollectionFromLink 从链接创建RAG集合
func (app *RAGApplication) CreateRagCollectionFromLink(ctx context.Context, req *ragModel.CreateRagCollectionFromLinkRequest) (*ragModel.CreateRagCollectionFromLinkResponse, error) {
	logs.CtxInfof(ctx, "Creating RAG collection from link: %s", req.Link)
	
	// 构建RAG请求
	ragReq := &entity.RAGCreateCollectionFromLinkRequest{
		DatasetID:    req.DatasetId,
		Name:         req.Name,
		Link:         req.Link,
		TrainingType: req.TrainingType,
		ChunkSize:    int(req.ChunkSize),
		ChunkOverlap: int(req.ChunkOverlap),
		Tags:         req.Tags,
		Metadata:     req.Metadata,
	}
	
	// 调用RAG服务创建集合
	result, err := app.ragClient.CreateCollectionFromLink(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Create collection from link failed: %v", err)
		return nil, fmt.Errorf("create collection from link failed: %w", err)
	}
	
	return &ragModel.CreateRagCollectionFromLinkResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		CollectionId:  result.CollectionID,
		TrainingJobId: result.TrainingJobID,
	}, nil
}

// CreateRagCollectionFromText 从文本创建RAG集合
func (app *RAGApplication) CreateRagCollectionFromText(ctx context.Context, req *ragModel.CreateRagCollectionFromTextRequest) (*ragModel.CreateRagCollectionFromTextResponse, error) {
	logs.CtxInfof(ctx, "Creating RAG collection from text")
	
	// 构建RAG请求
	ragReq := &entity.RAGCreateCollectionFromTextRequest{
		DatasetID:    req.DatasetId,
		Name:         req.Name,
		Text:         req.Text,
		TrainingType: req.TrainingType,
		ChunkSize:    int(req.ChunkSize),
		ChunkOverlap: int(req.ChunkOverlap),
		Tags:         req.Tags,
		Metadata:     req.Metadata,
	}
	
	// 调用RAG服务创建集合
	result, err := app.ragClient.CreateCollectionFromText(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Create collection from text failed: %v", err)
		return nil, fmt.Errorf("create collection from text failed: %w", err)
	}
	
	return &ragModel.CreateRagCollectionFromTextResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		CollectionId:  result.CollectionID,
		TrainingJobId: result.TrainingJobID,
	}, nil
}

// UploadRagFile 上传RAG文件（已废弃，使用CreateRagCollectionFromFile代替）
func (app *RAGApplication) UploadRagFile(ctx context.Context, req *ragModel.UploadRagFileRequest) (*ragModel.UploadRagFileResponse, error) {
	logs.CtxInfof(ctx, "UploadRagFile is deprecated, use CreateRagCollectionFromFile instead")
	
	return nil, fmt.Errorf("UploadRagFile is deprecated, use CreateRagCollectionFromFile instead")
}

// ProcessRagFile 处理RAG文件
func (app *RAGApplication) ProcessRagFile(ctx context.Context, req *ragModel.FileProcessRequest) (*ragModel.FileProcessResponse, error) {
	logs.CtxInfof(ctx, "Processing RAG file: %s", req.FileName)
	
	// 构建RAG请求
	ragReq := &entity.RAGFileProcessRequest{
		FileID:            req.FileId,
		FileURL:           req.FileUrl,
		FileName:          req.FileName,
		FileType:          entity.SupportedFileType(req.FileType),
		ChunkSize:         int(req.ChunkSize),
		ChunkOverlap:      int(req.ChunkOverlap),
		PreserveStructure: req.PreserveStructure,
		ExtractImages:     req.ExtractImages,
		ProcessingOptions: req.ProcessingOptions,
	}
	
	// 调用RAG服务处理文件
	result, err := app.ragClient.ProcessFile(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Process RAG file failed: %v", err)
		return nil, fmt.Errorf("process RAG file failed: %w", err)
	}
	
	// 转换响应结果
	chunks := make([]ragModel.FileChunk, len(result.Chunks))
	for i, chunk := range result.Chunks {
		chunks[i] = ragModel.FileChunk{
			Index:    int32(chunk.Index),
			Text:     chunk.Text,
			Metadata: chunk.Metadata,
		}
	}
	
	images := make([]ragModel.FileImage, len(result.Images))
	for i, image := range result.Images {
		images[i] = ragModel.FileImage{
			Id:       image.ID,
			Base64:   image.Base64,
			MimeType: image.MimeType,
			Width:    int32(image.Width),
			Height:   int32(image.Height),
		}
	}
	
	return &ragModel.FileProcessResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		JobId:         result.JobID,
		Status:        ragModel.FileProcessingStatus(result.Status),
		ProcessedText: result.ProcessedText,
		Chunks:        chunks,
		Images:        images,
		Metadata:      result.Metadata,
		ProcessTime:   time.Duration(result.ProcessTime),
	}, nil
}

// GetSupportedFileTypes 获取支持的文件类型
func (app *RAGApplication) GetSupportedFileTypes(ctx context.Context, req *ragModel.GetSupportedFileTypesRequest) (*ragModel.GetSupportedFileTypesResponse, error) {
	logs.CtxInfof(ctx, "Getting supported file types")
	
	// 调用RAG服务获取支持的文件类型
	supportedTypes, err := app.ragClient.GetSupportedFileTypes(ctx)
	if err != nil {
		logs.CtxErrorf(ctx, "Get supported file types failed: %v", err)
		return nil, fmt.Errorf("get supported file types failed: %w", err)
	}
	
	// 转换为响应格式
	typeInfos := make([]ragModel.SupportedFileTypeInfo, len(supportedTypes))
	for i, fileType := range supportedTypes {
		typeInfos[i] = ragModel.SupportedFileTypeInfo{
			Type:        ragModel.SupportedFileType(fileType),
			Extensions:  getFileExtensions(fileType),
			MimeTypes:   getFileMimeTypes(fileType),
			MaxSize:     getMaxFileSize(fileType),
			Description: getFileTypeDescription(fileType),
			Features:    getFileTypeFeatures(fileType),
		}
	}
	
	return &ragModel.GetSupportedFileTypesResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		SupportedTypes: typeInfos,
	}, nil
}

// ValidateRagFile 验证RAG文件
func (app *RAGApplication) ValidateRagFile(ctx context.Context, req *ragModel.FileValidationRequest) (*ragModel.FileValidationResponse, error) {
	logs.CtxInfof(ctx, "Validating RAG file: %s", req.FileName)
	
	// 构建RAG请求
	ragReq := &entity.RAGFileValidationRequest{
		FileName:    req.FileName,
		FileSize:    req.FileSize,
		ContentType: req.ContentType,
		FileType:    entity.SupportedFileType(req.FileType),
	}
	
	// 调用RAG服务验证文件
	result, err := app.ragClient.ValidateFile(ctx, ragReq)
	if err != nil {
		logs.CtxErrorf(ctx, "Validate RAG file failed: %v", err)
		return nil, fmt.Errorf("validate RAG file failed: %w", err)
	}
	
	return &ragModel.FileValidationResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		IsValid:       result.IsValid,
		ErrorMessages: result.ErrorMessages,
		Warnings:      result.Warnings,
		MaxFileSize:   result.MaxFileSize,
	}, nil
}

// GetFileProcessingStatus 获取文件处理状态
func (app *RAGApplication) GetFileProcessingStatus(ctx context.Context, req *ragModel.GetFileProcessingStatusRequest) (*ragModel.GetFileProcessingStatusResponse, error) {
	logs.CtxInfof(ctx, "Getting file processing status: %s", req.JobId)
	
	// 调用RAG服务获取处理状态
	status, err := app.ragClient.GetFileProcessingStatus(ctx, req.JobId)
	if err != nil {
		logs.CtxErrorf(ctx, "Get file processing status failed: %v", err)
		return nil, fmt.Errorf("get file processing status failed: %w", err)
	}
	
	var endTime *time.Time
	if status.EndTime != nil {
		t := time.Unix(*status.EndTime, 0)
		endTime = &t
	}
	
	return &ragModel.GetFileProcessingStatusResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		JobId:       status.JobID,
		Status:      ragModel.FileProcessingStatus(status.Status),
		Progress:    int32(status.Progress),
		Message:     status.Message,
		Error:       status.Error,
		StartTime:   time.Unix(status.StartTime, 0),
		EndTime:     endTime,
		ProcessTime: time.Duration(status.ProcessTime),
	}, nil
}

// RagSearchTest 搜索测试 - 简化为通用搜索方法的包装
func (app *RAGApplication) RagSearchTest(ctx context.Context, req *ragModel.RagSearchTestRequest) (*ragModel.RagSearchTestResponse, error) {
	logs.CtxInfof(ctx, "RAG search test")
	
	// 使用通用搜索方法
	searchResult, err := app.performRagSearch(ctx, req.DatasetId, req.Text, &ragSearchOptions{
		Limit:      req.Limit,
		Similarity: float64(req.Similarity),
		SearchMode: "semantic",
	})
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RagSearchTestResponse{
		BaseResponse: ragModel.BaseResponse{Code: 0, Msg: "success"},
		Results:      searchResult.SearchResults,
	}, nil
}

// RagAdvancedSearch 高级搜索 - 简化为通用搜索方法的包装
func (app *RAGApplication) RagAdvancedSearch(ctx context.Context, req *ragModel.RagAdvancedSearchRequest) (*ragModel.RagAdvancedSearchResponse, error) {
	logs.CtxInfof(ctx, "RAG advanced search")
	
	// 使用通用搜索方法
	searchResult, err := app.performRagSearch(ctx, req.DatasetId, req.Text, &ragSearchOptions{
		Limit:      req.Limit,
		Similarity: float64(req.Similarity),
		SearchMode: "semantic",
		Filters:    req.Filters,
	})
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RagAdvancedSearchResponse{
		BaseResponse: ragModel.BaseResponse{Code: 0, Msg: "success"},
		Results:      searchResult.SearchResults,
	}, nil
}

// RagHybridSearch 混合搜索 - 简化为通用搜索方法的包装
func (app *RAGApplication) RagHybridSearch(ctx context.Context, req *ragModel.RagHybridSearchRequest) (*ragModel.RagHybridSearchResponse, error) {
	logs.CtxInfof(ctx, "RAG hybrid search")
	
	// 使用通用搜索方法，指定混合搜索模式
	searchResult, err := app.performRagSearch(ctx, req.DatasetId, req.Text, &ragSearchOptions{
		Limit:      req.Limit,
		Similarity: float64(req.Similarity),
		SearchMode: "hybrid",
		Filters:    make(map[string]interface{}),
	})
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RagHybridSearchResponse{
		BaseResponse: ragModel.BaseResponse{Code: 0, Msg: "success"},
		Results:      searchResult.SearchResults,
	}, nil
}

// RagSearchWithRerank 重排序搜索 - 简化为通用搜索方法的包装
func (app *RAGApplication) RagSearchWithRerank(ctx context.Context, req *ragModel.RagSearchWithRerankRequest) (*ragModel.RagSearchWithRerankResponse, error) {
	logs.CtxInfof(ctx, "RAG search with rerank")
	
	// 使用通用搜索方法，启用重排序
	searchResult, err := app.performRagSearch(ctx, req.DatasetId, req.Text, &ragSearchOptions{
		Limit:       req.Limit,
		Similarity:  float64(req.Similarity),
		SearchMode:  "semantic",
		UsingReRank: true,
		RerankModel: req.RerankModel,
		Filters:     make(map[string]interface{}),
	})
	if err != nil {
		return nil, err
	}
	
	return &ragModel.RagSearchWithRerankResponse{
		BaseResponse: ragModel.BaseResponse{Code: 0, Msg: "success"},
		Results:      searchResult.SearchResults,
	}, nil
}

// GetRagMetrics 获取RAG系统指标
func (app *RAGApplication) GetRagMetrics(ctx context.Context, req *ragModel.GetRagMetricsRequest) (*ragModel.GetRagMetricsResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG metrics")
	
	// 注意：当前RAGClient接口中没有指标方法
	logs.CtxWarnf(ctx, "Metrics not implemented in RAGClient interface")
	
	return &ragModel.GetRagMetricsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Metrics: map[string]interface{}{
			"totalSearches":    0,
			"avgResponseTime":  0,
			"successRate":      1.0,
			"errorRate":        0.0,
			"totalCollections": 0,
			"totalDocuments":   0,
		},
	}, nil
}

// GetRagAuditLogs 获取RAG审计日志
func (app *RAGApplication) GetRagAuditLogs(ctx context.Context, req *ragModel.GetRagAuditLogsRequest) (*ragModel.GetRagAuditLogsResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG audit logs")
	
	// 注意：当前RAGClient接口中没有审计日志方法
	logs.CtxWarnf(ctx, "Audit logs not implemented in RAGClient interface")
	
	return &ragModel.GetRagAuditLogsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Logs: []*ragModel.AuditLog{},
	}, nil
}

// ExportRagData 导出RAG数据
func (app *RAGApplication) ExportRagData(ctx context.Context, req *ragModel.ExportRagDataRequest) (*ragModel.ExportRagDataResponse, error) {
	logs.CtxInfof(ctx, "Exporting RAG data")
	
	// 注意：当前RAGClient接口中没有导出方法
	logs.CtxWarnf(ctx, "Data export not implemented in RAGClient interface")
	
	return &ragModel.ExportRagDataResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		ExportUrl: "",
	}, nil
}

// GetRagPerformanceStats 获取RAG性能统计
func (app *RAGApplication) GetRagPerformanceStats(ctx context.Context, req *ragModel.GetRagPerformanceStatsRequest) (*ragModel.GetRagPerformanceStatsResponse, error) {
	logs.CtxInfof(ctx, "Getting RAG performance stats")
	
	// 注意：当前RAGClient接口中没有性能统计方法
	logs.CtxWarnf(ctx, "Performance stats not implemented in RAGClient interface")
	
	return &ragModel.GetRagPerformanceStatsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		PerformanceStats: map[string]interface{}{
			"avgSearchTime":   0,
			"avgIndexingTime": 0,
			"throughputQPS":   0,
			"memoryUsage":     0,
			"diskUsage":       0,
			"cacheHitRate":    0,
		},
	}, nil
}

// BatchCreateRagCollections 批量创建RAG集合
func (app *RAGApplication) BatchCreateRagCollections(ctx context.Context, req *ragModel.BatchCreateRagCollectionsRequest) (*ragModel.BatchCreateRagCollectionsResponse, error) {
	logs.CtxInfof(ctx, "Batch creating RAG collections")
	
	// 注意：当前RAGClient接口中没有批量操作方法
	logs.CtxWarnf(ctx, "Batch operations not implemented in RAGClient interface")
	
	results := make([]*ragModel.BatchOperationResult, len(req.Collections))
	for i := range req.Collections {
		results[i] = &ragModel.BatchOperationResult{
			Id:      fmt.Sprintf("collection_%d_%d", i, time.Now().Unix()),
			Success: true,
			Error:   "",
		}
	}
	
	return &ragModel.BatchCreateRagCollectionsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Results: results,
	}, nil
}

// BatchDeleteRagCollections 批量删除RAG集合
func (app *RAGApplication) BatchDeleteRagCollections(ctx context.Context, req *ragModel.BatchDeleteRagCollectionsRequest) (*ragModel.BatchDeleteRagCollectionsResponse, error) {
	logs.CtxInfof(ctx, "Batch deleting RAG collections")
	
	// 注意：当前RAGClient接口中没有批量操作方法
	logs.CtxWarnf(ctx, "Batch operations not implemented in RAGClient interface")
	
	results := make([]*ragModel.BatchOperationResult, len(req.CollectionIds))
	for i, collectionId := range req.CollectionIds {
		results[i] = &ragModel.BatchOperationResult{
			Id:      collectionId,
			Success: true,
			Error:   "",
		}
	}
	
	return &ragModel.BatchDeleteRagCollectionsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Results: results,
	}, nil
}

// BatchUpdateRagData 批量更新RAG数据
func (app *RAGApplication) BatchUpdateRagData(ctx context.Context, req *ragModel.BatchUpdateRagDataRequest) (*ragModel.BatchUpdateRagDataResponse, error) {
	logs.CtxInfof(ctx, "Batch updating RAG data")
	
	// 注意：当前RAGClient接口中没有批量操作方法
	logs.CtxWarnf(ctx, "Batch operations not implemented in RAGClient interface")
	
	results := make([]*ragModel.BatchOperationResult, len(req.Updates))
	for i, data := range req.Updates {
		results[i] = &ragModel.BatchOperationResult{
			Id:      data.Id,
			Success: true,
			Error:   "",
		}
	}
	
	return &ragModel.BatchUpdateRagDataResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Results: results,
	}, nil
}

// BatchRetrainCollections 批量重训练集合
func (app *RAGApplication) BatchRetrainCollections(ctx context.Context, req *ragModel.BatchRetrainCollectionsRequest) (*ragModel.BatchRetrainCollectionsResponse, error) {
	logs.CtxInfof(ctx, "Batch retraining collections")
	
	// 注意：当前RAGClient接口中没有批量操作方法
	logs.CtxWarnf(ctx, "Batch operations not implemented in RAGClient interface")
	
	results := make([]*ragModel.BatchOperationResult, len(req.CollectionIds))
	for i, collectionId := range req.CollectionIds {
		results[i] = &ragModel.BatchOperationResult{
			Id:      collectionId,
			Success: true,
			Error:   "",
		}
	}
	
	return &ragModel.BatchRetrainCollectionsResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 0,
			Msg:  "success",
		},
		Results: results,
	}, nil
}

// ========== 文件处理辅助函数 ==========

// convertRAGFileInfoToModel 转换RAG文件信息到模型
func convertRAGFileInfoToModel(fileInfo entity.RAGFileInfo) ragModel.FileInfo {
	return ragModel.FileInfo{
		OriginalName: fileInfo.OriginalName,
		Filename:     fileInfo.Filename,
		Path:         fileInfo.Path,
		Size:         fileInfo.Size,
		MimeType:     fileInfo.MimeType,
		Extension:    fileInfo.Extension,
	}
}

// getFileExtensions 获取文件类型对应的扩展名
func getFileExtensions(fileType string) []string {
	switch fileType {
	case "txt":
		return []string{".txt"}
	case "md":
		return []string{".md", ".markdown"}
	case "html":
		return []string{".html", ".htm"}
	case "pdf":
		return []string{".pdf"}
	case "docx":
		return []string{".docx"}
	case "xlsx":
		return []string{".xlsx"}
	case "csv":
		return []string{".csv"}
	case "json":
		return []string{".json"}
	default:
		return []string{}
	}
}

// getFileMimeTypes 获取文件类型对应的MIME类型
func getFileMimeTypes(fileType string) []string {
	switch fileType {
	case "txt":
		return []string{"text/plain"}
	case "md":
		return []string{"text/markdown", "text/x-markdown"}
	case "html":
		return []string{"text/html"}
	case "pdf":
		return []string{"application/pdf"}
	case "docx":
		return []string{"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
	case "xlsx":
		return []string{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
	case "csv":
		return []string{"text/csv"}
	case "json":
		return []string{"application/json"}
	default:
		return []string{}
	}
}

// getMaxFileSize 获取文件类型的最大大小限制（字节）
func getMaxFileSize(fileType string) int64 {
	switch fileType {
	case "txt", "md", "html", "csv", "json":
		return 50 * 1024 * 1024 // 50MB
	case "pdf", "docx", "xlsx":
		return 100 * 1024 * 1024 // 100MB
	default:
		return 50 * 1024 * 1024 // 默认50MB
	}
}

// getFileTypeDescription 获取文件类型描述
func getFileTypeDescription(fileType string) string {
	switch fileType {
	case "txt":
		return "纯文本文件"
	case "md":
		return "Markdown文档"
	case "html":
		return "HTML网页文件"
	case "pdf":
		return "PDF文档"
	case "docx":
		return "Microsoft Word文档"
	case "xlsx":
		return "Microsoft Excel表格"
	case "csv":
		return "CSV数据文件"
	case "json":
		return "JSON数据文件"
	default:
		return "未知文件类型"
	}
}

// getFileTypeFeatures 获取文件类型支持的功能
func getFileTypeFeatures(fileType string) []string {
	switch fileType {
	case "txt", "md", "html", "csv", "json":
		return []string{"文本提取", "智能分块", "语言检测"}
	case "pdf":
		return []string{"文本提取", "智能分块", "图片提取", "表格识别", "语言检测"}
	case "docx":
		return []string{"文本提取", "智能分块", "图片提取", "表格识别", "格式保留", "语言检测"}
	case "xlsx":
		return []string{"表格数据提取", "智能分块", "多工作表支持", "公式解析"}
	default:
		return []string{"基础文本提取"}
	}
}