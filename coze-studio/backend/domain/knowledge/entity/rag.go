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

package entity

// RAGDataset FastGPT RAG数据集实体（顶级概念，对应FastGPT的dataset）
// 注意：在FastGPTRAG中，dataset就是知识库的概念
type RAGDataset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	TeamID      string `json:"teamId"`
	UserID      string `json:"userId"`
	Type        string `json:"type"`        // dataset类型
	VectorModel string `json:"vectorModel"`
	AgentModel  string `json:"agentModel"`
	Status      string `json:"status"`
	FileCount   int32  `json:"fileCount"`   // 文件计数
	DataCount   int32  `json:"dataCount"`   // 数据计数
	ParentID    string `json:"parentId,omitempty"` // 父级ID
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

// RAGCollection RAG集合实体（dataset下的数据集合，对应FastGPT的collection）
// 注意：在FastGPTRAG中，collection是dataset下的数据组织单位
type RAGCollection struct {
	ID            string                 `json:"id"`
	DatasetID     string                 `json:"datasetId"` // 所属dataset的ID
	ParentID      string                 `json:"parentId,omitempty"`
	TeamID        string                 `json:"teamId,omitempty"`
	UserID        string                 `json:"userId,omitempty"`
	Name          string                 `json:"name"`
	Type          string                 `json:"type"` // text, file, url等
	Tags          []string               `json:"tags,omitempty"`
	FileURL       string                 `json:"fileUrl,omitempty"`
	FileID        string                 `json:"fileId,omitempty"`
	RawText       string                 `json:"rawText,omitempty"`
	RawLink       string                 `json:"rawLink,omitempty"`
	TrainingType  string                 `json:"trainingType"`
	ChunkSize     int                    `json:"chunkSize"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	Status        string                 `json:"status"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreateTime    int64                  `json:"createTime"` // 保持与FastGPT兼容
	UpdateTime    int64                  `json:"updateTime"` // 保持与FastGPT兼容
	CreatedAt     int64                  `json:"createdAt"`  // 内部使用
	UpdatedAt     int64                  `json:"updatedAt"`  // 内部使用
}

// RAGSearchRequest RAG搜索请求（dataset级搜索，对应FastGPT的dataset搜索）
type RAGSearchRequest struct {
	DatasetID        string            `json:"datasetId"` // 要搜索的dataset ID
	KnowledgeBaseID  string            `json:"knowledgeBaseId,omitempty"` // 兼容字段，与DatasetID同义
	Query            string            `json:"query"`
	TopK             int               `json:"topK,omitempty"`
	ScoreThreshold   float64           `json:"scoreThreshold,omitempty"`
	SearchMode       string            `json:"searchMode,omitempty"` // semantic, keyword, hybrid
	UsingReRank      bool              `json:"usingReRank,omitempty"`
	RerankModel      string            `json:"rerankModel,omitempty"`
	CollectionIDs    []string          `json:"collectionIds,omitempty"` // 可选：限制搜索特定collection
	DatasetIDs       []string          `json:"datasetIds,omitempty"` // 多数据集搜索支持
	Filters          map[string]string `json:"filters,omitempty"`
}

// RAGSearchResponse RAG搜索响应
type RAGSearchResponse struct {
	Results       []*RAGSearchItem      `json:"results"`
	TotalCount    int                   `json:"totalCount"`
	SearchID      string                `json:"searchId"`
	SearchMode    string                `json:"searchMode"`
	ExecutionTime int64                 `json:"executionTime"`
	UsageStats    *RAGSearchUsageStats  `json:"usageStats,omitempty"`
}

// RAGSearchUsageStats RAG搜索使用统计
type RAGSearchUsageStats struct {
	EmbeddingTokens     int     `json:"embeddingTokens"`
	ReRankTokens        int     `json:"reRankTokens"`
	LLMTokens           int     `json:"llmTokens"`
	SearchDuration      string  `json:"searchDuration,omitempty"`
	QueryExtension      string  `json:"queryExtension,omitempty"`
	SearchMode          string  `json:"searchMode,omitempty"`
	ResultsReturned     int     `json:"resultsReturned"`
	SimilarityThreshold float64 `json:"similarityThreshold,omitempty"`
}

