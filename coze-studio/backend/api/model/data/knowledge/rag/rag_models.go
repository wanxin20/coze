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

import "time"

// ========== 基础响应结构 ==========

// BaseResponse 基础响应结构
type BaseResponse struct {
	Code int32  `json:"code"`
	Msg  string `json:"msg"`
}

// ========== 知识库基础管理模型 (FastGPT兼容) ==========

// KnowledgeBase 知识库模型
type KnowledgeBase struct {
	Id          string    `json:"id"`
	Name        string    `json:"name"`
	Intro       string    `json:"intro"`
	Type        string    `json:"type"`
	VectorModel string    `json:"vectorModel"`
	AgentModel  string    `json:"agentModel"`
	CreateTime  time.Time `json:"createTime"`
	UpdateTime  time.Time `json:"updateTime"`
	FileCount   int32     `json:"fileCount"`
	DataCount   int32     `json:"dataCount"`
}

// GetKnowledgeBasesRequest 获取知识库列表请求
type GetKnowledgeBasesRequest struct {
	TeamId    string `json:"teamId" query:"teamId"`
	Type      string `json:"type" query:"type"`
	SearchKey string `json:"searchKey" query:"searchKey"`
	ParentId  string `json:"parentId" query:"parentId"`
	Current   int32  `json:"current" query:"current"`
	PageSize  int32  `json:"pageSize" query:"pageSize"`
}

// GetKnowledgeBasesResponse 获取知识库列表响应
type GetKnowledgeBasesResponse struct {
	BaseResponse
	List  []*KnowledgeBase `json:"list"`
	Total int32            `json:"total"`
}

// CreateKnowledgeBaseRequest 创建知识库请求
type CreateKnowledgeBaseRequest struct {
	Name        string `json:"name"`
	Intro       string `json:"intro"`
	Type        string `json:"type"`
	TeamId      string `json:"teamId"`
	UserId      string `json:"userId"`
	VectorModel string `json:"vectorModel"`
	AgentModel  string `json:"agentModel"`
	ParentId    string `json:"parentId"`
}

// CreateKnowledgeBaseResponse 创建知识库响应
type CreateKnowledgeBaseResponse struct {
	BaseResponse
	Id string `json:"id"`
}

// GetKnowledgeBaseByIdRequest 获取知识库详情请求
type GetKnowledgeBaseByIdRequest struct {
	Id string `json:"id" path:"id"`
}

// GetKnowledgeBaseByIdResponse 获取知识库详情响应
type GetKnowledgeBaseByIdResponse struct {
	BaseResponse
	KnowledgeBase *KnowledgeBase `json:"knowledgeBase"`
}

// UpdateKnowledgeBaseRequest 更新知识库请求
type UpdateKnowledgeBaseRequest struct {
	Id          string `json:"id" path:"id"`
	Name        string `json:"name"`
	Intro       string `json:"intro"`
	VectorModel string `json:"vectorModel"`
	AgentModel  string `json:"agentModel"`
}

// UpdateKnowledgeBaseResponse 更新知识库响应
type UpdateKnowledgeBaseResponse struct {
	BaseResponse
	KnowledgeBase *KnowledgeBase `json:"knowledgeBase"`
}

// DeleteKnowledgeBaseRequest 删除知识库请求
type DeleteKnowledgeBaseRequest struct {
	Id string `json:"id" path:"id"`
}

// DeleteKnowledgeBaseResponse 删除知识库响应
type DeleteKnowledgeBaseResponse struct {
	BaseResponse
}

// KnowledgeBaseSearchResult 知识库搜索结果
type KnowledgeBaseSearchResult struct {
	Id             string                 `json:"id"`
	Content        string                 `json:"content"`
	Score          float64                `json:"score"`
	CollectionId   string                 `json:"collectionId"`
	CollectionName string                 `json:"collectionName"`
	Metadata       map[string]interface{} `json:"metadata"`
	SourceName     string                 `json:"sourceName"`
	ChunkIndex     int32                  `json:"chunkIndex"`
}

// SearchTestKnowledgeBaseRequest 知识库搜索测试请求
type SearchTestKnowledgeBaseRequest struct {
	DatasetId                        string                 `json:"datasetId"`
	Text                             string                 `json:"text"`
	Limit                            int32                  `json:"limit"`
	Similarity                       float64                `json:"similarity"`
	SearchMode                       string                 `json:"searchMode"`
	UsingReRank                      bool                   `json:"usingReRank"`
	RerankModel                      string                 `json:"rerankModel"`
	DatasetSearchUsingExtensionQuery bool                   `json:"datasetSearchUsingExtensionQuery"`
	DatasetSearchExtensionModel      string                 `json:"datasetSearchExtensionModel"`
	CollectionIds                    []string               `json:"collectionIds"`
	Filters                          map[string]interface{} `json:"filters"`
}

