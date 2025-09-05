include "../../base.thrift"
include "common.thrift"
include "knowledge.thrift"

namespace go data.knowledge.rag

// ========== RAG Search Related ==========

struct RagSearchRequest {
    1: required i64 dataset_id (agw.js_conv="str", api.js_conv="true")  // 知识库ID
    2: required string text                                              // 查询文本
    3: optional i32 limit = 10                                          // 结果数量限制
    4: optional double similarity = 0.6                                  // 相似度阈值
    5: optional string search_mode = "mixedRecall"                       // 搜索模式: embedding, fullText, mixedRecall
    6: optional bool using_re_rank = false                               // 是否使用重排序
    7: optional string rerank_model = "bge-reranker-base"                // 重排序模型
    8: optional bool dataset_search_using_extension_query = false        // 是否使用查询扩展
    9: optional string dataset_search_extension_model = "gpt-4o-mini"    // 查询扩展模型
    10: optional list<string> collection_ids                             // 指定集合ID列表
    11: optional map<string, string> filters                             // 高级过滤条件

    255: optional base.Base Base
}

struct RagSearchResponse {
    1: list<RagSearchItem> search_results                                // 搜索结果列表
    2: i32 total                                                         // 总结果数
    3: string search_mode                                                // 实际使用的搜索模式
    4: i32 embedding_tokens                                              // 嵌入向量消耗token数
    5: i32 rerank_input_tokens                                           // 重排序输入token数
    6: string duration                                                   // 搜索耗时
    7: optional string query_extension_result                            // 查询扩展结果
    8: optional map<string, string> deep_search_result                   // 深度搜索结果

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct RagSearchItem {
    1: string id                                                         // 文档片段ID
    2: string content                                                    // 文档内容
    3: double score                                                      // 相关性得分
    4: string collection_id                                              // 所属集合ID
    5: string collection_name                                            // 集合名称
    6: optional map<string, string> metadata                             // 元数据信息
    7: optional string source_name                                       // 来源文件名
    8: optional i32 chunk_index                                          // 文档块索引
}

// ========== Deep Search Related ==========

struct DeepSearchRequest {
    1: required i64 dataset_id (agw.js_conv="str", api.js_conv="true")  // 知识库ID
    2: required string text                                              // 查询文本
    3: optional i32 max_iterations = 3                                   // 最大迭代次数
    4: optional string model = "gpt-4o-mini"                             // 使用的LLM模型
    5: optional i32 limit = 10                                          // 每次搜索结果数量
    6: optional double similarity = 0.6                                  // 相似度阈值

    255: optional base.Base Base
}

struct DeepSearchResponse {
    1: list<RagSearchItem> final_results                                 // 最终搜索结果
    2: list<DeepSearchIteration> iterations                              // 迭代过程详情
    3: i32 total_tokens                                                  // 总消耗token数
    4: string duration                                                   // 总耗时

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct DeepSearchIteration {
    1: i32 iteration_index                                               // 迭代索引
    2: string expanded_query                                             // 扩展后的查询
    3: list<RagSearchItem> iteration_results                             // 本次迭代结果
    4: i32 tokens_used                                                   // 本次迭代消耗token
}

// ========== RAG Dataset Management ==========

struct CreateRagDatasetRequest {
    1: required string name                                              // 数据集名称
    2: optional string description                                       // 数据集描述
    3: required string team_id                                           // 团队ID
    4: required string user_id                                           // 用户ID
    5: optional string vector_model = "text-embedding-3-small"           // 向量模型
    6: optional string agent_model = "gpt-4o-mini"                       // Agent模型

    255: optional base.Base Base
}

struct CreateRagDatasetResponse {
    1: string dataset_id                                                 // RAG数据集ID

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct SyncDatasetToRagRequest {
    1: required i64 coze_dataset_id (agw.js_conv="str", api.js_conv="true")  // Coze知识库ID
    2: required string rag_dataset_id                                         // RAG数据集ID
    3: optional bool force_sync = false                                       // 是否强制同步

    255: optional base.Base Base
}

struct SyncDatasetToRagResponse {
    1: string sync_job_id                                                // 同步任务ID
    2: i32 synced_documents                                              // 已同步文档数量

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

// ========== RAG Collection Management ==========

struct CreateRagCollectionRequest {
    1: required string dataset_id                                        // RAG数据集ID
    2: required string name                                              // 集合名称
    3: required string collection_type = "file"                          // 集合类型: file, text, url
    4: optional string file_url                                          // 文件URL
    5: optional string raw_text                                          // 原始文本
    6: optional string training_type = "chunk"                           // 训练类型
    7: optional i32 chunk_size = 512                                     // 分块大小