// RAGSearchItem RAG搜索结果项
type RAGSearchItem struct {
	ID             string            `json:"id"`
	Content        string            `json:"content"`
	Score          float64           `json:"score"`
	CollectionID   string            `json:"collectionId"`
	CollectionName string            `json:"collectionName"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	SourceName     string            `json:"sourceName,omitempty"`
	ChunkIndex     int               `json:"chunkIndex,omitempty"`
}

// RAGHealthStatus RAG服务健康状态
type RAGHealthStatus struct {
	Status       string   `json:"status"`
	Version      string   `json:"version"`
	Timestamp    int64    `json:"timestamp"`
	Capabilities []string `json:"capabilities"`
}

// RAGUsageStats RAG使用统计
type RAGUsageStats struct {
	UsageRecords []*RAGUsageRecord `json:"usageRecords"`
	Summary      *RAGUsageSummary  `json:"summary"`
}

// RAGUsageRecord RAG使用记录
type RAGUsageRecord struct {
	Date              string  `json:"date"`
	SearchCount       int     `json:"searchCount"`
	EmbeddingTokens   int     `json:"embeddingTokens"`
	LLMTokens         int     `json:"llmTokens"`
	AvgResponseTime   float64 `json:"avgResponseTime"`
}

// RAGUsageSummary RAG使用汇总
type RAGUsageSummary struct {
	TotalSearches         int     `json:"totalSearches"`
	TotalEmbeddingTokens  int     `json:"totalEmbeddingTokens"`
	TotalLLMTokens        int     `json:"totalLLMTokens"`
	AvgResponseTime       float64 `json:"avgResponseTime"`
}

// RAGTrainingJob RAG训练任务
type RAGTrainingJob struct {
	ID              string  `json:"id"`
	CollectionID    string  `json:"collectionId"`
	TeamID          string  `json:"teamId"`
	UserID          string  `json:"userId"`
	Status          string  `json:"status"`
	Progress        float64 `json:"progress"`
	ErrorMessage    string  `json:"errorMessage,omitempty"`
	ProcessedChunks int     `json:"processedChunks,omitempty"`
	TotalChunks     int     `json:"totalChunks,omitempty"`
	CreatedAt       int64   `json:"createdAt"`
	UpdatedAt       int64   `json:"updatedAt"`
}

// DeepSearchRequest 深度搜索请求
type DeepSearchRequest struct {
	DatasetID     string  `json:"datasetId"`
	Text          string  `json:"text"`
	MaxIterations int     `json:"maxIterations,omitempty"`
	Model         string  `json:"model,omitempty"`
	Limit         int     `json:"limit,omitempty"`
	Similarity    float64 `json:"similarity,omitempty"`
}

// DeepSearchResponse 深度搜索响应
type DeepSearchResponse struct {
	FinalResults []*RAGSearchItem       `json:"finalResults"`
	Iterations   []*DeepSearchIteration `json:"iterations"`
	TotalTokens  int                    `json:"totalTokens"`
	Duration     string                 `json:"duration"`
}

// DeepSearchIteration 深度搜索迭代
type DeepSearchIteration struct {
	IterationIndex    int               `json:"iterationIndex"`
	ExpandedQuery     string            `json:"expandedQuery"`
	IterationResults  []*RAGSearchItem  `json:"iterationResults"`
	TokensUsed        int               `json:"tokensUsed"`
}

// ===== RAG编排相关实体 =====

// RAGOrchestrationRequest RAG编排请求（用于工作流节点）
type RAGOrchestrationRequest struct {
	// 工作流相关
	NodeID     string `json:"nodeId"`
	WorkflowID string `json:"workflowId"`
	
	// RAG搜索参数
	KnowledgeBaseID string            `json:"knowledgeBaseId"`
	Query           string            `json:"query"`
	TopK            int               `json:"topK,omitempty"`
	ScoreThreshold  float64           `json:"scoreThreshold,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
}