// SearchTestKnowledgeBaseResponse 知识库搜索测试响应
type SearchTestKnowledgeBaseResponse struct {
	BaseResponse
	List                             []*KnowledgeBaseSearchResult `json:"list"`
	Total                            int32                        `json:"total"`
	SearchMode                       string                       `json:"searchMode"`
	Limit                            int32                        `json:"limit"`
	Similarity                       float64                      `json:"similarity"`
	UsingReRank                      bool                         `json:"usingReRank"`
	EmbeddingTokens                  int32                        `json:"embeddingTokens"`
	ReRankInputTokens                int32                        `json:"reRankInputTokens"`
	Duration                         string                       `json:"duration"`
	QueryExtensionResult             string                       `json:"queryExtensionResult"`
	DatasetSearchUsingExtensionQuery bool                         `json:"datasetSearchUsingExtensionQuery"`
}

// ========== RAG 搜索模型 ==========

// RagSearchItem RAG搜索项
type RagSearchItem struct {
	Id             string                 `json:"id"`
	Content        string                 `json:"content"`
	Score          float64                `json:"score"`
	CollectionId   string                 `json:"collectionId"`
	CollectionName string                 `json:"collectionName"`
	Metadata       map[string]interface{} `json:"metadata"`
	SourceName     string                 `json:"sourceName"`
	ChunkIndex     int32                  `json:"chunkIndex"`
}

// RagSearchRequest RAG搜索请求
type RagSearchRequest struct {
	DatasetId                        int64                  `json:"datasetId"`
	Text                             string                 `json:"text"`
	Limit                            int32                  `json:"limit"`
	Similarity                       float64                `json:"similarity"`
	SearchMode                       string                 `json:"searchMode"`
	UsingReRank                      bool                   `json:"usingReRank"`
	RerankModel                      string                 `json:"rerankModel"`
	DatasetSearchUsingExtensionQuery bool                   `json:"datasetSearchUsingExtensionQuery"`
	DatasetSearchExtensionModel      string                 `json:"datasetSearchExtensionModel"`
	CollectionIds                    []string               `json:"collectionIds"`
	Filters                          map[string]interface{} `json:"filters"`
}

// RagSearchResponse RAG搜索响应
type RagSearchResponse struct {
	BaseResponse
	SearchResults        []*RagSearchItem `json:"searchResults"`
	Total                int32            `json:"total"`
	SearchMode           string           `json:"searchMode"`
	EmbeddingTokens      int32            `json:"embeddingTokens"`
	RerankInputTokens    int32            `json:"rerankInputTokens"`
	Duration             string           `json:"duration"`
	QueryExtensionResult string           `json:"queryExtensionResult"`
	DeepSearchResult     string           `json:"deepSearchResult"`
}

// DeepSearchIteration 深度搜索迭代
type DeepSearchIteration struct {
	IterationIndex   int32            `json:"iterationIndex"`
	ExpandedQuery    string           `json:"expandedQuery"`
	IterationResults []*RagSearchItem `json:"iterationResults"`
	TokensUsed       int32            `json:"tokensUsed"`
}

// DeepSearchRequest 深度搜索请求
type DeepSearchRequest struct {
	DatasetId     int64   `json:"datasetId"`
	Text          string  `json:"text"`
	MaxIterations int32   `json:"maxIterations"`
	Model         string  `json:"model"`
	Limit         int32   `json:"limit"`
	Similarity    float64 `json:"similarity"`
}

// DeepSearchResponse 深度搜索响应
type DeepSearchResponse struct {
	BaseResponse
	FinalResults []*RagSearchItem       `json:"finalResults"`
	Iterations   []*DeepSearchIteration `json:"iterations"`
	TotalTokens  int32                  `json:"totalTokens"`
	Duration     string                 `json:"duration"`
}

// ========== 数据集管理模型 ==========

// CreateRagDatasetRequest 创建RAG数据集请求
type CreateRagDatasetRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	TeamId      string `json:"teamId"`
	UserId      string `json:"userId"`
	VectorModel string `json:"vectorModel"`
	AgentModel  string `json:"agentModel"`
}

// CreateRagDatasetResponse 创建RAG数据集响应
type CreateRagDatasetResponse struct {
	BaseResponse
	DatasetId string `json:"datasetId"`
}

// GetRagDatasetsRequest 获取RAG数据集列表请求
type GetRagDatasetsRequest struct {
	TeamId   string `json:"teamId" query:"teamId"`
	Current  int32  `json:"current" query:"current"`
	PageSize int32  `json:"pageSize" query:"pageSize"`
}

// GetRagDatasetsResponse 获取RAG数据集列表响应
type GetRagDatasetsResponse struct {
	BaseResponse
	List  []*RagDataset `json:"list"`
	Total int32         `json:"total"`
}

// RagDataset RAG数据集
type RagDataset struct {
	Id          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	VectorModel string    `json:"vectorModel"`
	AgentModel  string    `json:"agentModel"`
	CreateTime  time.Time `json:"createTime"`
	UpdateTime  time.Time `json:"updateTime"`
}

// GetRagDatasetByIdRequest 获取RAG数据集详情请求
type GetRagDatasetByIdRequest struct {
	Id string `json:"id" path:"id"`
}

// GetRagDatasetByIdResponse 获取RAG数据集详情响应
type GetRagDatasetByIdResponse struct {
	BaseResponse
	Dataset *RagDataset `json:"dataset"`
}

