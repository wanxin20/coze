import { VectorData, VectorSearchResult } from '@/types/common.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface VectorStoreInterface {
  init(): Promise<void>;
  insertVectors(vectors: VectorData[]): Promise<string[]>;
  addVectors(vectors: VectorData[]): Promise<string[]>; // Alias for insertVectors
  searchVectors(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]>;
  deleteVectors(ids: string[]): Promise<void>;
  updateVector(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
}

export abstract class BaseVectorStore implements VectorStoreInterface {
  abstract init(): Promise<void>;
  abstract insertVectors(vectors: VectorData[]): Promise<string[]>;
  
  // Alias for backward compatibility
  async addVectors(vectors: VectorData[]): Promise<string[]> {
    return this.insertVectors(vectors);
  }
  
  abstract searchVectors(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]>;
  abstract deleteVectors(ids: string[]): Promise<void>;
  abstract updateVector(id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
}

// Factory function to create vector store instance
export function createVectorStore(): VectorStoreInterface {
  if (config.pgUrl) {
    logger.info('Using PostgreSQL vector store');
    return new PostgreSQLVectorStore();
  } else if (config.milvusUrl) {
    logger.info('Using Milvus vector store');
    return new MilvusVectorStore();
  } else {
    throw new Error('No vector store configuration found. Please configure PG_URL or MILVUS_URL');
  }
}

// PostgreSQL + pgvector implementation
class PostgreSQLVectorStore extends BaseVectorStore {
  private client: any;

