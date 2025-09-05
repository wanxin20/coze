import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

// 硬编码数据库配置
const MONGO_URL = 'mongodb://root:4bqspcbd@dbconn.sealosgzg.site:40545/?directConnection=true';
const PG_URL = 'postgresql://postgres:whpp6mqd@dbconn.sealosgzg.site:44414/?directConnection=true';

async function init() {
  try {
    logger.info('Starting database initialization...');
    logger.info(`Connecting to MongoDB: ${MONGO_URL.replace(/\/\/.*@/, '//***@')}`);

    // 直接连接MongoDB
    await mongoose.connect(MONGO_URL, {
      bufferCommands: false
    });
    
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    // 创建文本索引
    try {
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not available');
      }
      
      await db.collection('dataset_datas').createIndex(
        {
          q: 'text',
          'indexes.text': 'text',
          a: 'text'
        },
        {
          name: 'text_search_index',
          background: true,
          weights: {
            q: 10,
            'indexes.text': 5,
            a: 1
          }
        }
      );
      
      logger.info('✅ Text search indexes created successfully');
    } catch (error: any) {
      if (error?.code === 85) {
        logger.info('Text indexes already exist');
      } else {
        logger.error('Failed to create text indexes:', error);
      }
    }

    logger.info('✅ MongoDB initialized');

    // 初始化PostgreSQL向量存储
    if (PG_URL) {
      try {
        const { Client } = await import('pg');
        const client = new Client(PG_URL);
        await client.connect();
        
        logger.info('✅ PostgreSQL connected');
        
        // 创建pgvector扩展
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        
        // 检查表是否存在
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vectors'
          );
        `);
        
        if (!tableExists.rows[0].exists) {
          // 创建1024维向量表
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
          
          // 创建索引
          await client.query(`
            CREATE INDEX idx_vectors_team_dataset 
            ON vectors(team_id, dataset_id)
          `);
          await client.query(`
            CREATE INDEX idx_vectors_collection 
            ON vectors(collection_id)
          `);
          
          logger.info('✅ Created vectors table with 1024 dimensions');
        } else {
          logger.info('✅ Vectors table already exists');
        }
        
        await client.end();
        logger.info('✅ Vector store initialized');
      } catch (error: any) {
        logger.warn('⚠️ PostgreSQL initialization failed (you can still use the system):', error?.message || error);
      }
    }

    logger.info('🎉 Database initialization completed successfully!');
    logger.info('You can now start the server with: npm run dev');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

init();