// UpdateRagDatasetRequest 更新RAG数据集请求
type UpdateRagDatasetRequest struct {
	Id          string `json:"id" path:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	VectorModel string `json:"vectorModel"`
	AgentModel  string `json:"agentModel"`
}

// UpdateRagDatasetResponse 更新RAG数据集响应
type UpdateRagDatasetResponse struct {
	BaseResponse
	Dataset *RagDataset `json:"dataset"`
}

// DeleteRagDatasetRequest 删除RAG数据集请求
type DeleteRagDatasetRequest struct {
	Id string `json:"id" path:"id"`
}

// DeleteRagDatasetResponse 删除RAG数据集响应
type DeleteRagDatasetResponse struct {
	BaseResponse
}

// RetrainRagDatasetRequest 重训练RAG数据集请求
type RetrainRagDatasetRequest struct {
	DatasetId string `json:"datasetId"`
}

// RetrainRagDatasetResponse 重训练RAG数据集响应
type RetrainRagDatasetResponse struct {
	BaseResponse
	TrainingJobId string `json:"trainingJobId"`
}

// SyncDatasetToRagRequest 同步数据集到RAG请求
type SyncDatasetToRagRequest struct {
	CozeDatasetId string `json:"cozeDatasetId"`
	RagDatasetId  string `json:"ragDatasetId"`
	ForceSync     bool   `json:"forceSync"`
}

// SyncDatasetToRagResponse 同步数据集到RAG响应
type SyncDatasetToRagResponse struct {
	BaseResponse
	SyncJobId       string `json:"syncJobId"`
	SyncedDocuments int32  `json:"syncedDocuments"`
}

// ========== 集合管理模型 ==========

// RagCollection RAG集合
type RagCollection struct {
	Id            string                 `json:"id"`
	DatasetId     string                 `json:"datasetId"`
	ParentId      string                 `json:"parentId,omitempty"`
	Name          string                 `json:"name"`
	Type          string                 `json:"type"`
	Tags          []string               `json:"tags,omitempty"`
	FileId        string                 `json:"fileId,omitempty"`
	FileUrl       string                 `json:"fileUrl,omitempty"`
	RawText       string                 `json:"rawText,omitempty"`
	RawLink       string                 `json:"rawLink,omitempty"`
	TrainingType  string                 `json:"trainingType"`
	ChunkSize     int32                  `json:"chunkSize"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	Status        string                 `json:"status,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreateTime    time.Time              `json:"createTime"`
	UpdateTime    time.Time              `json:"updateTime"`
}

// CreateRagCollectionRequest 创建RAG集合请求
type CreateRagCollectionRequest struct {
	DatasetId      string                 `json:"datasetId"`
	ParentId       string                 `json:"parentId,omitempty"`
	Name           string                 `json:"name"`
	CollectionType string                 `json:"collectionType"`
	Tags           []string               `json:"tags,omitempty"`
	FileUrl        string                 `json:"fileUrl,omitempty"`
	RawText        string                 `json:"rawText,omitempty"`
	TrainingType   string                 `json:"trainingType"`
	ChunkSize      int32                  `json:"chunkSize"`
	ChunkSplitter  string                 `json:"chunkSplitter,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// CreateRagCollectionResponse 创建RAG集合响应
type CreateRagCollectionResponse struct {
	BaseResponse
	CollectionId  string `json:"collectionId"`
	TrainingJobId string `json:"trainingJobId"`
}

// GetRagCollectionsRequest 获取RAG集合列表请求
type GetRagCollectionsRequest struct {
	DatasetId string `json:"datasetId" query:"datasetId"`
	ParentId  string `json:"parentId,omitempty" query:"parentId"`
	Type      string `json:"type,omitempty" query:"type"`
	SearchKey string `json:"searchKey,omitempty" query:"searchKey"`
	Current   int32  `json:"current" query:"current"`
	PageSize  int32  `json:"pageSize" query:"pageSize"`
}

// GetRagCollectionsResponse 获取RAG集合列表响应
type GetRagCollectionsResponse struct {
	BaseResponse
	List  []*RagCollection `json:"list"`
	Total int32            `json:"total"`
}

// GetRagCollectionByIdRequest 获取RAG集合详情请求
type GetRagCollectionByIdRequest struct {
	Id string `json:"id" path:"id"`
}

// GetRagCollectionByIdResponse 获取RAG集合详情响应
type GetRagCollectionByIdResponse struct {
	BaseResponse
	Collection *RagCollection `json:"collection"`
}

// UpdateRagCollectionRequest 更新RAG集合请求
type UpdateRagCollectionRequest struct {
	Id            string                 `json:"id" path:"id"`
	Name          string                 `json:"name"`
	Tags          []string               `json:"tags,omitempty"`
	TrainingType  string                 `json:"trainingType"`
	ChunkSize     int32                  `json:"chunkSize"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateRagCollectionResponse 更新RAG集合响应
type UpdateRagCollectionResponse struct {
	BaseResponse
	Collection *RagCollection `json:"collection"`
}

// DeleteRagCollectionRequest 删除RAG集合请求
type DeleteRagCollectionRequest struct {
	Id string `json:"id" path:"id"`
}

// DeleteRagCollectionResponse 删除RAG集合响应
type DeleteRagCollectionResponse struct {
	BaseResponse
}

// SyncRagCollectionRequest 同步RAG集合请求
type SyncRagCollectionRequest struct {
	Id string `json:"id" path:"id"`
}

// SyncRagCollectionResponse 同步RAG集合响应
type SyncRagCollectionResponse struct {
	BaseResponse
	SyncJobId       string `json:"syncJobId,omitempty"`
	SyncedDocuments int32  `json:"syncedDocuments,omitempty"`
	Status          string `json:"status,omitempty"`
}

// RetrainRagCollectionRequest 重训练RAG集合请求
type RetrainRagCollectionRequest struct {
	Id string `json:"id" path:"id"`
}

// RetrainRagCollectionResponse 重训练RAG集合响应
type RetrainRagCollectionResponse struct {
	BaseResponse
	TrainingJobId string `json:"trainingJobId"`
}

// GetRagCollectionTrainingDetailRequest 获取RAG集合训练详情请求
type GetRagCollectionTrainingDetailRequest struct {
	Id string `json:"id" path:"id"`
}

// GetRagCollectionTrainingDetailResponse 获取RAG集合训练详情响应
type GetRagCollectionTrainingDetailResponse struct {
	BaseResponse
	TrainingDetail *TrainingDetail `json:"trainingDetail"`
}

// TrainingDetail 训练详情
type TrainingDetail struct {
	Status          string    `json:"status"`
	Progress        int32     `json:"progress"`
	ProcessedChunks int32     `json:"processedChunks"`
	TotalChunks     int32     `json:"totalChunks"`
	ErrorMessage    string    `json:"errorMessage,omitempty"`
	StartTime       time.Time `json:"startTime,omitempty"`
	EndTime         time.Time `json:"endTime,omitempty"`
}

// ExportRagCollectionRequest 导出RAG集合请求
type ExportRagCollectionRequest struct {
	Id string `json:"id" path:"id"`
}

// ExportRagCollectionResponse 导出RAG集合响应
type ExportRagCollectionResponse struct {
	BaseResponse
	ExportData interface{} `json:"exportData"`
	ExportUrl  string      `json:"exportUrl,omitempty"`
	Format     string      `json:"format,omitempty"`
	FileSize   int64       `json:"fileSize,omitempty"`
}

// ========== 数据管理模型 ==========

// InsertRagDataRequest 插入RAG数据请求
type InsertRagDataRequest struct {
	CollectionId string `json:"collectionId"`
	Q            string `json:"q"`
	A            string `json:"a"`
	ChunkIndex   int32  `json:"chunkIndex"`
}

// InsertRagDataResponse 插入RAG数据响应
type InsertRagDataResponse struct {
	BaseResponse
	DataId string `json:"dataId"`
}

// PushRagDataBatchRequest 批量推送RAG数据请求
type PushRagDataBatchRequest struct {
	CollectionId string         `json:"collectionId"`
	Data         []*RagDataItem `json:"data"`
	Mode         string         `json:"mode"`
}

// RagDataItem RAG数据项
type RagDataItem struct {
	Q          string           `json:"q"`
	A          string           `json:"a"`
	ChunkIndex int32            `json:"chunkIndex"`
	Indexes    []*RagDataIndex  `json:"indexes,omitempty"`
}

// RagDataIndex RAG数据索引
type RagDataIndex struct {
	Type   string `json:"type"`
	DataId string `json:"dataId"`
	Text   string `json:"text"`
}

// PushRagDataBatchResponse 批量推送RAG数据响应
type PushRagDataBatchResponse struct {
	BaseResponse
	InsertedCount int32  `json:"insertedCount"`
	TrainingId    string `json:"trainingId,omitempty"`
}

// GetRagDataListRequest 获取RAG数据列表请求
type GetRagDataListRequest struct {
	CollectionId string `json:"collectionId" query:"collectionId"`
	DatasetId    string `json:"datasetId,omitempty" query:"datasetId"`
	SearchText   string `json:"searchText,omitempty" query:"searchText"`
	Current      int32  `json:"current" query:"current"`
	PageSize     int32  `json:"pageSize" query:"pageSize"`
}

// GetRagDataListResponse 获取RAG数据列表响应
type GetRagDataListResponse struct {
	BaseResponse
	List     []*RagData `json:"list"`
	Total    int32      `json:"total"`
	Current  int32      `json:"current"`
	PageSize int32      `json:"pageSize"`
}

// RagData RAG数据
type RagData struct {
	Id           string           `json:"id"`
	CollectionId string           `json:"collectionId"`
	Q            string           `json:"q"`
	A            string           `json:"a"`
	ChunkIndex   int32            `json:"chunkIndex"`
	Indexes      []*RagDataIndex  `json:"indexes,omitempty"`
	CreateTime   time.Time        `json:"createTime"`
	UpdateTime   time.Time        `json:"updateTime"`
}

// GetRagDataByIdRequest 获取RAG数据详情请求
type GetRagDataByIdRequest struct {
	Id string `json:"id" path:"id"`
}

// GetRagDataByIdResponse 获取RAG数据详情响应
type GetRagDataByIdResponse struct {
	BaseResponse
	Data *RagData `json:"data"`
}

// UpdateRagDataRequest 更新RAG数据请求
type UpdateRagDataRequest struct {
	Id         string           `json:"id" path:"id"`
	Q          string           `json:"q"`
	A          string           `json:"a"`
	ChunkIndex int32            `json:"chunkIndex"`
	Indexes    []*RagDataIndex  `json:"indexes,omitempty"`
}

// UpdateRagDataResponse 更新RAG数据响应
type UpdateRagDataResponse struct {
	BaseResponse
	Data *RagData `json:"data"`
}

// DeleteRagDataRequest 删除RAG数据请求
type DeleteRagDataRequest struct {
	Id string `json:"id" path:"id"`
}

// DeleteRagDataResponse 删除RAG数据响应
type DeleteRagDataResponse struct {
	BaseResponse
}

// ========== 文件处理模型 ==========

// SupportedFileType 支持的文件类型
type SupportedFileType string

const (
	FileTypeTXT    SupportedFileType = "txt"
	FileTypeMD     SupportedFileType = "md"
	FileTypeHTML   SupportedFileType = "html"
	FileTypePDF    SupportedFileType = "pdf"
	FileTypeDOCX   SupportedFileType = "docx"
	FileTypeXLSX   SupportedFileType = "xlsx"
	FileTypeCSV    SupportedFileType = "csv"
	FileTypeJSON   SupportedFileType = "json"
)

// FileInfo 文件信息
type FileInfo struct {
	OriginalName string `json:"originalName"`
	Filename     string `json:"filename"`
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mimeType"`
	Extension    string `json:"extension"`
}

// FileProcessingStatus 文件处理状态
type FileProcessingStatus string

const (
	ProcessingStatusPending    FileProcessingStatus = "pending"
	ProcessingStatusProcessing FileProcessingStatus = "processing"
	ProcessingStatusCompleted  FileProcessingStatus = "completed"
	ProcessingStatusFailed     FileProcessingStatus = "failed"
)

// UploadRagFileRequest 上传RAG文件请求
type UploadRagFileRequest struct {
	File        []byte `json:"file" form:"file"`
	FileName    string `json:"fileName" form:"fileName"`
	ContentType string `json:"contentType" form:"contentType"`
}

// UploadRagFileResponse 上传RAG文件响应
type UploadRagFileResponse struct {
	BaseResponse
	FileUrl    string   `json:"fileUrl"`
	FileId     string   `json:"fileId"`
	FileInfo   FileInfo `json:"fileInfo"`
	UploadTime time.Time `json:"uploadTime"`
}

// FileProcessRequest 文件处理请求
type FileProcessRequest struct {
	FileId             string                 `json:"fileId"`
	FileUrl            string                 `json:"fileUrl"`
	FileName           string                 `json:"fileName"`
	FileType           SupportedFileType      `json:"fileType"`
	ChunkSize          int32                  `json:"chunkSize"`
	ChunkOverlap       int32                  `json:"chunkOverlap"`
	PreserveStructure  bool                   `json:"preserveStructure"`
	ExtractImages      bool                   `json:"extractImages"`
	ProcessingOptions  map[string]interface{} `json:"processingOptions"`
}

// FileProcessResponse 文件处理响应
type FileProcessResponse struct {
	BaseResponse
	JobId         string                 `json:"jobId"`
	Status        FileProcessingStatus   `json:"status"`
	ProcessedText string                 `json:"processedText"`
	Chunks        []FileChunk            `json:"chunks"`
	Images        []FileImage            `json:"images"`
	Metadata      map[string]interface{} `json:"metadata"`
	ProcessTime   time.Duration          `json:"processTime"`
}

// FileChunk 文件分块
type FileChunk struct {
	Index    int32                  `json:"index"`
	Text     string                 `json:"text"`
	Metadata map[string]interface{} `json:"metadata"`
}

// FileImage 文件图片
type FileImage struct {
	Id       string `json:"id"`
	Base64   string `json:"base64"`
	MimeType string `json:"mimeType"`
	Width    int32  `json:"width"`
	Height   int32  `json:"height"`
}

// FileValidationRequest 文件验证请求
type FileValidationRequest struct {
	FileName    string            `json:"fileName"`
	FileSize    int64             `json:"fileSize"`
	ContentType string            `json:"contentType"`
	FileType    SupportedFileType `json:"fileType"`
}

// FileValidationResponse 文件验证响应
type FileValidationResponse struct {
	BaseResponse
	IsValid       bool     `json:"isValid"`
	ErrorMessages []string `json:"errorMessages"`
	Warnings      []string `json:"warnings"`
	MaxFileSize   int64    `json:"maxFileSize"`
}

// GetFileProcessingStatusRequest 获取文件处理状态请求
type GetFileProcessingStatusRequest struct {
	JobId string `json:"jobId" query:"jobId"`
}

// GetFileProcessingStatusResponse 获取文件处理状态响应
type GetFileProcessingStatusResponse struct {
	BaseResponse
	JobId       string               `json:"jobId"`
	Status      FileProcessingStatus `json:"status"`
	Progress    int32                `json:"progress"`
	Message     string               `json:"message"`
	Error       string               `json:"error"`
	StartTime   time.Time            `json:"startTime"`
	EndTime     *time.Time           `json:"endTime"`
	ProcessTime time.Duration        `json:"processTime"`
}

// GetSupportedFileTypesRequest 获取支持的文件类型请求
type GetSupportedFileTypesRequest struct{}

// GetSupportedFileTypesResponse 获取支持的文件类型响应
type GetSupportedFileTypesResponse struct {
	BaseResponse
	SupportedTypes []SupportedFileTypeInfo `json:"supportedTypes"`
}

// SupportedFileTypeInfo 支持的文件类型信息
type SupportedFileTypeInfo struct {
	Type        SupportedFileType `json:"type"`
	Extensions  []string          `json:"extensions"`
	MimeTypes   []string          `json:"mimeTypes"`
	MaxSize     int64             `json:"maxSize"`
	Description string            `json:"description"`
	Features    []string          `json:"features"`
}

// CreateRagCollectionFromFileRequest 从文件创建RAG集合请求
type CreateRagCollectionFromFileRequest struct {
	DatasetId         string                 `json:"datasetId"`
	Name              string                 `json:"name"`
	FileData          []byte                 `json:"fileData"`
	FileName          string                 `json:"fileName"`
	FileType          SupportedFileType      `json:"fileType"`
	TrainingType      string                 `json:"trainingType"`
	ChunkSize         int32                  `json:"chunkSize"`
	ChunkOverlap      int32                  `json:"chunkOverlap"`
	PreserveStructure bool                   `json:"preserveStructure"`
	ExtractImages     bool                   `json:"extractImages"`
	Tags              []string               `json:"tags"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// CreateRagCollectionFromFileResponse 从文件创建RAG集合响应
type CreateRagCollectionFromFileResponse struct {
	BaseResponse
	CollectionId  string `json:"collectionId"`
	TrainingJobId string `json:"trainingJobId"`
}

// CreateRagCollectionFromLinkRequest 从链接创建RAG集合请求
type CreateRagCollectionFromLinkRequest struct {
	DatasetId     string                 `json:"datasetId"`
	Name          string                 `json:"name"`
	Link          string                 `json:"link"`
	TrainingType  string                 `json:"trainingType"`
	ChunkSize     int32                  `json:"chunkSize"`
	ChunkOverlap  int32                  `json:"chunkOverlap,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// CreateRagCollectionFromLinkResponse 从链接创建RAG集合响应
type CreateRagCollectionFromLinkResponse struct {
	BaseResponse
	CollectionId  string `json:"collectionId"`
	TrainingJobId string `json:"trainingJobId"`
}

// CreateRagCollectionFromTextRequest 从文本创建RAG集合请求
type CreateRagCollectionFromTextRequest struct {
	DatasetId     string                 `json:"datasetId"`
	Name          string                 `json:"name"`
	Text          string                 `json:"text"`
	TrainingType  string                 `json:"trainingType"`
	ChunkSize     int32                  `json:"chunkSize"`
	ChunkOverlap  int32                  `json:"chunkOverlap,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// CreateRagCollectionFromTextResponse 从文本创建RAG集合响应
type CreateRagCollectionFromTextResponse struct {
	BaseResponse
	CollectionId  string `json:"collectionId"`
	TrainingJobId string `json:"trainingJobId"`
}

// 注意：UploadRagFileRequest 和 UploadRagFileResponse 已在前面定义，此处移除重复定义

// ========== 高级搜索模型 ==========

// RagSearchTestRequest RAG搜索测试请求
type RagSearchTestRequest struct {
	DatasetId  string  `json:"datasetId"`
	Text       string  `json:"text"`
	Limit      int32   `json:"limit"`
	Similarity float64 `json:"similarity"`
}

// RagSearchTestResponse RAG搜索测试响应
type RagSearchTestResponse struct {
	BaseResponse
	Results []*RagSearchItem `json:"results"`
}

// RagAdvancedSearchRequest RAG高级搜索请求
type RagAdvancedSearchRequest struct {
	DatasetId  string                 `json:"datasetId"`
	Text       string                 `json:"text"`
	Limit      int32                  `json:"limit"`
	Similarity float64                `json:"similarity"`
	Filters    map[string]interface{} `json:"filters"`
}

// RagAdvancedSearchResponse RAG高级搜索响应
type RagAdvancedSearchResponse struct {
	BaseResponse
	Results []*RagSearchItem `json:"results"`
}

// RagHybridSearchRequest RAG混合搜索请求
type RagHybridSearchRequest struct {
	DatasetId  string  `json:"datasetId"`
	Text       string  `json:"text"`
	Limit      int32   `json:"limit"`
	Similarity float64 `json:"similarity"`
}

// RagHybridSearchResponse RAG混合搜索响应
type RagHybridSearchResponse struct {
	BaseResponse
	Results []*RagSearchItem `json:"results"`
}

// RagSearchWithRerankRequest RAG重排序搜索请求
type RagSearchWithRerankRequest struct {
	DatasetId   string  `json:"datasetId"`
	Text        string  `json:"text"`
	Limit       int32   `json:"limit"`
	Similarity  float64 `json:"similarity"`
	RerankModel string  `json:"rerankModel"`
}

// RagSearchWithRerankResponse RAG重排序搜索响应
type RagSearchWithRerankResponse struct {
	BaseResponse
	Results []*RagSearchItem `json:"results"`
}

// ========== 训练管理模型 ==========

// StartRagTrainingRequest 启动RAG训练请求
type StartRagTrainingRequest struct {
	CollectionId string `json:"collectionId"`
	TeamId       string `json:"teamId"`
	UserId       string `json:"userId"`
}

// StartRagTrainingResponse 启动RAG训练响应
type StartRagTrainingResponse struct {
	BaseResponse
	TrainingJobId string `json:"trainingJobId"`
}

// GetRagTrainingStatusRequest 获取RAG训练状态请求
type GetRagTrainingStatusRequest struct {
	TrainingJobId string `json:"trainingJobId" query:"trainingJobId"`
}

// GetRagTrainingStatusResponse 获取RAG训练状态响应
type GetRagTrainingStatusResponse struct {
	BaseResponse
	Status          string `json:"status"`
	Progress        int32  `json:"progress"`
	ErrorMessage    string `json:"errorMessage"`
	ProcessedChunks int32  `json:"processedChunks"`
	TotalChunks     int32  `json:"totalChunks"`
}

// ========== 监控管理模型 ==========

// GetRagHealthRequest 获取RAG健康状态请求
type GetRagHealthRequest struct{}

// GetRagHealthResponse 获取RAG健康状态响应
type GetRagHealthResponse struct {
	BaseResponse
	Status     string                 `json:"status"`
	Version    string                 `json:"version"`
	Timestamp  time.Time              `json:"timestamp"`
	Components map[string]interface{} `json:"components"`
}

// GetRagUsageStatsRequest 获取RAG使用统计请求
type GetRagUsageStatsRequest struct {
	Period string `json:"period" query:"period"`
	Limit  int32  `json:"limit" query:"limit"`
}

// RagUsageRecord RAG使用记录
type RagUsageRecord struct {
	Date            string  `json:"date"`
	SearchCount     int32   `json:"searchCount"`
	EmbeddingTokens int32   `json:"embeddingTokens"`
	LlmTokens       int32   `json:"llmTokens"`
	AvgResponseTime float64 `json:"avgResponseTime"`
}

// RagUsageSummary RAG使用汇总
type RagUsageSummary struct {
	TotalSearches        int32   `json:"totalSearches"`
	TotalEmbeddingTokens int32   `json:"totalEmbeddingTokens"`
	TotalLlmTokens       int32   `json:"totalLlmTokens"`
	AvgResponseTime      float64 `json:"avgResponseTime"`
}

// GetRagUsageStatsResponse 获取RAG使用统计响应
type GetRagUsageStatsResponse struct {
	BaseResponse
	UsageRecords []*RagUsageRecord `json:"usageRecords"`
	Summary      *RagUsageSummary  `json:"summary"`
}

// GetRagMetricsRequest 获取RAG系统指标请求
type GetRagMetricsRequest struct {
	StartTime time.Time `json:"startTime" query:"startTime"`
	EndTime   time.Time `json:"endTime" query:"endTime"`
}

// GetRagMetricsResponse 获取RAG系统指标响应
type GetRagMetricsResponse struct {
	BaseResponse
	Metrics map[string]interface{} `json:"metrics"`
}

// GetRagAuditLogsRequest 获取RAG审计日志请求
type GetRagAuditLogsRequest struct {
	Action    string    `json:"action" query:"action"`
	StartTime time.Time `json:"startTime" query:"startTime"`
	EndTime   time.Time `json:"endTime" query:"endTime"`
	Limit     int32     `json:"limit" query:"limit"`
}

// GetRagAuditLogsResponse 获取RAG审计日志响应
type GetRagAuditLogsResponse struct {
	BaseResponse
	Logs []*AuditLog `json:"logs"`
}

// AuditLog 审计日志
type AuditLog struct {
	Id        string    `json:"id"`
	Action    string    `json:"action"`
	UserId    string    `json:"userId"`
	Resource  string    `json:"resource"`
	Details   string    `json:"details"`
	Timestamp time.Time `json:"timestamp"`
}

// ExportRagDataRequest 导出RAG数据请求
type ExportRagDataRequest struct {
	DatasetId string `json:"datasetId" query:"datasetId"`
	Format    string `json:"format" query:"format"`
}

// ExportRagDataResponse 导出RAG数据响应
type ExportRagDataResponse struct {
	BaseResponse
	ExportUrl string `json:"exportUrl"`
}

// GetRagPerformanceStatsRequest 获取RAG性能统计请求
type GetRagPerformanceStatsRequest struct {
	Period string `json:"period" query:"period"`
	Limit  int32  `json:"limit" query:"limit"`
}

// GetRagPerformanceStatsResponse 获取RAG性能统计响应
type GetRagPerformanceStatsResponse struct {
	BaseResponse
	PerformanceStats map[string]interface{} `json:"performanceStats"`
}

// ========== 批量操作模型 ==========

// BatchCreateRagCollectionsRequest 批量创建RAG集合请求
type BatchCreateRagCollectionsRequest struct {
	DatasetId   string                           `json:"datasetId"`
	Collections []*CreateRagCollectionRequest `json:"collections"`
}

// BatchCreateRagCollectionsResponse 批量创建RAG集合响应
type BatchCreateRagCollectionsResponse struct {
	BaseResponse
	Results []*BatchOperationResult `json:"results"`
}

// BatchDeleteRagCollectionsRequest 批量删除RAG集合请求
type BatchDeleteRagCollectionsRequest struct {
	CollectionIds []string `json:"collectionIds"`
}

// BatchDeleteRagCollectionsResponse 批量删除RAG集合响应
type BatchDeleteRagCollectionsResponse struct {
	BaseResponse
	Results []*BatchOperationResult `json:"results"`
}

// BatchUpdateRagDataRequest 批量更新RAG数据请求
type BatchUpdateRagDataRequest struct {
	Updates []*UpdateRagDataRequest `json:"updates"`
}

// BatchUpdateRagDataResponse 批量更新RAG数据响应
type BatchUpdateRagDataResponse struct {
	BaseResponse
	Results []*BatchOperationResult `json:"results"`
}

// BatchRetrainCollectionsRequest 批量重训练集合请求
type BatchRetrainCollectionsRequest struct {
	CollectionIds []string `json:"collectionIds"`
}

// BatchRetrainCollectionsResponse 批量重训练集合响应
type BatchRetrainCollectionsResponse struct {
	BaseResponse
	Results []*BatchOperationResult `json:"results"`
}

// BatchOperationResult 批量操作结果
type BatchOperationResult struct {
	Id      string `json:"id"`
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

// ========== 工作流相关类型定义 ==========

// WorkflowSearchOptions 工作流搜索选项
type WorkflowSearchOptions struct {
	Limit           int32             `json:"limit,omitempty"`
	Similarity      float64           `json:"similarity,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	UsingReRank     bool              `json:"usingReRank,omitempty"`
	RerankModel     string            `json:"rerankModel,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
	CollectionIds   []string          `json:"collectionIds,omitempty"`
}

// WorkflowSearchResult 工作流搜索结果
type WorkflowSearchResult struct {
	KnowledgeBaseID string                  `json:"knowledgeBaseId"`
	Query           string                  `json:"query"`
	Results         []*WorkflowSearchItem   `json:"results"`
	TotalCount      int32                   `json:"totalCount"`
	ExecutionTime   int64                   `json:"executionTime"`
	UsageStats      *WorkflowUsageStats     `json:"usageStats"`
}

// WorkflowSearchItem 工作流搜索项
type WorkflowSearchItem struct {
	ID             string            `json:"id"`
	Content        string            `json:"content"`
	Score          float64           `json:"score"`
	CollectionID   string            `json:"collectionId"`
	CollectionName string            `json:"collectionName"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	SourceName     string            `json:"sourceName,omitempty"`
	ChunkIndex     int               `json:"chunkIndex,omitempty"`
}

// WorkflowUsageStats 工作流使用统计
type WorkflowUsageStats struct {
	EmbeddingTokens int32 `json:"embeddingTokens"`
	RerankTokens    int32 `json:"rerankTokens"`
}

// WorkflowDeepSearchOptions 工作流深度搜索选项
type WorkflowDeepSearchOptions struct {
	MaxIterations   int32             `json:"maxIterations,omitempty"`
	Limit           int32             `json:"limit,omitempty"`
	Similarity      float64           `json:"similarity,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	UsingReRank     bool              `json:"usingReRank,omitempty"`
	RerankModel     string            `json:"rerankModel,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
	CollectionIds   []string          `json:"collectionIds,omitempty"`
}

// WorkflowDeepSearchResult 工作流深度搜索结果
type WorkflowDeepSearchResult struct {
	KnowledgeBaseID string                          `json:"knowledgeBaseId"`
	Query           string                          `json:"query"`
	FinalResults    []*WorkflowSearchItem           `json:"finalResults"`
	Iterations      []*WorkflowDeepSearchIteration  `json:"iterations"`
	TotalTokens     int32                           `json:"totalTokens"`
	ExecutionTime   int64                           `json:"executionTime"`
}

// WorkflowDeepSearchIteration 工作流深度搜索迭代
type WorkflowDeepSearchIteration struct {
	IterationIndex   int32                 `json:"iterationIndex"`
	Query            string                `json:"query"`
	Results          []*WorkflowSearchItem `json:"results"`
	TokensUsed       int32                 `json:"tokensUsed"`
}

// WorkflowKnowledgeBase 工作流知识库
type WorkflowKnowledgeBase struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status"`
	DataCount   int32  `json:"dataCount"`
}

// WorkflowValidationResult 工作流验证结果
type WorkflowValidationResult struct {
	IsValid       bool                   `json:"isValid"`
	ErrorMessage  string                 `json:"errorMessage,omitempty"`
	KnowledgeBase *WorkflowKnowledgeBase `json:"knowledgeBase,omitempty"`
}