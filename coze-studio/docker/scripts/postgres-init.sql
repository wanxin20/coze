-- PostgreSQL初始化脚本
-- 为FastGPTRAG创建pgvector扩展和表

-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建向量数据表
CREATE TABLE IF NOT EXISTS vectors (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL,
    collection_id VARCHAR(50) NOT NULL,
    data_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding维度
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_vectors_dataset_id ON vectors(dataset_id);
CREATE INDEX IF NOT EXISTS idx_vectors_collection_id ON vectors(collection_id);
CREATE INDEX IF NOT EXISTS idx_vectors_data_id ON vectors(data_id);
CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);

-- 创建向量相似度搜索索引
CREATE INDEX IF NOT EXISTS idx_vectors_embedding ON vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_vectors_content_fts ON vectors USING gin(to_tsvector('english', content));

-- 创建向量数据集表
CREATE TABLE IF NOT EXISTS vector_datasets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    team_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    vector_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    agent_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    dimension INTEGER DEFAULT 1536,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量集合表
CREATE TABLE IF NOT EXISTS vector_collections (
    id VARCHAR(50) PRIMARY KEY,
    dataset_id VARCHAR(50) NOT NULL REFERENCES vector_datasets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'file',
    file_url TEXT,
    raw_text TEXT,
    training_type VARCHAR(50) DEFAULT 'chunk',
    chunk_size INTEGER DEFAULT 512,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建训练任务表
CREATE TABLE IF NOT EXISTS training_jobs (
    id VARCHAR(50) PRIMARY KEY,
    collection_id VARCHAR(50) NOT NULL REFERENCES vector_collections(id) ON DELETE CASCADE,
    team_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress DECIMAL(5,2) DEFAULT 0.00,
    error_message TEXT,
    processed_chunks INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建使用统计表
CREATE TABLE IF NOT EXISTS usage_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    team_id VARCHAR(50),
    search_count INTEGER DEFAULT 0,
    embedding_tokens INTEGER DEFAULT 0,
    llm_tokens INTEGER DEFAULT 0,
    avg_response_time DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, team_id)
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO system_config (key, value, description) VALUES 
('embedding_models', '["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"]', '可用的嵌入模型列表'),
('llm_models', '["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]', '可用的LLM模型列表'),
('rerank_models', '["bge-reranker-base", "bge-reranker-large", "cohere-rerank-multilingual"]', '可用的重排序模型列表'),
('default_settings', '{"chunk_size": 512, "similarity_threshold": 0.6, "search_limit": 10}', '默认设置'),
('feature_flags', '{"enable_rerank": true, "enable_query_extension": true, "enable_deep_search": true}', '功能开关')
ON CONFLICT (key) DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表创建更新时间触发器
CREATE TRIGGER update_vectors_updated_at BEFORE UPDATE ON vectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vector_datasets_updated_at BEFORE UPDATE ON vector_datasets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vector_collections_updated_at BEFORE UPDATE ON vector_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_jobs_updated_at BEFORE UPDATE ON training_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usage_statistics_updated_at BEFORE UPDATE ON usage_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建向量相似度搜索函数
CREATE OR REPLACE FUNCTION search_vectors(
    query_embedding VECTOR(1536),
    dataset_filter VARCHAR(50) DEFAULT NULL,
    collection_filter VARCHAR(50) DEFAULT NULL,
    similarity_threshold DECIMAL(3,2) DEFAULT 0.6,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id INTEGER,
    dataset_id VARCHAR(50),
    collection_id VARCHAR(50),
    data_id VARCHAR(50),
    content TEXT,
    similarity DECIMAL(10,6),
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.dataset_id,
        v.collection_id,
        v.data_id,
        v.content,
        (1 - (v.embedding <=> query_embedding))::DECIMAL(10,6) AS similarity,
        v.metadata
    FROM vectors v
    WHERE 
        (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
        AND (collection_filter IS NULL OR v.collection_id = collection_filter)
        AND (1 - (v.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY v.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- 创建混合搜索函数（向量搜索 + 全文搜索）
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding VECTOR(1536),
    dataset_filter VARCHAR(50) DEFAULT NULL,
    collection_filter VARCHAR(50) DEFAULT NULL,
    similarity_threshold DECIMAL(3,2) DEFAULT 0.6,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id INTEGER,
    dataset_id VARCHAR(50),
    collection_id VARCHAR(50),
    data_id VARCHAR(50),
    content TEXT,
    vector_similarity DECIMAL(10,6),
    text_similarity DECIMAL(10,6),
    combined_score DECIMAL(10,6),
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            v.id,
            v.dataset_id,
            v.collection_id,
            v.data_id,
            v.content,
            (1 - (v.embedding <=> query_embedding))::DECIMAL(10,6) AS vector_sim,
            v.metadata
        FROM vectors v
        WHERE 
            (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
            AND (collection_filter IS NULL OR v.collection_id = collection_filter)
            AND (1 - (v.embedding <=> query_embedding)) >= similarity_threshold
    ),
    text_results AS (
        SELECT 
            v.id,
            ts_rank_cd(to_tsvector('english', v.content), plainto_tsquery('english', query_text))::DECIMAL(10,6) AS text_sim
        FROM vectors v
        WHERE 
            (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
            AND (collection_filter IS NULL OR v.collection_id = collection_filter)
            AND to_tsvector('english', v.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT 
        vr.id,
        vr.dataset_id,
        vr.collection_id,
        vr.data_id,
        vr.content,
        vr.vector_sim,
        COALESCE(tr.text_sim, 0.0) AS text_similarity,
        (vr.vector_sim * 0.7 + COALESCE(tr.text_sim, 0.0) * 0.3)::DECIMAL(10,6) AS combined_score,
        vr.metadata
    FROM vector_results vr
    LEFT JOIN text_results tr ON vr.id = tr.id
    ORDER BY combined_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- 创建数据清理函数
CREATE OR REPLACE FUNCTION cleanup_old_usage_stats(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM usage_statistics 
    WHERE date < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE coze_rag IS 'FastGPTRAG微服务向量数据库';
COMMENT ON TABLE vectors IS '向量数据表，存储文档块和对应的向量嵌入';
COMMENT ON TABLE vector_datasets IS '向量数据集表';
COMMENT ON TABLE vector_collections IS '向量集合表';
COMMENT ON TABLE training_jobs IS '训练任务表';
COMMENT ON TABLE usage_statistics IS '使用统计表';
COMMENT ON TABLE system_config IS '系统配置表';

-- 创建数据库用户权限
-- CREATE USER raguser WITH PASSWORD 'ragpassword';
-- GRANT ALL PRIVILEGES ON DATABASE coze_rag TO raguser;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO raguser;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO raguser;
