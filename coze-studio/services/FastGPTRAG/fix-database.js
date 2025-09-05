import { Client } from './node_modules/@types/pg';

async function fixDatabase() {
  const client = new Client({
    connectionString: 'postgresql://postgres:whpp6mqd@dbconn.sealosgzg.site:44414/?directConnection=true',
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    query_timeout: 60000
  });

  try {
    console.log('🔗 连接到 PostgreSQL...');
    await client.connect();
    
    console.log('🗑️ 删除现有的vectors表...');
    await client.query('DROP TABLE IF EXISTS vectors CASCADE;');
    
    console.log('🏗️ 创建新的vectors表 (1024维)...');
    await client.query(`
      CREATE TABLE vectors (
        id TEXT PRIMARY KEY,
        vector vector(1024),
        metadata JSONB,
        team_id TEXT,
        dataset_id TEXT,
        collection_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('📊 创建索引...');
    await client.query('CREATE INDEX ON vectors USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);');
    await client.query('CREATE INDEX ON vectors (team_id, dataset_id, collection_id);');
    
    console.log('✅ 数据库修复完成！向量表现在是1024维。');
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await client.end();
  }
}

fixDatabase();
