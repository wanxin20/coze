# Coze 集成 RAGFlow 知识库实现方案

## 概述

本文档详细描述了将 RAGFlow 的强大知识库能力集成到 Coze 平台中的完整实现方案。通过这次集成，Coze 将获得世界级的文档解析、智能分块和向量检索能力。

## 架构分析

### Coze 现有架构特点

- **技术栈**: Go 语言后端，分层架构设计
- **核心模块**: Application Layer (应用层) / Domain Layer (领域层) / Infrastructure Layer (基础设施层)
- **知识库功能**: 基础的文档管理、分片处理、状态追踪
- **数据流**: Frontend → Application Service → Domain Service → Repository → Database

### RAGFlow 架构特点

- **技术栈**: Python 后端，模块化设计
- **核心优势**: 
  - 多种文档解析器 (naive, qa, resume, table, paper, book, laws 等)
  - 智能分块策略 (hierarchical, semantic-aware chunking)
  - 高性能向量检索 (支持多种 embedding 模型)
  - 完整的文档处理管道

### 集成架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Coze Frontend │───▶│  Coze Backend   │───▶│   RAGFlow API   │
│     (React)     │    │      (Go)       │    │    (Python)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Coze Database  │    │   Vector Store  │
                       │   (PostgreSQL)  │    │ (Elasticsearch) │
                       └─────────────────┘    └─────────────────┘
```

## 详细实现方案

### 阶段一：基础集成层开发 (1-2 周)

#### 1.1 RAGFlow 服务部署

**Docker Compose 配置**:
```yaml
# docker/ragflow-integration.yml
version: '3.8'
services:
  ragflow:
    image: infiniflow/ragflow:latest
    container_name: coze-ragflow
    ports:
      - "9380:9380"
    environment:
      - DATABASE_URL=postgresql://ragflow:password@postgres:5432/ragflow
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    volumes:
      - ragflow_data:/ragflow/data
    depends_on:
      - postgres
      - redis
      - elasticsearch

  elasticsearch:
    image: elasticsearch:8.5.0
    container_name: coze-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  postgres:
    image: postgres:14
    container_name: coze-postgres-ragflow
    environment:
      - POSTGRES_DB=ragflow
      - POSTGRES_USER=ragflow
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: coze-redis
    ports:
      - "6379:6379"

volumes:
  ragflow_data:
  es_data:
  postgres_data:
```

#### 1.2 Go 客户端适配层

**目录结构**:
```
coze-studio/backend/infra/impl/ragflow/
├── client.go          # RAGFlow HTTP 客户端
├── converter.go       # 数据模型转换
├── config.go         # 配置管理
├── error.go          # 错误处理
└── interface.go      # 接口定义
```

**核心接口定义** (`interface.go`):
```go
package ragflow

import (
    "context"
    "io"
)

// RAGFlowService RAGFlow 服务接口
type RAGFlowService interface {
    // 知识库管理
    CreateKnowledgeBase(ctx context.Context, req *CreateKBRequest) (*KnowledgeBase, error)
    DeleteKnowledgeBase(ctx context.Context, kbID string) error
    GetKnowledgeBase(ctx context.Context, kbID string) (*KnowledgeBase, error)
    
    // 文档管理
    UploadDocument(ctx context.Context, req *UploadDocumentRequest) (*Document, error)
    ParseDocument(ctx context.Context, req *ParseDocumentRequest) (*ParseResult, error)
    GetDocumentStatus(ctx context.Context, docID string) (*DocumentStatus, error)
    
    // 检索功能
    SearchChunks(ctx context.Context, req *SearchRequest) (*SearchResponse, error)
    RetrieveChunks(ctx context.Context, req *RetrieveRequest) (*RetrieveResponse, error)
}

// 请求/响应结构体
type CreateKBRequest struct {
    Name        string            `json:"name"`
    Description string            `json:"description"`
    Language    string            `json:"language"`
    EmbdID      string            `json:"embd_id"`
    ParserID    string            `json:"parser_id"`
    ParserConfig map[string]interface{} `json:"parser_config"`
}

type UploadDocumentRequest struct {
    KnowledgeBaseID string    `json:"kb_id"`
    File           io.Reader  `json:"-"`
    FileName       string     `json:"name"`
    ParserID       string     `json:"parser_id"`
    ParserConfig   map[string]interface{} `json:"parser_config"`
}

type SearchRequest struct {
    KnowledgeBaseID string   `json:"kb_id"`
    Question       string    `json:"question"`
    TopK           int       `json:"top_k"`
    SimilarityThreshold float64 `json:"similarity_threshold"`
    Keywords       []string  `json:"keywords"`
}
```

**HTTP 客户端实现** (`client.go`):
```go
package ragflow

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
    
    "github.com/coze-dev/coze-studio/backend/pkg/logs"
)

type Client struct {
    baseURL    string
    httpClient *http.Client
    apiKey     string
}

func NewClient(baseURL, apiKey string) *Client {
    return &Client{
        baseURL: baseURL,
        apiKey:  apiKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
            Transport: &http.Transport{
                MaxIdleConns:        100,
                MaxIdleConnsPerHost: 10,
                IdleConnTimeout:     90 * time.Second,
            },
        },
    }
}

func (c *Client) CreateKnowledgeBase(ctx context.Context, req *CreateKBRequest) (*KnowledgeBase, error) {
    url := fmt.Sprintf("%s/api/v1/dataset", c.baseURL)
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("marshal request failed: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("create request failed: %w", err)
    }
    
    c.setHeaders(httpReq)
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("http request failed: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, c.handleErrorResponse(resp)
    }
    
    var result struct {
        Code int             `json:"code"`
        Data *KnowledgeBase  `json:"data"`
        Message string       `json:"message"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode response failed: %w", err)
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("ragflow api error: %s", result.Message)
    }
    
    return result.Data, nil
}

func (c *Client) UploadDocument(ctx context.Context, req *UploadDocumentRequest) (*Document, error) {
    // 实现文件上传逻辑
    // 使用 multipart/form-data 格式
    url := fmt.Sprintf("%s/api/v1/document/upload", c.baseURL)
    
    // 创建 multipart writer
    var buf bytes.Buffer
    writer := multipart.NewWriter(&buf)
    
    // 添加文件字段
    part, err := writer.CreateFormFile("file", req.FileName)
    if err != nil {
        return nil, fmt.Errorf("create form file failed: %w", err)
    }
    
    if _, err := io.Copy(part, req.File); err != nil {
        return nil, fmt.Errorf("copy file failed: %w", err)
    }
    
    // 添加其他字段
    writer.WriteField("kb_id", req.KnowledgeBaseID)
    writer.WriteField("parser_id", req.ParserID)
    
    if req.ParserConfig != nil {
        configJSON, _ := json.Marshal(req.ParserConfig)
        writer.WriteField("parser_config", string(configJSON))
    }
    
    writer.Close()
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST", url, &buf)
    if err != nil {
        return nil, fmt.Errorf("create request failed: %w", err)
    }
    
    httpReq.Header.Set("Content-Type", writer.FormDataContentType())
    c.setAuthHeader(httpReq)
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("http request failed: %w", err)
    }
    defer resp.Body.Close()
    
    // 处理响应
    var result struct {
        Code int       `json:"code"`
        Data *Document `json:"data"`
        Message string `json:"message"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode response failed: %w", err)
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("ragflow api error: %s", result.Message)
    }
    
    return result.Data, nil
}