// RAGOrchestrationResponse RAG编排响应
type RAGOrchestrationResponse struct {
	// 搜索结果
	Results    []*RAGSearchItem     `json:"results"`
	TotalCount int                  `json:"totalCount"`
	SearchID   string               `json:"searchId"`
	UsageStats *RAGSearchUsageStats `json:"usageStats,omitempty"`
	
	// 工作流相关
	NodeID        string `json:"nodeId"`
	WorkflowID    string `json:"workflowId"`
	ExecutionTime int64  `json:"executionTime"`
}

// RAGDeepSearchOrchestrationRequest RAG深度搜索编排请求
type RAGDeepSearchOrchestrationRequest struct {
	// 工作流相关
	NodeID     string `json:"nodeId"`
	WorkflowID string `json:"workflowId"`
	
	// 深度搜索参数
	KnowledgeBaseID string            `json:"knowledgeBaseId"`
	Query           string            `json:"query"`
	MaxIterations   int               `json:"maxIterations,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	RerankerModel   string            `json:"rerankerModel,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
}

// RAGDeepSearchOrchestrationResponse RAG深度搜索编排响应
type RAGDeepSearchOrchestrationResponse struct {
	// 深度搜索结果
	FinalResults     []*RAGSearchItem        `json:"finalResults"`
	IterationResults []*DeepSearchIteration  `json:"iterationResults"`
	SearchID         string                  `json:"searchId"`
	UsageStats       *RAGSearchUsageStats    `json:"usageStats,omitempty"`
	
	// 工作流相关
	NodeID        string `json:"nodeId"`
	WorkflowID    string `json:"workflowId"`
	ExecutionTime int64  `json:"executionTime"`
}

// RAGConnectionStatus RAG连接状态
type RAGConnectionStatus struct {
	IsConnected    bool                   `json:"isConnected"`
	ServiceVersion string                 `json:"serviceVersion,omitempty"`
	Error          string                 `json:"error,omitempty"`
	LastCheck      interface{}            `json:"lastCheck,omitempty"`
	Capabilities   []string               `json:"capabilities,omitempty"`
}