  async init(): Promise<void> {
    try {
      const { Client } = await import('pg');
      this.client = new Client({
        connectionString: config.pgUrl,
        connectionTimeoutMillis: 30000,
        query_timeout: 60000
      });
      await this.client.connect();
      
      // Create extension and table if not exists
      await this.client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Check if vectors table exists
      const tableExists = await this.client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'vectors'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        await this.client.query(`
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
        logger.info('Created vectors table with 1024 dimensions');
      } else {
        // Check current vector dimension
        const dimResult = await this.client.query(`
          SELECT atttypmod FROM pg_attribute 
          WHERE attrelid = 'vectors'::regclass 
          AND attname = 'vector'
        `);
        
        if (dimResult.rows.length > 0) {
          const currentDim = dimResult.rows[0].atttypmod;
          logger.info(`Existing vectors table has ${currentDim} dimensions`);
        }
      }
      
      // Create indexes
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_vectors_team_dataset 
        ON vectors(team_id, dataset_id)
      `);
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_vectors_collection 
        ON vectors(collection_id)
      `);
      
      logger.info('PostgreSQL vector store initialized');
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL vector store:', error);
      throw error;
    }
  }

  async insertVectors(vectors: VectorData[]): Promise<string[]> {
    const insertedIds: string[] = [];
    
    try {
      for (const vectorData of vectors) {
        const query = `
          INSERT INTO vectors (id, vector, metadata, team_id, dataset_id, collection_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            vector = EXCLUDED.vector,
            metadata = EXCLUDED.metadata
        `;
        
        await this.client.query(query, [
          vectorData.id,
          `[${vectorData.vector.join(',')}]`,
          JSON.stringify(vectorData.metadata),
          vectorData.metadata.teamId,
          vectorData.metadata.datasetId,
          vectorData.metadata.collectionId
        ]);
        
        insertedIds.push(vectorData.id);
      }
      
      return insertedIds;
    } catch (error) {
      logger.error('Failed to insert vectors:', error);
      throw error;
    }
  }

  async searchVectors(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    try {
      let whereClause = '';
      const params: any[] = [`[${vector.join(',')}]`, limit];
      let paramIndex = 3;

      if (filter) {
        const conditions: string[] = [];
        if (filter.teamId) {
          conditions.push(`team_id = $${paramIndex++}`);
          params.push(filter.teamId);
        }
        if (filter.datasetId) {
          conditions.push(`dataset_id = $${paramIndex++}`);
          params.push(filter.datasetId);
        }
        if (filter.collectionId) {
          conditions.push(`collection_id = $${paramIndex++}`);
          params.push(filter.collectionId);
        }
        
        if (conditions.length > 0) {
          whereClause = `WHERE ${conditions.join(' AND ')}`;
        }
      }

      const query = `
        SELECT id, vector, metadata, 1 - (vector <=> $1) as score
        FROM vectors
        ${whereClause}
        ORDER BY vector <=> $1
        LIMIT $2
      `;

      const result = await this.client.query(query, params);
      
      return result.rows.map((row: any) => ({
        id: row.id,
        vector: JSON.parse(row.vector),
        metadata: row.metadata,
        score: row.score
      }));
    } catch (error) {
      logger.error('Failed to search vectors:', error);
      throw error;
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      const query = 'DELETE FROM vectors WHERE id = ANY($1)';
      await this.client.query(query, [ids]);
    } catch (error) {
      logger.error('Failed to delete vectors:', error);
      throw error;
    }
  }

  async updateVector(id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    try {
      const query = `
        UPDATE vectors 
        SET vector = $2, metadata = $3, team_id = $4, dataset_id = $5, collection_id = $6
        WHERE id = $1
      `;
      
      await this.client.query(query, [
        id,
        `[${vector.join(',')}]`,
        JSON.stringify(metadata),
        metadata?.teamId,
        metadata?.datasetId,
        metadata?.collectionId
      ]);
    } catch (error) {
      logger.error('Failed to update vector:', error);
      throw error;
    }
  }
}

// Milvus implementation
class MilvusVectorStore extends BaseVectorStore {
  private client: any;
  private collectionName = 'fastgpt_vectors';

  async init(): Promise<void> {
    try {
      const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
      
      this.client = new MilvusClient({
        address: config.milvusUrl,
        username: config.milvusUsername,
        password: config.milvusPassword
      });

      // Check if collection exists
      const hasCollection = await this.client.hasCollection({
        collection_name: this.collectionName
      });

      if (!hasCollection.value) {
        // Create collection
        await this.client.createCollection({
          collection_name: this.collectionName,
          fields: [
            {
              name: 'id',
              data_type: 'VarChar',
              max_length: 255,
              is_primary_key: true
            },
            {
              name: 'vector',
              data_type: 'FloatVector',
              dim: 1024
            },
            {
              name: 'team_id',
              data_type: 'VarChar',
              max_length: 255
            },
            {
              name: 'dataset_id',
              data_type: 'VarChar',
              max_length: 255
            },
            {
              name: 'collection_id',
              data_type: 'VarChar',
              max_length: 255
            },
            {
              name: 'metadata',
              data_type: 'JSON'
            }
          ]
        });

        // Create index
        await this.client.createIndex({
          collection_name: this.collectionName,
          field_name: 'vector',
          index_type: 'HNSW',
          metric_type: 'COSINE',
          params: { M: 16, efConstruction: 200 }
        });
      }

      // Load collection
      await this.client.loadCollection({
        collection_name: this.collectionName
      });

      logger.info('Milvus vector store initialized');
    } catch (error) {
      logger.error('Failed to initialize Milvus vector store:', error);
      throw error;
    }
  }

  async insertVectors(vectors: VectorData[]): Promise<string[]> {
    try {
      const data = vectors.map(v => ({
        id: v.id,
        vector: v.vector,
        team_id: v.metadata.teamId,
        dataset_id: v.metadata.datasetId,
        collection_id: v.metadata.collectionId,
        metadata: v.metadata
      }));

      await this.client.insert({
        collection_name: this.collectionName,
        data
      });

      return vectors.map(v => v.id);
    } catch (error) {
      logger.error('Failed to insert vectors:', error);
      throw error;
    }
  }

  async searchVectors(
    vector: number[],
    limit: number,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    try {
      let expr = '';
      if (filter) {
        const conditions: string[] = [];
        if (filter.teamId) conditions.push(`team_id == "${filter.teamId}"`);
        if (filter.datasetId) conditions.push(`dataset_id == "${filter.datasetId}"`);
        if (filter.collectionId) conditions.push(`collection_id == "${filter.collectionId}"`);
        expr = conditions.join(' && ');
      }

      const searchParams = {
        collection_name: this.collectionName,
        vectors: [vector],
        search_params: {
          anns_field: 'vector',
          topk: limit,
          metric_type: 'COSINE',
          params: { ef: config.hnswEfSearch }
        },
        output_fields: ['id', 'metadata'],
        ...(expr && { expr })
      };

      const result = await this.client.search(searchParams);
      
      return result.results[0]?.map((item: any) => ({
        id: item.id,
        vector: [],
        metadata: item.metadata,
        score: item.score
      })) || [];
    } catch (error) {
      logger.error('Failed to search vectors:', error);
      throw error;
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      const expr = `id in [${ids.map(id => `"${id}"`).join(', ')}]`;
      await this.client.delete({
        collection_name: this.collectionName,
        expr
      });
    } catch (error) {
      logger.error('Failed to delete vectors:', error);
      throw error;
    }
  }

  async updateVector(id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    // Milvus doesn't support direct updates, so we delete and insert
    await this.deleteVectors([id]);
    await this.insertVectors([{
      id,
      vector,
      metadata: metadata || {}
    }]);
  }
}

// Global vector store instance
let vectorStore: VectorStoreInterface;

export async function getVectorStore(): Promise<VectorStoreInterface> {
  if (!vectorStore) {
    vectorStore = createVectorStore();
    await vectorStore.init();
  }
  return vectorStore;
}