func (c *Client) SearchChunks(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
    url := fmt.Sprintf("%s/api/v1/retrieval", c.baseURL)
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("marshal request failed: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("create request failed: %w", err)
    }
    
    c.setHeaders(httpReq)
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("http request failed: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, c.handleErrorResponse(resp)
    }
    
    var result struct {
        Code int             `json:"code"`
        Data *SearchResponse `json:"data"`
        Message string       `json:"message"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode response failed: %w", err)
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("ragflow api error: %s", result.Message)
    }
    
    return result.Data, nil
}

func (c *Client) setHeaders(req *http.Request) {
    req.Header.Set("Content-Type", "application/json")
    c.setAuthHeader(req)
}

func (c *Client) setAuthHeader(req *http.Request) {
    if c.apiKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.apiKey)
    }
}

func (c *Client) handleErrorResponse(resp *http.Response) error {
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("http error %d: failed to read response body", resp.StatusCode)
    }
    
    var errorResp struct {
        Message string `json:"message"`
        Code    int    `json:"code"`
    }
    
    if err := json.Unmarshal(body, &errorResp); err != nil {
        return fmt.Errorf("http error %d: %s", resp.StatusCode, string(body))
    }
    
    return fmt.Errorf("http error %d: %s", resp.StatusCode, errorResp.Message)
}
```

**数据模型转换** (`converter.go`):
```go
package ragflow

import (
    "strconv"
    
    "github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
    "github.com/coze-dev/coze-studio/backend/api/model/crossdomain/knowledge"
)

// ConvertCozeKnowledgeToRAGFlow 将 Coze 知识库转换为 RAGFlow 格式
func ConvertCozeKnowledgeToRAGFlow(cozeKB *entity.Knowledge) *CreateKBRequest {
    return &CreateKBRequest{
        Name:        cozeKB.Name,
        Description: cozeKB.Description,
        Language:    "zh", // 默认中文，可配置
        EmbdID:      "BAAI/bge-base-zh-v1.5", // 默认 embedding 模型
        ParserID:    getParserIDByType(cozeKB.Type),
        ParserConfig: getDefaultParserConfig(cozeKB.Type),
    }
}

// ConvertRAGFlowKnowledgeToCoze 将 RAGFlow 知识库转换为 Coze 格式
func ConvertRAGFlowKnowledgeToCoze(ragflowKB *KnowledgeBase, cozeKB *entity.Knowledge) {
    // 保持 Coze 原有字段，只更新 RAGFlow 相关信息
    if cozeKB.Metadata == nil {
        cozeKB.Metadata = make(map[string]interface{})
    }
    cozeKB.Metadata["ragflow_id"] = ragflowKB.ID
    cozeKB.Metadata["ragflow_parser_id"] = ragflowKB.ParserID
    cozeKB.Metadata["ragflow_embd_id"] = ragflowKB.EmbdID
}

// ConvertCozeDocumentToRAGFlow 将 Coze 文档转换为 RAGFlow 格式
func ConvertCozeDocumentToRAGFlow(cozeDoc *entity.Document, kbID string) *UploadDocumentRequest {
    return &UploadDocumentRequest{
        KnowledgeBaseID: kbID,
        FileName:       cozeDoc.Name,
        ParserID:       getParserIDByDocumentType(cozeDoc.Type),
        ParserConfig:   getParserConfigByStrategy(cozeDoc.ChunkingStrategy, cozeDoc.ParsingStrategy),
    }
}

// ConvertRAGFlowChunksToCoze 将 RAGFlow 分块转换为 Coze 分片
func ConvertRAGFlowChunksToCoze(ragflowChunks []Chunk, documentID int64) []*entity.Slice {
    slices := make([]*entity.Slice, 0, len(ragflowChunks))
    
    for i, chunk := range ragflowChunks {
        slice := &entity.Slice{
            DocumentID: documentID,
            Sequence:   i + 1,
            RawContent: []*knowledge.SliceContent{{
                Type: knowledge.SliceContentTypeText,
                Text: &chunk.Content,
            }},
            SliceStatus: convertRAGFlowStatusToCoze(chunk.Status),
            CharCount:   len(chunk.Content),
            Hit:         0, // 初始命中次数为 0
        }
        
        // 存储 RAGFlow 相关元数据
        if slice.Metadata == nil {
            slice.Metadata = make(map[string]interface{})
        }
        slice.Metadata["ragflow_chunk_id"] = chunk.ID
        slice.Metadata["ragflow_score"] = chunk.Score
        slice.Metadata["ragflow_positions"] = chunk.Positions
        
        slices = append(slices, slice)
    }
    
    return slices
}

func getParserIDByType(docType knowledge.DocumentType) string {
    switch docType {
    case knowledge.DocumentTypeText:
        return "naive"
    case knowledge.DocumentTypeTable:
        return "table"
    case knowledge.DocumentTypeImage:
        return "picture"
    default:
        return "naive"
    }
}

func getDefaultParserConfig(docType knowledge.DocumentType) map[string]interface{} {
    config := map[string]interface{}{
        "chunk_token_count": 128,
        "delimiter": "\n。；！？",
        "layout_recognize": true,
    }
    
    switch docType {
    case knowledge.DocumentTypeTable:
        config["table_extract"] = true
        config["table_header_row"] = 0
    case knowledge.DocumentTypeImage:
        config["vision_extract"] = true
        config["ocr_extract"] = true
    }
    
    return config
}

func getParserConfigByStrategy(chunkStrategy *entity.ChunkingStrategy, parseStrategy *entity.ParsingStrategy) map[string]interface{} {
    config := make(map[string]interface{})
    
    if chunkStrategy != nil {
        config["chunk_token_count"] = chunkStrategy.ChunkSize
        if chunkStrategy.Separator != "" {
            config["delimiter"] = chunkStrategy.Separator
        }
        config["chunk_overlap"] = chunkStrategy.Overlap
    }
    
    if parseStrategy != nil {
        config["layout_recognize"] = parseStrategy.ExtractTable
        config["vision_extract"] = parseStrategy.ExtractImage
        config["ocr_extract"] = parseStrategy.ImageOCR
    }
    
    return config
}

func convertRAGFlowStatusToCoze(status string) knowledge.SliceStatus {
    switch status {
    case "running":
        return knowledge.SliceStatusInit
    case "done":
        return knowledge.SliceStatusFinishStore
    case "failed":
        return knowledge.SliceStatusFailed
    default:
        return knowledge.SliceStatusInit
    }
}
```

#### 1.3 配置管理

**配置结构** (`config.go`):
```go
package ragflow

import (
    "time"
)

type Config struct {
    BaseURL            string        `yaml:"base_url" json:"base_url"`
    APIKey             string        `yaml:"api_key" json:"api_key"`
    Timeout            time.Duration `yaml:"timeout" json:"timeout"`
    MaxRetries         int           `yaml:"max_retries" json:"max_retries"`
    RetryDelay         time.Duration `yaml:"retry_delay" json:"retry_delay"`
    EnableCache        bool          `yaml:"enable_cache" json:"enable_cache"`
    CacheTTL           time.Duration `yaml:"cache_ttl" json:"cache_ttl"`
    
    // 默认配置
    DefaultEmbdID      string        `yaml:"default_embd_id" json:"default_embd_id"`
    DefaultLanguage    string        `yaml:"default_language" json:"default_language"`
    DefaultChunkSize   int           `yaml:"default_chunk_size" json:"default_chunk_size"`
    
    // 性能配置
    MaxConcurrentReqs  int           `yaml:"max_concurrent_reqs" json:"max_concurrent_reqs"`
    PoolSize           int           `yaml:"pool_size" json:"pool_size"`
}

func DefaultConfig() *Config {
    return &Config{
        BaseURL:           "http://localhost:9380",
        Timeout:           30 * time.Second,
        MaxRetries:        3,
        RetryDelay:        1 * time.Second,
        EnableCache:       true,
        CacheTTL:          5 * time.Minute,
        DefaultEmbdID:     "BAAI/bge-base-zh-v1.5",
        DefaultLanguage:   "zh",
        DefaultChunkSize:  128,
        MaxConcurrentReqs: 10,
        PoolSize:          20,
    }
}
```

### 阶段二：核心功能集成 (2-3 周)

#### 2.1 知识库服务层修改

**修改知识库应用服务** (`knowledge.go`):
```go
// 在 KnowledgeApplicationService 中添加 RAGFlow 服务
type KnowledgeApplicationService struct {
    DomainSVC   service.Knowledge
    eventBus    search.ResourceEventBus
    storage     storage.Storage
    ragflowSvc  ragflow.RAGFlowService  // 新增
}

// CreateKnowledge 创建知识库（集成 RAGFlow）
func (k *KnowledgeApplicationService) CreateKnowledge(ctx context.Context, req *dataset.CreateDatasetRequest) (*dataset.CreateDatasetResponse, error) {
    // 1. 原有逻辑：创建 Coze 知识库
    domainResp, err := k.DomainSVC.CreateKnowledge(ctx, &service.CreateKnowledgeRequest{
        Name:        req.Name,
        Description: req.Description,
        CreatorID:   ctxutil.GetUIDFromCtx(ctx),
        SpaceID:     req.SpaceID,
        AppID:       req.GetProjectID(),
        FormatType:  convertDocumentTypeDataset2Entity(req.FormatType),
        IconUri:     req.IconURI,
    })
    if err != nil {
        return dataset.NewCreateDatasetResponse(), err
    }
    
    // 2. 新增：在 RAGFlow 中创建对应的知识库
    ragflowReq := &ragflow.CreateKBRequest{
        Name:        req.Name,
        Description: req.Description,
        Language:    "zh",
        EmbdID:      "BAAI/bge-base-zh-v1.5",
        ParserID:    ragflow.GetParserIDByType(req.FormatType),
    }
    
    ragflowKB, err := k.ragflowSvc.CreateKnowledgeBase(ctx, ragflowReq)
    if err != nil {
        // RAGFlow 创建失败时，需要回滚 Coze 知识库
        logs.CtxErrorf(ctx, "create ragflow kb failed, rolling back coze kb: %v", err)
        k.DomainSVC.DeleteKnowledge(ctx, &service.DeleteKnowledgeRequest{
            KnowledgeID: domainResp.KnowledgeID,
        })
        return dataset.NewCreateDatasetResponse(), fmt.Errorf("create ragflow knowledge base failed: %w", err)
    }
    
    // 3. 更新 Coze 知识库，存储 RAGFlow 关联信息
    err = k.DomainSVC.UpdateKnowledge(ctx, &service.UpdateKnowledgeRequest{
        KnowledgeID: domainResp.KnowledgeID,
        Metadata: map[string]interface{}{
            "ragflow_id": ragflowKB.ID,
            "ragflow_parser_id": ragflowKB.ParserID,
            "ragflow_embd_id": ragflowKB.EmbdID,
        },
    })
    if err != nil {
        logs.CtxErrorf(ctx, "update coze kb with ragflow info failed: %v", err)
        // 这里可以选择继续或回滚
    }
    
    // 4. 发布资源事件
    err = k.eventBus.PublishResources(ctx, &resourceEntity.ResourceDomainEvent{
        OpType: resourceEntity.Created,
        Resource: &resourceEntity.ResourceDocument{
            ResType:       resource.ResType_Knowledge,
            ResID:         domainResp.KnowledgeID,
            Name:          ptr.Of(req.Name),
            ResSubType:    ptr.Of(int32(req.FormatType)),
            SpaceID:       ptr.Of(req.SpaceID),
            APPID:         ptrAppID,
            OwnerID:       ptr.Of(*uid),
            PublishStatus: ptr.Of(resource.PublishStatus_Published),
            PublishTimeMS: ptr.Of(domainResp.CreatedAtMs),
            CreateTimeMS:  ptr.Of(domainResp.CreatedAtMs),
            UpdateTimeMS:  ptr.Of(domainResp.CreatedAtMs),
        },
    })
    if err != nil {
        logs.CtxErrorf(ctx, "publish resource event failed: %v", err)
    }
    
    return &dataset.CreateDatasetResponse{
        DatasetID: domainResp.KnowledgeID,
    }, nil
}

// CreateDocument 创建文档（集成 RAGFlow 解析）
func (k *KnowledgeApplicationService) CreateDocument(ctx context.Context, req *dataset.CreateDocumentRequest) (*dataset.CreateDocumentResponse, error) {
    uid := ctxutil.GetUIDFromCtx(ctx)
    if uid == nil {
        return nil, errorx.New(errno.ErrKnowledgePermissionCode, errorx.KV("msg", "session required"))
    }
    
    // 1. 获取知识库信息
    listResp, err := k.DomainSVC.ListKnowledge(ctx, &service.ListKnowledgeRequest{
        IDs: []int64{req.GetDatasetID()},
    })
    if err != nil || len(listResp.KnowledgeList) == 0 {
        return dataset.NewCreateDocumentResponse(), errors.New("knowledge not found")
    }
    knowledgeInfo := listResp.KnowledgeList[0]
    
    // 2. 获取 RAGFlow 知识库 ID
    ragflowKBID, ok := knowledgeInfo.Metadata["ragflow_id"].(string)
    if !ok || ragflowKBID == "" {
        return nil, errors.New("ragflow knowledge base not found")
    }
    
    resp := dataset.NewCreateDocumentResponse()
    resp.DocumentInfos = make([]*dataset.DocumentInfo, 0)
    
    // 3. 处理每个文档
    for _, docBase := range req.GetDocumentBases() {
        if docBase == nil {
            continue
        }
        
        // 3.1 创建 Coze 文档记录
        document := &entity.Document{
            Info: knowledge.Info{
                Name:      docBase.GetName(),
                CreatorID: *uid,
                SpaceID:   knowledgeInfo.SpaceID,
                AppID:     knowledgeInfo.AppID,
            },
            KnowledgeID:      req.GetDatasetID(),
            Type:             convertDocumentTypeDataset2Entity(req.GetFormatType()),
            RawContent:       docBase.GetSourceInfo().GetCustomContent(),
            URI:              docBase.GetSourceInfo().GetTosURI(),
            FileExtension:    parser.FileExtension(GetExtension(docBase.GetSourceInfo().GetTosURI())),
            Source:           getDocumentSource(docBase),
            IsAppend:         req.GetIsAppend(),
            ParsingStrategy:  convertParsingStrategy2Entity(req.GetParsingStrategy(), docBase.TableSheet, req.GetChunkStrategy().CaptionType, docBase.FilterStrategy),
            ChunkingStrategy: convertChunkingStrategy2Entity(req.GetChunkStrategy()),
            Status:          entity.DocumentStatusInit,
        }
        
        // 3.2 保存到 Coze 数据库
        createResp, err := k.DomainSVC.CreateDocument(ctx, &service.CreateDocumentRequest{
            Documents: []*entity.Document{document},
        })
        if err != nil {
            logs.CtxErrorf(ctx, "create coze document failed: %v", err)
            continue
        }
        
        cozeDoc := createResp.Documents[0]
        resp.DocumentInfos = append(resp.DocumentInfos, convertDocument2Model(cozeDoc))
        
        // 3.3 异步上传到 RAGFlow 并解析
        go k.processDocumentWithRAGFlow(context.Background(), cozeDoc, ragflowKBID, docBase)
    }
    
    return resp, nil
}

// processDocumentWithRAGFlow 异步处理文档
func (k *KnowledgeApplicationService) processDocumentWithRAGFlow(ctx context.Context, cozeDoc *entity.Document, ragflowKBID string, docBase *dataset.DocumentBase) {
    // 1. 更新文档状态为处理中
    k.DomainSVC.UpdateDocument(ctx, &service.UpdateDocumentRequest{
        DocumentID: cozeDoc.ID,
        Status:     ptr.Of(entity.DocumentStatusProcessing),
        StatusMsg:  ptr.Of("正在上传到 RAGFlow..."),
    })
    
    // 2. 准备文件内容
    var fileReader io.Reader
    var err error
    
    if cozeDoc.URI != "" {
        // 从存储中获取文件
        fileReader, err = k.storage.GetFile(ctx, cozeDoc.URI)
        if err != nil {
            k.handleDocumentError(ctx, cozeDoc.ID, fmt.Sprintf("获取文件失败: %v", err))
            return
        }
    } else if cozeDoc.RawContent != "" {
        // 使用原始内容
        fileReader = strings.NewReader(cozeDoc.RawContent)
    } else {
        k.handleDocumentError(ctx, cozeDoc.ID, "文档内容为空")
        return
    }
    
    // 3. 上传到 RAGFlow
    ragflowDoc, err := k.ragflowSvc.UploadDocument(ctx, &ragflow.UploadDocumentRequest{
        KnowledgeBaseID: ragflowKBID,
        File:           fileReader,
        FileName:       cozeDoc.Name,
        ParserID:       ragflow.GetParserIDByDocumentType(cozeDoc.Type),
        ParserConfig:   ragflow.GetParserConfigByStrategy(cozeDoc.ChunkingStrategy, cozeDoc.ParsingStrategy),
    })
    if err != nil {
        k.handleDocumentError(ctx, cozeDoc.ID, fmt.Sprintf("上传到 RAGFlow 失败: %v", err))
        return
    }
    
    // 4. 更新 Coze 文档，存储 RAGFlow 关联信息
    k.DomainSVC.UpdateDocument(ctx, &service.UpdateDocumentRequest{
        DocumentID: cozeDoc.ID,
        Status:     ptr.Of(entity.DocumentStatusProcessing),
        StatusMsg:  ptr.Of("RAGFlow 正在解析文档..."),
        Metadata: map[string]interface{}{
            "ragflow_doc_id": ragflowDoc.ID,
        },
    })
    
    // 5. 开始解析
    parseReq := &ragflow.ParseDocumentRequest{
        DocumentID: ragflowDoc.ID,
    }
    
    parseResult, err := k.ragflowSvc.ParseDocument(ctx, parseReq)
    if err != nil {
        k.handleDocumentError(ctx, cozeDoc.ID, fmt.Sprintf("RAGFlow 解析失败: %v", err))
        return
    }
    
    // 6. 轮询解析状态
    k.pollDocumentParseStatus(ctx, cozeDoc.ID, ragflowDoc.ID)
}

// pollDocumentParseStatus 轮询文档解析状态
func (k *KnowledgeApplicationService) pollDocumentParseStatus(ctx context.Context, cozeDocID int64, ragflowDocID string) {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    
    timeout := time.After(30 * time.Minute) // 30分钟超时
    
    for {
        select {
        case <-timeout:
            k.handleDocumentError(ctx, cozeDocID, "解析超时")
            return
            
        case <-ticker.C:
            status, err := k.ragflowSvc.GetDocumentStatus(ctx, ragflowDocID)
            if err != nil {
                logs.CtxErrorf(ctx, "get ragflow document status failed: %v", err)
                continue
            }
            
            switch status.Status {
            case "done":
                // 解析完成，获取分块结果
                k.handleDocumentParseComplete(ctx, cozeDocID, ragflowDocID)
                return
                
            case "failed":
                k.handleDocumentError(ctx, cozeDocID, fmt.Sprintf("RAGFlow 解析失败: %s", status.Message))
                return
                
            case "running":
                // 更新进度
                k.DomainSVC.UpdateDocument(ctx, &service.UpdateDocumentRequest{
                    DocumentID: cozeDocID,
                    StatusMsg:  ptr.Of(fmt.Sprintf("解析进度: %d%%", status.Progress)),
                })
                
            default:
                logs.CtxWarnf(ctx, "unknown ragflow document status: %s", status.Status)
            }
        }
    }
}

// handleDocumentParseComplete 处理文档解析完成
func (k *KnowledgeApplicationService) handleDocumentParseComplete(ctx context.Context, cozeDocID int64, ragflowDocID string) {
    // 1. 获取 RAGFlow 分块结果
    chunks, err := k.ragflowSvc.GetDocumentChunks(ctx, ragflowDocID)
    if err != nil {
        k.handleDocumentError(ctx, cozeDocID, fmt.Sprintf("获取分块结果失败: %v", err))
        return
    }
    
    // 2. 转换为 Coze 分片格式
    slices := ragflow.ConvertRAGFlowChunksToCoze(chunks, cozeDocID)
    
    // 3. 批量创建分片
    for _, slice := range slices {
        _, err := k.DomainSVC.CreateSlice(ctx, &service.CreateSliceRequest{
            DocumentID: cozeDocID,
            CreatorID:  ptr.Of(slice.CreatorID),
            Position:   slice.Sequence,
            RawContent: slice.RawContent,
        })
        if err != nil {
            logs.CtxErrorf(ctx, "create slice failed: %v", err)
        }
    }
    
    // 4. 更新文档状态为完成
    k.DomainSVC.UpdateDocument(ctx, &service.UpdateDocumentRequest{
        DocumentID: cozeDocID,
        Status:     ptr.Of(entity.DocumentStatusEnable),
        StatusMsg:  ptr.Of("解析完成"),
        SliceCount: len(slices),
        CharCount:  calculateTotalCharCount(slices),
    })
    
    logs.CtxInfof(ctx, "document parse completed, doc_id: %d, slices: %d", cozeDocID, len(slices))
}

// handleDocumentError 处理文档错误
func (k *KnowledgeApplicationService) handleDocumentError(ctx context.Context, cozeDocID int64, errorMsg string) {
    k.DomainSVC.UpdateDocument(ctx, &service.UpdateDocumentRequest{
        DocumentID: cozeDocID,
        Status:     ptr.Of(entity.DocumentStatusFailed),
        StatusMsg:  ptr.Of(errorMsg),
    })
    
    logs.CtxErrorf(ctx, "document process failed, doc_id: %d, error: %s", cozeDocID, errorMsg)
}
```

#### 2.2 增强检索功能

**智能检索服务**:
```go
// 新增检索服务
type EnhancedSearchService struct {
    ragflowSvc   ragflow.RAGFlowService
    knowledgeSvc service.Knowledge
}

// SearchKnowledge 增强的知识库检索
func (s *EnhancedSearchService) SearchKnowledge(ctx context.Context, req *SearchKnowledgeRequest) (*SearchKnowledgeResponse, error) {
    // 1. 获取知识库信息
    knowledge, err := s.knowledgeSvc.GetKnowledgeByID(ctx, &service.GetKnowledgeByIDRequest{
        KnowledgeID: req.KnowledgeID,
    })
    if err != nil {
        return nil, err
    }
    
    ragflowKBID, ok := knowledge.Knowledge.Metadata["ragflow_id"].(string)
    if !ok || ragflowKBID == "" {
        // 回退到原有检索逻辑
        return s.fallbackSearch(ctx, req)
    }
    
    // 2. 使用 RAGFlow 进行向量检索
    ragflowReq := &ragflow.SearchRequest{
        KnowledgeBaseID:     ragflowKBID,
        Question:           req.Query,
        TopK:               req.TopK,
        SimilarityThreshold: req.SimilarityThreshold,
        Keywords:           req.Keywords,
    }
    
    ragflowResp, err := s.ragflowSvc.SearchChunks(ctx, ragflowReq)
    if err != nil {
        logs.CtxErrorf(ctx, "ragflow search failed, fallback to original search: %v", err)
        return s.fallbackSearch(ctx, req)
    }
    
    // 3. 转换结果格式
    results := make([]*SearchResult, 0, len(ragflowResp.Chunks))
    for _, chunk := range ragflowResp.Chunks {
        result := &SearchResult{
            Content:    chunk.Content,
            Score:      chunk.Score,
            DocumentID: chunk.DocumentID,
            ChunkID:    chunk.ID,
            Positions:  chunk.Positions,
            Metadata:   chunk.Metadata,
        }
        results = append(results, result)
    }
    
    // 4. 混合排序（可选：结合关键词匹配分数）
    if req.EnableHybridSearch {
        results = s.hybridRanking(ctx, req.Query, results)
    }
    
    return &SearchKnowledgeResponse{
        Results:    results,
        Total:      len(results),
        QueryTime:  ragflowResp.QueryTime,
        SearchType: "vector+hybrid",
    }, nil
}

// hybridRanking 混合排序算法
func (s *EnhancedSearchService) hybridRanking(ctx context.Context, query string, vectorResults []*SearchResult) []*SearchResult {
    // 1. 计算关键词匹配分数
    keywords := extractKeywords(query)
    
    for _, result := range vectorResults {
        keywordScore := calculateKeywordScore(result.Content, keywords)
        // 混合分数：70% 向量相似度 + 30% 关键词匹配
        result.Score = result.Score*0.7 + keywordScore*0.3
    }
    
    // 2. 重新排序
    sort.Slice(vectorResults, func(i, j int) bool {
        return vectorResults[i].Score > vectorResults[j].Score
    })
    
    return vectorResults
}

// fallbackSearch 回退到原有检索逻辑
func (s *EnhancedSearchService) fallbackSearch(ctx context.Context, req *SearchKnowledgeRequest) (*SearchKnowledgeResponse, error) {
    // 使用原有的 Coze 检索逻辑
    // 这里调用原有的检索方法
    return nil, errors.New("fallback search not implemented")
}
```

### 阶段三：高级功能和监控 (2-3 周)

#### 3.1 缓存和性能优化

**Redis 缓存层**:
```go
package cache

import (
    "context"
    "encoding/json"
    "fmt"
    "time"
    
    "github.com/go-redis/redis/v8"
)

type RAGFlowCache struct {
    client *redis.Client
    ttl    time.Duration
}

func NewRAGFlowCache(client *redis.Client, ttl time.Duration) *RAGFlowCache {
    return &RAGFlowCache{
        client: client,
        ttl:    ttl,
    }
}

// CacheSearchResult 缓存搜索结果
func (c *RAGFlowCache) CacheSearchResult(ctx context.Context, query string, kbID string, result *SearchKnowledgeResponse) error {
    key := c.getSearchKey(query, kbID)
    
    data, err := json.Marshal(result)
    if err != nil {
        return fmt.Errorf("marshal search result failed: %w", err)
    }
    
    return c.client.Set(ctx, key, data, c.ttl).Err()
}

// GetSearchResult 获取缓存的搜索结果
func (c *RAGFlowCache) GetSearchResult(ctx context.Context, query string, kbID string) (*SearchKnowledgeResponse, error) {
    key := c.getSearchKey(query, kbID)
    
    data, err := c.client.Get(ctx, key).Result()
    if err != nil {
        if err == redis.Nil {
            return nil, nil // 缓存未命中
        }
        return nil, fmt.Errorf("get cached search result failed: %w", err)
    }
    
    var result SearchKnowledgeResponse
    if err := json.Unmarshal([]byte(data), &result); err != nil {
        return nil, fmt.Errorf("unmarshal cached search result failed: %w", err)
    }
    
    return &result, nil
}

func (c *RAGFlowCache) getSearchKey(query, kbID string) string {
    return fmt.Sprintf("ragflow:search:%s:%s", kbID, hashString(query))
}

// InvalidateKBCache 清除知识库相关缓存
func (c *RAGFlowCache) InvalidateKBCache(ctx context.Context, kbID string) error {
    pattern := fmt.Sprintf("ragflow:search:%s:*", kbID)
    
    keys, err := c.client.Keys(ctx, pattern).Result()
    if err != nil {
        return fmt.Errorf("get cache keys failed: %w", err)
    }
    
    if len(keys) > 0 {
        return c.client.Del(ctx, keys...).Err()
    }
    
    return nil
}
```

**连接池和重试机制**:
```go
package ragflow

import (
    "context"
    "fmt"
    "time"
    
    "github.com/cenkalti/backoff/v4"
)

// WithRetry 添加重试机制的装饰器
func (c *Client) WithRetry(operation func() error) error {
    backoffConfig := backoff.NewExponentialBackOff()
    backoffConfig.InitialInterval = 1 * time.Second
    backoffConfig.MaxInterval = 10 * time.Second
    backoffConfig.MaxElapsedTime = 1 * time.Minute
    
    return backoff.Retry(operation, backoffConfig)
}

// SearchChunksWithRetry 带重试的搜索
func (c *Client) SearchChunksWithRetry(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
    var result *SearchResponse
    var lastErr error
    
    operation := func() error {
        var err error
        result, err = c.SearchChunks(ctx, req)
        if err != nil {
            lastErr = err
            // 判断是否为可重试错误
            if isRetryableError(err) {
                return err
            }
            return backoff.Permanent(err)
        }
        return nil
    }
    
    if err := c.WithRetry(operation); err != nil {
        return nil, fmt.Errorf("search with retry failed: %w", lastErr)
    }
    
    return result, nil
}

func isRetryableError(err error) bool {
    // 判断错误是否可重试
    // 网络错误、超时错误、5xx 服务器错误等
    return true // 简化实现
}
```

#### 3.2 监控和指标

**监控指标收集**:
```go
package monitoring

import (
    "context"
    "time"
    
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    // RAGFlow API 调用指标
    ragflowRequestTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "ragflow_requests_total",
            Help: "Total number of RAGFlow API requests",
        },
        []string{"method", "status"},
    )
    
    ragflowRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "ragflow_request_duration_seconds",
            Help:    "RAGFlow API request duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method"},
    )
    
    // 文档处理指标
    documentProcessTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "document_process_total",
            Help: "Total number of documents processed",
        },
        []string{"status", "parser_type"},
    )
    
    documentProcessDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "document_process_duration_seconds",
            Help:    "Document processing duration",
            Buckets: []float64{1, 5, 10, 30, 60, 300, 600, 1800},
        },
        []string{"parser_type"},
    )
    
    // 搜索指标
    searchRequestTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "search_requests_total",
            Help: "Total number of search requests",
        },
        []string{"search_type", "cached"},
    )
    
    searchRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "search_request_duration_seconds",
            Help:    "Search request duration",
            Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5},
        },
        []string{"search_type"},
    )
)

// MetricsCollector 指标收集器
type MetricsCollector struct{}

func NewMetricsCollector() *MetricsCollector {
    return &MetricsCollector{}
}

// RecordRAGFlowRequest 记录 RAGFlow API 请求指标
func (m *MetricsCollector) RecordRAGFlowRequest(method string, duration time.Duration, err error) {
    status := "success"
    if err != nil {
        status = "error"
    }
    
    ragflowRequestTotal.WithLabelValues(method, status).Inc()
    ragflowRequestDuration.WithLabelValues(method).Observe(duration.Seconds())
}

// RecordDocumentProcess 记录文档处理指标
func (m *MetricsCollector) RecordDocumentProcess(parserType string, duration time.Duration, err error) {
    status := "success"
    if err != nil {
        status = "error"
    }
    
    documentProcessTotal.WithLabelValues(status, parserType).Inc()
    documentProcessDuration.WithLabelValues(parserType).Observe(duration.Seconds())
}

// RecordSearchRequest 记录搜索请求指标
func (m *MetricsCollector) RecordSearchRequest(searchType string, duration time.Duration, cached bool) {
    cachedStr := "false"
    if cached {
        cachedStr = "true"
    }
    
    searchRequestTotal.WithLabelValues(searchType, cachedStr).Inc()
    searchRequestDuration.WithLabelValues(searchType).Observe(duration.Seconds())
}
```

**健康检查**:
```go
package health

import (
    "context"
    "fmt"
    "time"
)

type HealthChecker struct {
    ragflowSvc ragflow.RAGFlowService
}

func NewHealthChecker(ragflowSvc ragflow.RAGFlowService) *HealthChecker {
    return &HealthChecker{
        ragflowSvc: ragflowSvc,
    }
}

// CheckRAGFlowHealth 检查 RAGFlow 服务健康状态
func (h *HealthChecker) CheckRAGFlowHealth(ctx context.Context) error {
    // 简单的健康检查：获取知识库列表
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    _, err := h.ragflowSvc.ListKnowledgeBases(ctx, &ragflow.ListKBRequest{
        Page: 1,
        Size: 1,
    })
    
    if err != nil {
        return fmt.Errorf("ragflow health check failed: %w", err)
    }
    
    return nil
}

// HealthCheckResult 健康检查结果
type HealthCheckResult struct {
    Service   string    `json:"service"`
    Status    string    `json:"status"`
    Timestamp time.Time `json:"timestamp"`
    Error     string    `json:"error,omitempty"`
}

// GetHealthStatus 获取整体健康状态
func (h *HealthChecker) GetHealthStatus(ctx context.Context) []HealthCheckResult {
    results := []HealthCheckResult{}
    
    // 检查 RAGFlow 服务
    ragflowErr := h.CheckRAGFlowHealth(ctx)
    ragflowStatus := "healthy"
    ragflowErrMsg := ""
    if ragflowErr != nil {
        ragflowStatus = "unhealthy"
        ragflowErrMsg = ragflowErr.Error()
    }
    
    results = append(results, HealthCheckResult{
        Service:   "ragflow",
        Status:    ragflowStatus,
        Timestamp: time.Now(),
        Error:     ragflowErrMsg,
    })
    
    return results
}
```

#### 3.3 配置文件更新

**应用配置**:
```yaml
# config/application.yml
ragflow:
  base_url: "http://ragflow:9380"
  api_key: "${RAGFLOW_API_KEY}"
  timeout: 30s
  max_retries: 3
  retry_delay: 1s
  
  # 缓存配置
  cache:
    enabled: true
    ttl: 5m
    redis_url: "redis://redis:6379"
  
  # 默认配置
  defaults:
    embd_id: "BAAI/bge-base-zh-v1.5"
    language: "zh"
    chunk_size: 128
    parser_id: "naive"
  
  # 性能配置
  performance:
    max_concurrent_requests: 10
    connection_pool_size: 20
    
  # 监控配置
  monitoring:
    enabled: true
    metrics_path: "/metrics"
    health_check_interval: 30s
```

**环境变量**:
```bash
# .env
RAGFLOW_API_KEY=your_ragflow_api_key
RAGFLOW_BASE_URL=http://localhost:9380
RAGFLOW_CACHE_ENABLED=true
RAGFLOW_CACHE_TTL=300
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
```

### 部署和运维

#### Docker Compose 完整配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Coze 后端
  coze-backend:
    build: 
      context: ./coze-studio/backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - RAGFLOW_BASE_URL=http://ragflow:9380
      - RAGFLOW_API_KEY=${RAGFLOW_API_KEY}
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://coze:password@postgres:5432/coze
    depends_on:
      - postgres
      - redis
      - ragflow
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    networks:
      - coze-network

  # RAGFlow 服务
  ragflow:
    image: infiniflow/ragflow:latest
    container_name: coze-ragflow
    ports:
      - "9380:9380"
    environment:
      - DATABASE_URL=postgresql://ragflow:password@postgres:5432/ragflow
      - REDIS_URL=redis://redis:6379
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - INFINIGENCE_API_KEY=${INFINIGENCE_API_KEY}
    volumes:
      - ragflow_data:/ragflow/data
      - ./ragflow/conf:/ragflow/conf
    depends_on:
      - postgres
      - redis
      - elasticsearch
    networks:
      - coze-network

  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.5.0
    container_name: coze-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    networks:
      - coze-network

  # PostgreSQL
  postgres:
    image: postgres:14
    container_name: coze-postgres
    environment:
      - POSTGRES_MULTIPLE_DATABASES=coze,ragflow
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init-databases.sql
    networks:
      - coze-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: coze-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - coze-network

  # Prometheus (监控)
  prometheus:
    image: prom/prometheus:latest
    container_name: coze-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - coze-network

  # Grafana (可视化)
  grafana:
    image: grafana/grafana:latest
    container_name: coze-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - coze-network

volumes:
  ragflow_data:
  es_data:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  coze-network:
    driver: bridge
```

#### 监控配置

**Prometheus 配置** (`monitoring/prometheus.yml`):
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'coze-backend'
    static_configs:
      - targets: ['coze-backend:8080']
    metrics_path: '/metrics'
    
  - job_name: 'ragflow'
    static_configs:
      - targets: ['ragflow:9380']
    metrics_path: '/metrics'
```

**Grafana 仪表板配置**:
```json
{
  "dashboard": {
    "title": "Coze-RAGFlow Integration Dashboard",
    "panels": [
      {
        "title": "RAGFlow API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ragflow_requests_total[5m])",
            "legendFormat": "{{method}} - {{status}}"
          }
        ]
      },
      {
        "title": "Document Processing Duration",
        "type": "histogram",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(document_process_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Search Request Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(search_requests_total[5m])",
            "legendFormat": "{{search_type}} - cached:{{cached}}"
          }
        ]
      }
    ]
  }
}
```

### 迁移和测试策略

#### 数据迁移脚本

```go
package migration

import (
    "context"
    "fmt"
    "log"
    
    "github.com/coze-dev/coze-studio/backend/domain/knowledge/service"
)

// MigrationService 数据迁移服务
type MigrationService struct {
    knowledgeSvc service.Knowledge
    ragflowSvc   ragflow.RAGFlowService
}

// MigrateExistingKnowledgeBases 迁移现有知识库到 RAGFlow
func (m *MigrationService) MigrateExistingKnowledgeBases(ctx context.Context) error {
    log.Println("开始迁移现有知识库...")
    
    // 1. 获取所有现有知识库
    kbList, err := m.knowledgeSvc.ListAllKnowledgeBases(ctx)
    if err != nil {
        return fmt.Errorf("获取知识库列表失败: %w", err)
    }
    
    for _, kb := range kbList {
        log.Printf("迁移知识库: %s (ID: %d)", kb.Name, kb.ID)
        
        // 2. 在 RAGFlow 中创建对应知识库
        ragflowKB, err := m.ragflowSvc.CreateKnowledgeBase(ctx, &ragflow.CreateKBRequest{
            Name:        kb.Name + "_migrated",
            Description: kb.Description,
            Language:    "zh",
            EmbdID:      "BAAI/bge-base-zh-v1.5",
        })
        if err != nil {
            log.Printf("创建 RAGFlow 知识库失败: %v", err)
            continue
        }
        
        // 3. 更新 Coze 知识库元数据
        err = m.knowledgeSvc.UpdateKnowledge(ctx, &service.UpdateKnowledgeRequest{
            KnowledgeID: kb.ID,
            Metadata: map[string]interface{}{
                "ragflow_id": ragflowKB.ID,
                "migrated_at": time.Now(),
            },
        })
        if err != nil {
            log.Printf("更新知识库元数据失败: %v", err)
        }
        
        // 4. 迁移文档（可选，也可以懒加载）
        err = m.migrateDocuments(ctx, kb.ID, ragflowKB.ID)
        if err != nil {
            log.Printf("迁移文档失败: %v", err)
        }
    }
    
    log.Println("知识库迁移完成")
    return nil
}
```

#### 集成测试

```go
package integration_test

import (
    "context"
    "testing"
    "time"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestRAGFlowIntegration(t *testing.T) {
    // 设置测试环境
    ctx := context.Background()
    testService := setupTestService(t)
    
    t.Run("创建知识库集成测试", func(t *testing.T) {
        // 创建知识库
        req := &dataset.CreateDatasetRequest{
            Name:        "测试知识库",
            Description: "集成测试知识库",
            FormatType:  dataset.FormatType_Text,
        }
        
        resp, err := testService.CreateKnowledge(ctx, req)
        require.NoError(t, err)
        assert.NotZero(t, resp.DatasetID)
        
        // 验证 RAGFlow 中是否创建成功
        kb, err := testService.GetKnowledge(ctx, resp.DatasetID)
        require.NoError(t, err)
        assert.Contains(t, kb.Metadata, "ragflow_id")
    })
    
    t.Run("文档上传和解析测试", func(t *testing.T) {
        // 创建知识库
        kbResp := createTestKnowledgeBase(t, testService)
        
        // 上传文档
        docReq := &dataset.CreateDocumentRequest{
            DatasetID: kbResp.DatasetID,
            DocumentBases: []*dataset.DocumentBase{{
                Name: "test.txt",
                SourceInfo: &dataset.SourceInfo{
                    CustomContent: ptr.Of("这是一个测试文档内容。包含多个句子用于测试分块功能。"),
                },
            }},
            FormatType: dataset.FormatType_Text,
        }
        
        docResp, err := testService.CreateDocument(ctx, docReq)
        require.NoError(t, err)
        assert.Len(t, docResp.DocumentInfos, 1)
        
        // 等待解析完成
        documentID := docResp.DocumentInfos[0].DocumentID
        assert.Eventually(t, func() bool {
            doc, err := testService.GetDocument(ctx, documentID)
            return err == nil && doc.Status == dataset.DocumentStatus_Enable
        }, 30*time.Second, 1*time.Second)
        
        // 验证分片是否创建
        slices, err := testService.ListSlices(ctx, kbResp.DatasetID, documentID)
        require.NoError(t, err)
        assert.NotEmpty(t, slices.Slices)
    })
    
    t.Run("搜索功能测试", func(t *testing.T) {
        // 使用已有的知识库和文档
        kbResp := createTestKnowledgeBase(t, testService)
        uploadTestDocument(t, testService, kbResp.DatasetID)
        
        // 等待索引完成
        time.Sleep(5 * time.Second)
        
        // 搜索测试
        searchResp, err := testService.SearchKnowledge(ctx, &SearchKnowledgeRequest{
            KnowledgeID: kbResp.DatasetID,
            Query:       "测试",
            TopK:        5,
        })
        require.NoError(t, err)
        assert.NotEmpty(t, searchResp.Results)
        assert.Greater(t, searchResp.Results[0].Score, 0.0)
    })
}

func setupTestService(t *testing.T) *KnowledgeApplicationService {
    // 设置测试环境，包括数据库、RAGFlow 等
    // 这里简化实现
    return &KnowledgeApplicationService{}
}
```

### 总结

这个完整的实现方案包括：

1. **架构设计**：微服务 API 网关方式，保持系统独立性
2. **分阶段实施**：基础集成 → 核心功能 → 高级优化
3. **完整的代码实现**：Go 客户端、数据转换、异步处理
4. **性能优化**：缓存、连接池、重试机制
5. **监控运维**：指标收集、健康检查、日志聚合
6. **部署方案**：Docker Compose、配置管理
7. **测试策略**：集成测试、迁移脚本

通过这个方案，Coze 可以获得 RAGFlow 的强大能力，包括：
- 多种文档解析器支持
- 智能分块策略
- 高性能向量检索
- 混合搜索能力

同时保持系统的稳定性和可维护性。
