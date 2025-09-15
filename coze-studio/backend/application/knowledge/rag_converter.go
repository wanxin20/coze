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
	"fmt"
	"time"

	ragModel "github.com/coze-dev/coze-studio/backend/api/model/data/knowledge/rag"
	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
)

// RAGConverter RAG数据转换器
type RAGConverter struct{}

// NewRAGConverter 创建RAG转换器
func NewRAGConverter() *RAGConverter {
	return &RAGConverter{}
}

// ========== 知识库转换 ==========

// ToKnowledgeBaseModel 转换知识库实体到API模型
func (c *RAGConverter) ToKnowledgeBaseModel(kb *entity.RAGKnowledgeBase) *ragModel.KnowledgeBase {
	if kb == nil {
		return nil
	}
	
	return &ragModel.KnowledgeBase{
		Id:          kb.ID,
		Name:        kb.Name,
		Intro:       kb.Description,
		Type:        kb.Type,
		VectorModel: kb.VectorModel,
		AgentModel:  kb.AgentModel,
		CreateTime:  time.Unix(kb.CreatedAt, 0),
		UpdateTime:  time.Unix(kb.UpdatedAt, 0),
		FileCount:   kb.FileCount,
		DataCount:   kb.DataCount,
	}
}

// FromKnowledgeBaseCreateRequest 从创建请求转换到知识库实体
func (c *RAGConverter) FromKnowledgeBaseCreateRequest(req *ragModel.CreateKnowledgeBaseRequest) *entity.RAGKnowledgeBase {
	if req == nil {
		return nil
	}
	
	now := time.Now().Unix()
	return &entity.RAGKnowledgeBase{
		Name:        req.Name,
		Description: req.Intro,
		TeamID:      req.TeamId,
		Type:        req.Type,
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		Status:      "active",
		FileCount:   0, // 初始值
		DataCount:   0, // 初始值
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// FromKnowledgeBaseUpdateRequest 从更新请求转换到知识库实体
func (c *RAGConverter) FromKnowledgeBaseUpdateRequest(req *ragModel.UpdateKnowledgeBaseRequest, existing *entity.RAGKnowledgeBase) *entity.RAGKnowledgeBase {
	if req == nil || existing == nil {
		return existing
	}
	
	return &entity.RAGKnowledgeBase{
		ID:          req.Id,
		Name:        req.Name,
		Description: req.Intro,
		TeamID:      existing.TeamID,
		Type:        existing.Type, // 保持原有类型
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		Status:      existing.Status,
		FileCount:   existing.FileCount,
		DataCount:   existing.DataCount,
		CreatedAt:   existing.CreatedAt,
		UpdatedAt:   time.Now().Unix(),
	}
}

// ========== 数据集转换 ==========

// ToDatasetModel 转换数据集实体到API模型
func (c *RAGConverter) ToDatasetModel(dataset *entity.RAGDataset) *ragModel.RagDataset {
	if dataset == nil {
		return nil
	}
	
	return &ragModel.RagDataset{
		Id:          dataset.ID,
		Name:        dataset.Name,
		Description: dataset.Description,
		VectorModel: dataset.VectorModel,
		AgentModel:  dataset.AgentModel,
		CreateTime:  time.Unix(dataset.CreatedAt, 0),
		UpdateTime:  time.Unix(dataset.UpdatedAt, 0),
	}
}

// FromDatasetCreateRequest 从创建请求转换到数据集实体
func (c *RAGConverter) FromDatasetCreateRequest(req *ragModel.CreateRagDatasetRequest) *entity.RAGDataset {
	if req == nil {
		return nil
	}
	
	now := time.Now().Unix()
	return &entity.RAGDataset{
		Name:        req.Name,
		Description: req.Description,
		Type:        "default", // 默认类型
		Status:      "active",  // 默认状态
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// FromDatasetUpdateRequest 从更新请求转换到数据集实体
func (c *RAGConverter) FromDatasetUpdateRequest(req *ragModel.UpdateRagDatasetRequest, existing *entity.RAGDataset) *entity.RAGDataset {
	if req == nil || existing == nil {
		return existing
	}
	
	return &entity.RAGDataset{
		ID:          req.Id,
		Name:        req.Name,
		Description: req.Description,
		Type:        existing.Type,
		Status:      existing.Status,
		VectorModel: req.VectorModel,
		AgentModel:  req.AgentModel,
		TeamID:      existing.TeamID,
		UserID:      existing.UserID,
		FileCount:   existing.FileCount,
		DataCount:   existing.DataCount,
		ParentID:    existing.ParentID,
		CreatedAt:   existing.CreatedAt,
		UpdatedAt:   time.Now().Unix(),
	}
}

// ========== 集合转换 ==========

// ToCollectionModel 转换集合实体到API模型
func (c *RAGConverter) ToCollectionModel(collection *entity.RAGCollection) *ragModel.RagCollection {
	if collection == nil {
		return nil
	}
	
	return &ragModel.RagCollection{
		Id:            collection.ID,
		DatasetId:     collection.DatasetID,
		ParentId:      collection.ParentID,
		Type:          collection.Type,
		Name:          collection.Name,
		Tags:          collection.Tags,
		CreateTime:    ParseTimeString(collection.CreateTime),
		UpdateTime:    ParseTimeString(collection.UpdateTime),
		FileId:        collection.FileID,
		FileUrl:       collection.FileURL,
		RawText:       collection.RawText,
		RawLink:       collection.RawLink,
		ChunkSize:     int32(collection.ChunkSize),
		ChunkSplitter: collection.ChunkSplitter,
		TrainingType:  collection.TrainingType,
		Status:        collection.Status,
	}
}

// FromCollectionCreateRequest 从创建请求转换到集合实体
func (c *RAGConverter) FromCollectionCreateRequest(req *ragModel.CreateRagCollectionRequest) *entity.RAGCreateCollectionRequest {
	if req == nil {
		return nil
	}
	
	return &entity.RAGCreateCollectionRequest{
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
		Metadata:      convertToInterfaceMap(req.Metadata),
	}
}

// FromCollectionUpdateRequest 从更新请求转换到集合更新实体
func (c *RAGConverter) FromCollectionUpdateRequest(req *ragModel.UpdateRagCollectionRequest) *entity.RAGUpdateCollectionRequest {
	if req == nil {
		return nil
	}
	
	return &entity.RAGUpdateCollectionRequest{
		Name:          req.Name,
		Tags:          req.Tags,
		ChunkSize:     int(req.ChunkSize),
		ChunkSplitter: req.ChunkSplitter,
		TrainingType:  req.TrainingType,
		Metadata:      convertToInterfaceMap(req.Metadata),
	}
}

// ========== 数据转换 ==========

// ToDataModel 转换数据实体到API模型
func (c *RAGConverter) ToDataModel(data *entity.RAGData) *ragModel.RagData {
	if data == nil {
		return nil
	}
	
	// 转换索引数据
	indexes := make([]*ragModel.RagDataIndex, len(data.Indexes))
	for i, idx := range data.Indexes {
		indexes[i] = &ragModel.RagDataIndex{
			Type:   idx.Type,
			DataId: idx.DataID,
			Text:   idx.Text,
		}
	}
	
	return &ragModel.RagData{
		Id:           data.ID,
		CollectionId: data.CollectionID,
		Q:            data.Q,
		A:            data.A,
		ChunkIndex:   int32(data.ChunkIndex),
		Indexes:      indexes,
		CreateTime:   time.Unix(data.CreateTime, 0),
		UpdateTime:   time.Unix(data.UpdateTime, 0),
	}
}

// FromDataInsertRequest 从插入请求转换到数据插入实体
func (c *RAGConverter) FromDataInsertRequest(req *ragModel.InsertRagDataRequest) *entity.RAGInsertDataRequest {
	if req == nil {
		return nil
	}
	
	return &entity.RAGInsertDataRequest{
		CollectionID: req.CollectionId,
		Q:            req.Q,
		A:            req.A,
		ChunkIndex:   int(req.ChunkIndex),
	}
}

// FromDataUpdateRequest 从更新请求转换到数据更新实体
func (c *RAGConverter) FromDataUpdateRequest(req *ragModel.UpdateRagDataRequest) *entity.RAGUpdateDataRequest {
	if req == nil {
		return nil
	}
	
	// 转换索引数据
	indexes := make([]entity.RAGDataIndex, len(req.Indexes))
	for i, idx := range req.Indexes {
		indexes[i] = entity.RAGDataIndex{
			Type:   idx.Type,
			DataID: idx.DataId,
			Text:   idx.Text,
		}
	}
	
	return &entity.RAGUpdateDataRequest{
		Q:       req.Q,
		A:       req.A,
		Indexes: indexes,
	}
}

// ========== 搜索转换 ==========

// FromSearchRequest 从搜索请求转换到RAG搜索实体
func (c *RAGConverter) FromSearchRequest(req *ragModel.RagSearchRequest) *entity.RAGSearchRequest {
	if req == nil {
		return nil
	}
	
	return &entity.RAGSearchRequest{
		KnowledgeBaseID: convertInt64ToString(req.DatasetId),
		Query:           req.Text,
		TopK:            int(req.Limit),
		ScoreThreshold:  req.Similarity,
		SearchMode:      req.SearchMode,
		UsingReRank:     req.UsingReRank,
		RerankModel:     req.RerankModel,
		DatasetIDs:      req.CollectionIds,
		Filters:         convertFiltersToStringMap(req.Filters),
	}
}

// ToSearchResponse 转换搜索结果到API响应
func (c *RAGConverter) ToSearchResponse(result *entity.RAGSearchResponse) *ragModel.RagSearchResponse {
	if result == nil {
		return nil
	}
	
	// 转换搜索结果
	searchItems := make([]*ragModel.RagSearchItem, len(result.Results))
	for i, item := range result.Results {
		searchItems[i] = &ragModel.RagSearchItem{
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
	
	return &ragModel.RagSearchResponse{
		BaseResponse: ragModel.BaseResponse{
			Code: 200,
			Msg:  "Success",
		},
		SearchResults:     searchItems,
		Total:             int32(result.TotalCount),
		SearchMode:        result.SearchMode,
		EmbeddingTokens:   getUsageStatsEmbeddingTokens(result.UsageStats),
		RerankInputTokens: getUsageStatsRerankTokens(result.UsageStats),
		Duration:          formatDuration(result.ExecutionTime),
	}
}

// ========== 辅助函数 ==========

// convertInt64ToString 转换int64到字符串
func convertInt64ToString(value int64) string {
	return fmt.Sprintf("%d", value)
}

// formatDuration 格式化执行时间
func formatDuration(milliseconds int64) string {
	return fmt.Sprintf("%dms", milliseconds)
}

// 辅助函数已在 rag_application.go 中定义，避免重复声明