    255: optional base.Base Base
}

struct CreateRagCollectionResponse {
    1: string collection_id                                              // 集合ID
    2: string training_job_id                                            // 训练任务ID

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

// ========== RAG Monitoring ==========

struct GetRagHealthRequest {
    255: optional base.Base Base
}

struct GetRagHealthResponse {
    1: string status                                                     // 服务状态: ok, error
    2: string version                                                    // 版本信息
    3: i64 timestamp                                                     // 时间戳
    4: map<string, string> components                                    // 组件状态

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct GetRagUsageStatsRequest {
    1: optional string period = "daily"                                  // 统计周期: daily, weekly, monthly
    2: optional i32 limit = 30                                          // 返回记录数量

    255: optional base.Base Base
}

struct GetRagUsageStatsResponse {
    1: list<RagUsageRecord> usage_records                               // 使用记录
    2: RagUsageSummary summary                                          // 使用汇总

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct RagUsageRecord {
    1: string date                                                       // 日期
    2: i32 search_count                                                  // 搜索次数
    3: i32 embedding_tokens                                              // 嵌入token消耗
    4: i32 llm_tokens                                                    // LLM token消耗
    5: double avg_response_time                                          // 平均响应时间
}

struct RagUsageSummary {
    1: i32 total_searches                                                // 总搜索次数
    2: i32 total_embedding_tokens                                        // 总嵌入token
    3: i32 total_llm_tokens                                              // 总LLM token
    4: double avg_response_time                                          // 平均响应时间
}

// ========== RAG Training Jobs ==========

struct StartRagTrainingRequest {
    1: required string collection_id                                     // 集合ID
    2: required string team_id                                           // 团队ID
    3: required string user_id                                           // 用户ID
    4: optional string training_mode = "chunk"                           // 训练模式

    255: optional base.Base Base
}

struct StartRagTrainingResponse {
    1: string training_job_id                                            // 训练任务ID

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

struct GetRagTrainingStatusRequest {
    1: required string training_job_id                                   // 训练任务ID

    255: optional base.Base Base
}

struct GetRagTrainingStatusResponse {
    1: string status                                                     // 任务状态: pending, running, completed, failed
    2: double progress                                                   // 进度百分比
    3: optional string error_message                                     // 错误信息
    4: optional i32 processed_chunks                                     // 已处理块数
    5: optional i32 total_chunks                                         // 总块数

    253: required i64 code
    254: required string msg
    255: optional base.BaseResp BaseResp
}

// ========== Service Definition ==========

service RagService {
    // Search APIs
    RagSearchResponse RagSearch(1: RagSearchRequest req) (api.post='/api/knowledge/rag/search', api.category="knowledge", agw.preserve_base="true")
    DeepSearchResponse DeepSearch(1: DeepSearchRequest req) (api.post='/api/knowledge/rag/search/deep', api.category="knowledge", agw.preserve_base="true")
    
    // Dataset Management
    CreateRagDatasetResponse CreateRagDataset(1: CreateRagDatasetRequest req) (api.post='/api/knowledge/rag/dataset/create', api.category="knowledge", agw.preserve_base="true")
    SyncDatasetToRagResponse SyncDatasetToRag(1: SyncDatasetToRagRequest req) (api.post='/api/knowledge/rag/dataset/sync', api.category="knowledge", agw.preserve_base="true")
    
    // Collection Management  
    CreateRagCollectionResponse CreateRagCollection(1: CreateRagCollectionRequest req) (api.post='/api/knowledge/rag/collection/create', api.category="knowledge", agw.preserve_base="true")
    
    // Training Management
    StartRagTrainingResponse StartRagTraining(1: StartRagTrainingRequest req) (api.post='/api/knowledge/rag/training/start', api.category="knowledge", agw.preserve_base="true")
    GetRagTrainingStatusResponse GetRagTrainingStatus(1: GetRagTrainingStatusRequest req) (api.get='/api/knowledge/rag/training/status', api.category="knowledge", agw.preserve_base="true")
    
    // Monitoring APIs
    GetRagHealthResponse GetRagHealth(1: GetRagHealthRequest req) (api.get='/api/knowledge/rag/health', api.category="knowledge", agw.preserve_base="true")
    GetRagUsageStatsResponse GetRagUsageStats(1: GetRagUsageStatsRequest req) (api.get='/api/knowledge/rag/usage', api.category="knowledge", agw.preserve_base="true")
}
