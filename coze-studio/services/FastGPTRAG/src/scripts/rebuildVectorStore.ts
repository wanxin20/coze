import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// 硬编码数据库配置
const MONGO_URL = 'mongodb://root:nb72dlqg@dbconn.sealosgzg.site:41447/?directConnection=true';
const PG_URL = 'postgresql://postgres:whpp6mqd@dbconn.sealosgzg.site:44414/?directConnection=true';

async function rebuildVectorStore() {
  try {
    logger.info('🔧 Starting vector store rebuild...');

    // 直接连接MongoDB
    await mongoose.connect(MONGO_URL, {
      bufferCommands: false
    });
    logger.info('✅ MongoDB connected');

    // Connect to PostgreSQL if configured
    if (PG_URL) {
      const { Client } = await import('pg');
      const client = new Client(PG_URL);
      await client.connect();
      
      logger.info('📋 Checking existing vectors table...');
      
      // Check if table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vectors'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        logger.info('🗑️ Dropping existing vectors table...');
        await client.query('DROP TABLE vectors');
      }
      
      // Create new table with correct dimensions
      logger.info('🏗️ Creating new vectors table with 1024 dimensions...');
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
      
      // Create indexes
      await client.query(`
        CREATE INDEX idx_vectors_team_dataset 
        ON vectors(team_id, dataset_id)
      `);
      await client.query(`
        CREATE INDEX idx_vectors_collection 
        ON vectors(collection_id)
      `);
      await client.query(`
        CREATE INDEX idx_vectors_vector 
        ON vectors USING ivfflat (vector vector_cosine_ops) WITH (lists = 100)
      `);
      
      await client.end();
      logger.info('✅ PostgreSQL vectors table rebuilt successfully');
    }
    
    // Handle Milvus if configured (跳过Milvus，使用PostgreSQL)
    // if (MILVUS_URL) {
    //   try {
    //     const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
    //     
    //     const client = new MilvusClient({
    //       address: MILVUS_URL,
    //       username: '',
    //       password: ''
    //     });

    //     const collectionName = 'fastgpt_vectors';
    //     
    //     // Check if collection exists
    //     const hasCollection = await client.hasCollection({
    //       collection_name: collectionName
    //     });

    //     if (hasCollection.value) {
    //       logger.info('🗑️ Dropping existing Milvus collection...');
    //       await client.dropCollection({
    //         collection_name: collectionName
    //       });
    //     }

    //     // Create new collection with correct dimensions
    //     logger.info('🏗️ Creating new Milvus collection with 1024 dimensions...');
    //     await client.createCollection({
    //       collection_name: collectionName,
    //       fields: [
    //         {
    //           name: 'id',
    //           data_type: 'VarChar',
    //           max_length: 255,
    //           is_primary_key: true
    //         },
    //         {
    //           name: 'vector',
    //           data_type: 'FloatVector',
    //           dim: 1024
    //         },
    //         {
    //           name: 'team_id',
    //           data_type: 'VarChar',
    //           max_length: 255
    //         },
    //         {
    //           name: 'dataset_id',
    //           data_type: 'VarChar',
    //           max_length: 255
    //         },
    //         {
    //           name: 'collection_id',
    //           data_type: 'VarChar',
    //           max_length: 255
    //         },
    //         {
    //           name: 'metadata',
    //           data_type: 'JSON'
    //         }
    //       ]
    //     });

    //     // Create index
    //     await client.createIndex({
    //       collection_name: collectionName,
    //       field_name: 'vector',
    //       index_type: 'HNSW',
    //       metric_type: 'COSINE',
    //       params: { M: 16, efConstruction: 200 }
    //     });

    //     // Load collection
    //     await client.loadCollection({
    //       collection_name: collectionName
    //     });

    //     logger.info('✅ Milvus collection rebuilt successfully');
    //   } catch (error) {
    //     logger.warn('⚠️ Milvus rebuild failed (this is OK if you\'re not using Milvus):', error.message);
    //   }
    // }

    logger.info('🎉 Vector store rebuild completed successfully!');
    logger.info('💡 You may need to retrain your datasets to regenerate vectors.');
    logger.info('💡 Run: npm run db:init to ensure all indexes are created.');
    
  } catch (error) {
    logger.error('❌ Vector store rebuild failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  rebuildVectorStore()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { rebuildVectorStore };
