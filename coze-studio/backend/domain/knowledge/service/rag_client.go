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

	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
)

// RAGClient FastGPT RAG微服务客户端接口
// 作为独立的微服务，专注于RAG知识库的管理和搜索
// 注意：在FastGPTRAG中，dataset是顶级概念（知识库），collection是dataset下的数据组织单位
type RAGClient interface {
	// Dataset Management (FastGPT的dataset，即知识库的顶级概念)
	CreateDataset(ctx context.Context, dataset *entity.RAGDataset) error
	GetDataset(ctx context.Context, datasetID string) (*entity.RAGDataset, error)
	UpdateDataset(ctx context.Context, dataset *entity.RAGDataset) error
	DeleteDataset(ctx context.Context, datasetID string) error
	ListDatasets(ctx context.Context, teamID string) ([]*entity.RAGDataset, error)
	ListKnowledgeBases(ctx context.Context, teamID string) ([]*entity.RAGKnowledgeBase, error) // 兼容方法

	// Collection Management (集合管理)
	CreateCollection(ctx context.Context, req *entity.RAGCreateCollectionRequest) (*entity.RAGCollection, error)
	GetCollection(ctx context.Context, collectionID string) (*entity.RAGCollection, error)
	UpdateCollection(ctx context.Context, collectionID string, updates *entity.RAGUpdateCollectionRequest) (*entity.RAGCollection, error)
	DeleteCollection(ctx context.Context, collectionID string) error
	ListCollections(ctx context.Context, req *entity.RAGListCollectionsRequest) (*entity.RAGListCollectionsResponse, error)
	SyncCollection(ctx context.Context, collectionID string) (*entity.RAGSyncCollectionResponse, error)
	RetrainCollection(ctx context.Context, collectionID string) (*entity.RAGRetrainCollectionResponse, error)
	GetCollectionTrainingDetail(ctx context.Context, collectionID string) (*entity.RAGCollectionTrainingDetail, error)
	ExportCollection(ctx context.Context, collectionID string) (*entity.RAGExportCollectionResponse, error)
	CreateCollectionFromFile(ctx context.Context, req *entity.RAGCreateCollectionFromFileRequest) (*entity.RAGCreateCollectionFromFileResponse, error)
	CreateCollectionFromLink(ctx context.Context, req *entity.RAGCreateCollectionFromLinkRequest) (*entity.RAGCreateCollectionFromLinkResponse, error)
	CreateCollectionFromText(ctx context.Context, req *entity.RAGCreateCollectionFromTextRequest) (*entity.RAGCreateCollectionFromTextResponse, error)

	// Data Management (数据管理)
	InsertData(ctx context.Context, req *entity.RAGInsertDataRequest) (*entity.RAGInsertDataResponse, error)
	PushDataBatch(ctx context.Context, req *entity.RAGPushDataBatchRequest) (*entity.RAGPushDataBatchResponse, error)
	GetDataList(ctx context.Context, req *entity.RAGGetDataListRequest) (*entity.RAGGetDataListResponse, error)
	GetDataById(ctx context.Context, dataID string) (*entity.RAGData, error)
	UpdateData(ctx context.Context, dataID string, updates *entity.RAGUpdateDataRequest) (*entity.RAGData, error)
	DeleteData(ctx context.Context, dataID string) error
	BatchUpdateData(ctx context.Context, req *entity.RAGBatchUpdateDataRequest) (*entity.RAGBatchUpdateDataResponse, error)

	// File Upload and Processing
	UploadFile(ctx context.Context, req *entity.RAGFileUploadRequest) (*entity.RAGFileUploadResponse, error)
	ProcessFile(ctx context.Context, req *entity.RAGFileProcessRequest) (*entity.RAGFileProcessResponse, error)
	AddTextData(ctx context.Context, kbID string, req *entity.RAGTextDataRequest) error
	
	// File Processing Support
	GetSupportedFileTypes(ctx context.Context) ([]string, error)
	ValidateFile(ctx context.Context, req *entity.RAGFileValidationRequest) (*entity.RAGFileValidationResponse, error)
	GetFileProcessingStatus(ctx context.Context, jobID string) (*entity.RAGFileProcessingStatus, error)

	// Search Operations (在dataset级别进行搜索，对应FastGPT的dataset搜索)
	SearchDataset(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error)
	SearchKnowledgeBase(ctx context.Context, req *entity.RAGSearchRequest) (*entity.RAGSearchResponse, error) // 兼容方法
	DeepSearch(ctx context.Context, req *entity.RAGDeepSearchRequest) (*entity.RAGDeepSearchResponse, error)

	// Training and Processing (训练特定的dataset或collection)
	StartTraining(ctx context.Context, targetID string) (*entity.RAGTrainingJob, error) // targetID可以是datasetID或collectionID
	GetTrainingStatus(ctx context.Context, jobID string) (*entity.RAGTrainingJob, error)

	// Health and Monitoring
	GetHealth(ctx context.Context) (*entity.RAGHealthStatus, error)
	GetUsageStats(ctx context.Context, teamID string) (*entity.RAGUsageStats, error)
}

// 移除RAGSyncService - 采用直接API调用模式
// Coze通过知识库ID直接调用RAG，无需复杂的数据同步

// RAGWorkflowService RAG工作流服务接口
// 简化的工作流集成，基于知识库ID直接调用RAG
type RAGWorkflowService interface {
	// RAG搜索节点 - 在工作流中执行知识库搜索
	ExecuteRAGSearchNode(ctx context.Context, req *entity.RAGWorkflowSearchRequest) (*entity.RAGWorkflowSearchResponse, error)
	
	// RAG深度搜索节点 - 多轮迭代搜索
	ExecuteRAGDeepSearchNode(ctx context.Context, req *entity.RAGWorkflowDeepSearchRequest) (*entity.RAGWorkflowDeepSearchResponse, error)
	
	// 获取团队可用的RAG知识库列表 - 用于工作流节点配置
	GetAvailableKnowledgeBasesForWorkflow(ctx context.Context, teamID string) ([]*entity.RAGWorkflowKnowledgeBase, error)
	
	// 验证知识库可用性 - 用于工作流节点验证
	ValidateKnowledgeBaseAccess(ctx context.Context, kbID string, teamID string) (*entity.RAGValidationResult, error)
}

// RAGOrchestrationService RAG编排服务接口
// 用于在工作流中编排RAG操作
type RAGOrchestrationService interface {
	// 执行RAG搜索
	ExecuteRAGSearch(ctx context.Context, req *entity.RAGOrchestrationRequest) (*entity.RAGOrchestrationResponse, error)
	
	// 执行RAG深度搜索
	ExecuteRAGDeepSearch(ctx context.Context, req *entity.RAGDeepSearchOrchestrationRequest) (*entity.RAGDeepSearchOrchestrationResponse, error)
	
	// 获取可用知识库
	GetAvailableKnowledgeBases(ctx context.Context, teamID string) ([]*entity.RAGKnowledgeBase, error)
}