// RAGFileUploadRequest RAG文件上传请求
type RAGFileUploadRequest struct {
	File        interface{}       `json:"file"`
	FileName    string            `json:"fileName"`
	ContentType string            `json:"contentType"`
	FileContent []byte            `json:"fileContent,omitempty"`
	FileType    string            `json:"fileType,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// RAGFileUploadResponse RAG文件上传响应
type RAGFileUploadResponse struct {
	DatasetID  string      `json:"datasetId,omitempty"`
	FileID     string      `json:"fileId"`
	FileURL    string      `json:"fileUrl"`
	FileInfo   RAGFileInfo `json:"fileInfo"`
	UploadTime int64       `json:"uploadTime"`
	Status     string      `json:"status,omitempty"`
}

// RAGTextDataRequest RAG文本数据请求
type RAGTextDataRequest struct {
	Content  string            `json:"content"`
	Title    string            `json:"title,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// RAGDeepSearchRequest 深度搜索请求（更新版本）
type RAGDeepSearchRequest struct {
	KnowledgeBaseID string            `json:"knowledgeBaseId"`
	Query           string            `json:"query"`
	MaxIterations   int               `json:"maxIterations,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	RerankerModel   string            `json:"rerankerModel,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
}

// RAGDeepSearchResponse 深度搜索响应（更新版本）
type RAGDeepSearchResponse struct {
	FinalResults     []*RAGSearchItem       `json:"finalResults"`
	IterationResults []*DeepSearchIteration `json:"iterationResults"`
	SearchID         string                 `json:"searchId"`
	ExecutionTime    int64                  `json:"executionTime"`
	UsageStats       *RAGSearchUsageStats   `json:"usageStats,omitempty"`
}

// RAGSyncStatus RAG同步状态
type RAGSyncStatus struct {
	KnowledgeID   int64  `json:"knowledgeId"`
	Status        string `json:"status"`        // syncing, completed, failed
	Progress      int    `json:"progress"`      // 0-100
	ErrorMessage  string `json:"errorMessage,omitempty"`
	LastSyncTime  int64  `json:"lastSyncTime"`
	TotalItems    int    `json:"totalItems"`
	SyncedItems   int    `json:"syncedItems"`
}

// ========== 集合管理相关实体 ==========

// RAGCollectionFastGPT FastGPT格式的集合实体（用于API兼容）
type RAGCollectionFastGPT struct {
	ID           string                 `json:"_id"`
	ParentID     string                 `json:"parentId,omitempty"`
	TeamID       string                 `json:"teamId"`
	TmbID        string                 `json:"tmbId"`
	DatasetID    string                 `json:"datasetId"`
	Type         string                 `json:"type"`
	Name         string                 `json:"name"`
	Tags         []string               `json:"tags,omitempty"`
	CreateTime   int64                  `json:"createTime"`
	UpdateTime   int64                  `json:"updateTime"`
	FileID       string                 `json:"fileId,omitempty"`
	RawLink      string                 `json:"rawLink,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	ChunkSize    int                    `json:"chunkSize,omitempty"`
	ChunkSplitter string                `json:"chunkSplitter,omitempty"`
	TrainingType string                 `json:"trainingType,omitempty"`
	Status       string                 `json:"status,omitempty"`
}

// RAGCreateCollectionRequest 创建集合请求
type RAGCreateCollectionRequest struct {
	DatasetID     string                 `json:"datasetId"`
	ParentID      string                 `json:"parentId,omitempty"`
	Type          string                 `json:"type"`
	Name          string                 `json:"name"`
	Tags          []string               `json:"tags,omitempty"`
	RawText       string                 `json:"rawText,omitempty"`
	RawLink       string                 `json:"rawLink,omitempty"`
	ChunkSize     int                    `json:"chunkSize,omitempty"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	TrainingType  string                 `json:"trainingType,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// RAGUpdateCollectionRequest 更新集合请求
type RAGUpdateCollectionRequest struct {
	Name         string                 `json:"name,omitempty"`
	Tags         []string               `json:"tags,omitempty"`
	ChunkSize    int                    `json:"chunkSize,omitempty"`
	ChunkSplitter string                `json:"chunkSplitter,omitempty"`
	TrainingType string                 `json:"trainingType,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// RAGListCollectionsRequest 获取集合列表请求
type RAGListCollectionsRequest struct {
	DatasetID string `json:"datasetId"`
	ParentID  string `json:"parentId,omitempty"`
	Type      string `json:"type,omitempty"`
	SearchKey string `json:"searchKey,omitempty"`
	Current   int    `json:"current,omitempty"`
	PageSize  int    `json:"pageSize,omitempty"`
}

// RAGListCollectionsResponse 获取集合列表响应
type RAGListCollectionsResponse struct {
	List     []*RAGCollection `json:"list"`
	Total    int              `json:"total"`
	Current  int              `json:"current"`
	PageSize int              `json:"pageSize"`
}

// RAGSyncCollectionResponse 同步集合响应
type RAGSyncCollectionResponse struct {
	Message     string `json:"message"`
	SyncJobID   string `json:"syncJobId,omitempty"`
	SyncedCount int    `json:"syncedCount,omitempty"`
	Status      string `json:"status,omitempty"`
}

// RAGRetrainCollectionResponse 重训练集合响应
type RAGRetrainCollectionResponse struct {
	Message    string `json:"message"`
	TrainingID string `json:"trainingId,omitempty"`
}

// RAGCollectionTrainingDetail 集合训练详情
type RAGCollectionTrainingDetail struct {
	Status          string `json:"status,omitempty"`
	Progress        int    `json:"progress,omitempty"`
	ProcessedChunks int    `json:"processedChunks,omitempty"`
	TotalChunks     int    `json:"totalChunks,omitempty"`
	ErrorMessage    string `json:"errorMessage,omitempty"`
	StartTime       int64  `json:"startTime,omitempty"`
	EndTime         int64  `json:"endTime,omitempty"`
	Total           int    `json:"total"`
	Processing      int    `json:"processing"`
	Completed       int    `json:"completed"`
	Failed          int    `json:"failed"`
}

// RAGExportCollectionResponse 导出集合响应
type RAGExportCollectionResponse struct {
	Name       string      `json:"name"`
	Data       interface{} `json:"data"`
	ExportData interface{} `json:"exportData,omitempty"`
	ExportURL  string      `json:"exportUrl,omitempty"`
	Format     string      `json:"format,omitempty"`
	FileSize   int64       `json:"fileSize,omitempty"`
}

// RAGCreateCollectionFromFileRequest 从文件创建集合请求
type RAGCreateCollectionFromFileRequest struct {
	DatasetID         string                 `json:"datasetId"`
	Name              string                 `json:"name"`
	ChunkSize         int                    `json:"chunkSize,omitempty"`
	ChunkSplitter     string                 `json:"chunkSplitter,omitempty"`
	TrainingType      string                 `json:"trainingType,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
	FileData          []byte                 `json:"fileData"`
	FileName          string                 `json:"fileName"`
	FileType          SupportedFileType      `json:"fileType,omitempty"`
	ChunkOverlap      int                    `json:"chunkOverlap,omitempty"`
	PreserveStructure bool                   `json:"preserveStructure,omitempty"`
	ExtractImages     bool                   `json:"extractImages,omitempty"`
	Tags              []string               `json:"tags,omitempty"`
}

// RAGCreateCollectionFromFileResponse 从文件创建集合响应
type RAGCreateCollectionFromFileResponse struct {
	CollectionID  string `json:"collectionId"`
	TrainingJobID string `json:"trainingJobId,omitempty"`
}

// RAGCreateCollectionFromLinkRequest 从链接创建集合请求
type RAGCreateCollectionFromLinkRequest struct {
	DatasetID     string                 `json:"datasetId"`
	Name          string                 `json:"name"`
	Link          string                 `json:"link"`
	ChunkSize     int                    `json:"chunkSize,omitempty"`
	ChunkOverlap  int                    `json:"chunkOverlap,omitempty"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	TrainingType  string                 `json:"trainingType,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// RAGCreateCollectionFromLinkResponse 从链接创建集合响应
type RAGCreateCollectionFromLinkResponse struct {
	CollectionID  string `json:"collectionId"`
	TrainingJobID string `json:"trainingJobId,omitempty"`
}

// RAGCreateCollectionFromTextRequest 从文本创建集合请求
type RAGCreateCollectionFromTextRequest struct {
	DatasetID     string                 `json:"datasetId"`
	Name          string                 `json:"name"`
	Text          string                 `json:"text"`
	ChunkSize     int                    `json:"chunkSize,omitempty"`
	ChunkOverlap  int                    `json:"chunkOverlap,omitempty"`
	ChunkSplitter string                 `json:"chunkSplitter,omitempty"`
	TrainingType  string                 `json:"trainingType,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// RAGCreateCollectionFromTextResponse 从文本创建集合响应
type RAGCreateCollectionFromTextResponse struct {
	CollectionID  string `json:"collectionId"`
	TrainingJobID string `json:"trainingJobId,omitempty"`
}

// ========== 文件处理相关实体 ==========

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

// FileProcessingStatus 文件处理状态
type FileProcessingStatus string

const (
	ProcessingStatusPending    FileProcessingStatus = "pending"
	ProcessingStatusProcessing FileProcessingStatus = "processing"
	ProcessingStatusCompleted  FileProcessingStatus = "completed"
	ProcessingStatusFailed     FileProcessingStatus = "failed"
)

// RAGFileInfo 文件信息
type RAGFileInfo struct {
	OriginalName string `json:"originalName"`
	Filename     string `json:"filename"`
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mimeType"`
	Extension    string `json:"extension"`
}

// 注意：RAGFileUploadRequest 和 RAGFileUploadResponse 已在前面定义，此处移除重复定义

// RAGFileProcessRequest 文件处理请求
type RAGFileProcessRequest struct {
	FileID            string                 `json:"fileId"`
	FileURL           string                 `json:"fileUrl"`
	FileName          string                 `json:"fileName"`
	FileType          SupportedFileType      `json:"fileType"`
	ChunkSize         int                    `json:"chunkSize,omitempty"`
	ChunkOverlap      int                    `json:"chunkOverlap,omitempty"`
	PreserveStructure bool                   `json:"preserveStructure,omitempty"`
	ExtractImages     bool                   `json:"extractImages,omitempty"`
	ProcessingOptions map[string]interface{} `json:"processingOptions,omitempty"`
}

// RAGFileProcessResponse 文件处理响应
type RAGFileProcessResponse struct {
	JobID         string                 `json:"jobId"`
	Status        FileProcessingStatus   `json:"status"`
	ProcessedText string                 `json:"processedText,omitempty"`
	Chunks        []RAGFileChunk         `json:"chunks,omitempty"`
	Images        []RAGFileImage         `json:"images,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ProcessTime   int64                  `json:"processTime,omitempty"`
}

// RAGFileChunk 文件分块
type RAGFileChunk struct {
	Index    int                    `json:"index"`
	Text     string                 `json:"text"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// RAGFileImage 文件图片
type RAGFileImage struct {
	ID       string `json:"id"`
	Base64   string `json:"base64"`
	MimeType string `json:"mimeType"`
	Width    int    `json:"width,omitempty"`
	Height   int    `json:"height,omitempty"`
}

// RAGFileValidationRequest 文件验证请求
type RAGFileValidationRequest struct {
	FileName    string            `json:"fileName"`
	FileSize    int64             `json:"fileSize"`
	ContentType string            `json:"contentType"`
	FileType    SupportedFileType `json:"fileType"`
}

// RAGFileValidationResponse 文件验证响应
type RAGFileValidationResponse struct {
	IsValid       bool     `json:"isValid"`
	ErrorMessages []string `json:"errorMessages,omitempty"`
	Warnings      []string `json:"warnings,omitempty"`
	MaxFileSize   int64    `json:"maxFileSize"`
}

// RAGFileProcessingStatus 文件处理状态
type RAGFileProcessingStatus struct {
	JobID       string               `json:"jobId"`
	Status      FileProcessingStatus `json:"status"`
	Progress    int                  `json:"progress"`
	Message     string               `json:"message,omitempty"`
	Error       string               `json:"error,omitempty"`
	StartTime   int64                `json:"startTime"`
	EndTime     *int64               `json:"endTime,omitempty"`
	ProcessTime int64                `json:"processTime,omitempty"`
}

// 注意：RAGCreateCollectionFromFileRequest 和 RAGCreateCollectionFromFileResponse 已在前面定义，此处移除重复定义

// ========== 工作流集成相关实体 ==========

// RAGWorkflowSearchRequest 工作流RAG搜索请求
type RAGWorkflowSearchRequest struct {
	KnowledgeBaseID string            `json:"knowledgeBaseId"`
	Query           string            `json:"query"`
	TopK            int               `json:"topK,omitempty"`
	ScoreThreshold  float64           `json:"scoreThreshold,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
}

// RAGWorkflowSearchResponse 工作流RAG搜索响应
type RAGWorkflowSearchResponse struct {
	Results    []*RAGSearchItem     `json:"results"`
	TotalCount int                  `json:"totalCount"`
	SearchID   string               `json:"searchId"`
	UsageStats *RAGSearchUsageStats `json:"usageStats,omitempty"`
}

// RAGWorkflowDeepSearchRequest 工作流RAG深度搜索请求
type RAGWorkflowDeepSearchRequest struct {
	KnowledgeBaseID string            `json:"knowledgeBaseId"`
	Query           string            `json:"query"`
	MaxIterations   int               `json:"maxIterations,omitempty"`
	SearchMode      string            `json:"searchMode,omitempty"`
	RerankerModel   string            `json:"rerankerModel,omitempty"`
	Filters         map[string]string `json:"filters,omitempty"`
}

// RAGWorkflowDeepSearchResponse 工作流RAG深度搜索响应
type RAGWorkflowDeepSearchResponse struct {
	FinalResults     []*RAGSearchItem        `json:"finalResults"`
	IterationResults []*DeepSearchIteration  `json:"iterationResults"`
	SearchID         string                  `json:"searchId"`
	UsageStats       *RAGSearchUsageStats    `json:"usageStats,omitempty"`
}

// RAGWorkflowKnowledgeBase 工作流可用知识库
type RAGWorkflowKnowledgeBase struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status"`
	DataCount   int32  `json:"dataCount"`
}

// RAGValidationResult RAG验证结果
type RAGValidationResult struct {
	Valid       bool   `json:"valid"`
	Message     string `json:"message,omitempty"`
	ErrorCode   string `json:"errorCode,omitempty"`
	Suggestions string `json:"suggestions,omitempty"`
}

// RAGKnowledgeBase RAG知识库实体（用于工作流）
type RAGKnowledgeBase struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"`
	TeamID      string `json:"teamId"`
	Status      string `json:"status"`
	VectorModel string `json:"vectorModel,omitempty"`
	AgentModel  string `json:"agentModel,omitempty"`
	FileCount   int32  `json:"fileCount,omitempty"`
	DataCount   int32  `json:"dataCount"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

// ========== 数据管理相关实体 ==========

// RAGData RAG数据实体
type RAGData struct {
	ID           string         `json:"_id"`
	TeamID       string         `json:"teamId"`
	TmbID        string         `json:"tmbId"`
	DatasetID    string         `json:"datasetId"`
	CollectionID string         `json:"collectionId"`
	Q            string         `json:"q"`
	A            string         `json:"a,omitempty"`
	ChunkIndex   int            `json:"chunkIndex"`
	Indexes      []RAGDataIndex `json:"indexes"`
	CreateTime   int64          `json:"createTime"` // 添加创建时间
	UpdateTime   int64          `json:"updateTime"`
}

// RAGDataIndex RAG数据索引
type RAGDataIndex struct {
	Type   string `json:"type"`
	DataID string `json:"dataId"`
	Text   string `json:"text"`
}

// RAGInsertDataRequest 插入数据请求
type RAGInsertDataRequest struct {
	CollectionID string         `json:"collectionId"`
	Q            string         `json:"q"`
	A            string         `json:"a,omitempty"`
	ChunkIndex   int            `json:"chunkIndex,omitempty"`
	Indexes      []RAGDataIndex `json:"indexes,omitempty"`
}

// RAGInsertDataResponse 插入数据响应
type RAGInsertDataResponse struct {
	DataID string `json:"dataId"`
}

// RAGPushDataBatchRequest 批量推送数据请求
type RAGPushDataBatchRequest struct {
	CollectionID string        `json:"collectionId"`
	Data         []RAGDataItem `json:"data"`
	Mode         string        `json:"mode,omitempty"`
}

// RAGDataItem RAG数据项
type RAGDataItem struct {
	Q          string         `json:"q"`
	A          string         `json:"a,omitempty"`
	ChunkIndex int            `json:"chunkIndex,omitempty"`
	Indexes    []RAGDataIndex `json:"indexes,omitempty"`
}

// RAGPushDataBatchResponse 批量推送数据响应
type RAGPushDataBatchResponse struct {
	InsertedCount int    `json:"insertedCount"`
	TrainingID    string `json:"trainingId,omitempty"`
}

// RAGGetDataListRequest 获取数据列表请求
type RAGGetDataListRequest struct {
	CollectionID string `json:"collectionId,omitempty"`
	DatasetID    string `json:"datasetId,omitempty"`
	SearchText   string `json:"searchText,omitempty"`
	Current      int    `json:"current,omitempty"`
	PageSize     int    `json:"pageSize,omitempty"`
}

// RAGGetDataListResponse 获取数据列表响应
type RAGGetDataListResponse struct {
	List     []*RAGData `json:"list"`
	Total    int        `json:"total"`
	Current  int        `json:"current"`
	PageSize int        `json:"pageSize"`
}

// RAGUpdateDataRequest 更新数据请求
type RAGUpdateDataRequest struct {
	Q       string         `json:"q,omitempty"`
	A       string         `json:"a,omitempty"`
	Indexes []RAGDataIndex `json:"indexes,omitempty"`
}

// RAGBatchUpdateDataRequest 批量更新数据请求
type RAGBatchUpdateDataRequest struct {
	Updates []RAGBatchUpdateDataItem `json:"updates"`
}

// RAGBatchUpdateDataItem 批量更新数据项
type RAGBatchUpdateDataItem struct {
	ID string `json:"id"`
	Q  string `json:"q,omitempty"`
	A  string `json:"a,omitempty"`
}

// RAGBatchUpdateDataResponse 批量更新数据响应
type RAGBatchUpdateDataResponse struct {
	Results []RAGBatchOperationResult `json:"results"`
}

// RAGBatchOperationResult 批量操作结果
type RAGBatchOperationResult struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}