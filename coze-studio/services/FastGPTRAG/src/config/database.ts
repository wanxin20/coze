import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from '@/utils/logger.js';

export async function initDatabase() {
  try {
    // Connect to main database with enhanced timeout and retry settings
    await mongoose.connect(config.mongoUrl, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true
    });
    
    mongoose.connection.on('connected', () => {
      logger.info('Main MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Main MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Create text indexes for full-text search
    await createTextIndexes();

    logger.info('Database connection established');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

async function createTextIndexes() {
  try {
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    // Create text index for dataset_datas collection
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
    // If index already exists, that's okay
    if (error?.code === 85) {
      logger.info('Text indexes already exist');
    } else {
      logger.error('Failed to create text indexes:', error);
      throw error;
    }
  }
}

export function getMongoModel<T>(name: string, schema: mongoose.Schema) {
  return mongoose.model<T>(name, schema);
}
