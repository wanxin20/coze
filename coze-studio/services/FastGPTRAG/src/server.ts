import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initDatabase } from './config/database.js';
import { getVectorStore } from './core/vectorstore/index.js';
import datasetRoutes from './api/routes/dataset.js';
import collectionRoutes from './api/routes/collection.js';
import dataRoutes from './api/routes/data.js';
import searchRoutes from './api/routes/search.js';
import monitoringRoutes from './api/routes/monitoring.js';
import { performanceMonitor, startMetricsCollection } from './core/monitoring/index.js';
import { simpleAuth } from './middleware/simpleAuth.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Performance monitoring
app.use(performanceMonitor());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test embedding endpoint for debugging
app.post('/api/test/embedding', async (req, res) => {
  try {
    const { getVectorsByText } = await import('./core/embedding/index.js');
    const { getEmbeddingModel } = await import('./core/embedding/index.js');
    
    const { text, model = 'text-embedding-v3' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        code: 400,
        message: 'Text is required',
        data: null
      });
    }
    
    const embeddingModel = getEmbeddingModel(model);
    const result = await getVectorsByText({
      model: embeddingModel,
      input: [text],
      type: 'query' as any
    });
    
    res.json({
      code: 200,
      message: 'Embedding test successful',
      data: {
        vectors: result.vectors,
        tokens: result.tokens,
        model: embeddingModel.model,
        provider: embeddingModel.provider
      }
    });
  } catch (error: any) {
    logger.error('Embedding test failed:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      data: null
    });
  }
});

// API routes - FastGPT compatible paths
// NOTE: More specific routes must come before less specific ones to avoid conflicts
app.use('/api/core/dataset/collection', collectionRoutes);
app.use('/api/core/dataset/data', dataRoutes);
app.use('/api/core/dataset', datasetRoutes);

// Knowledge base routes (FastGPT compatibility)
app.use('/api/core/kb', searchRoutes);

// Additional API routes
app.use('/api/dataset', datasetRoutes); // Simplified paths
app.use('/api/collection', collectionRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/search', searchRoutes);

// Monitoring and admin routes
app.use('/api/monitoring', monitoringRoutes);

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  res.status(error.status || 500).json({
    code: error.status || 500,
    message: error.message || 'Internal Server Error',
    data: null
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Endpoint not found',
    data: null
  });
});

async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Initialize vector store
    await getVectorStore();
    logger.info('Vector store initialized');

    // Start metrics collection
    startMetricsCollection(60000); // Collect every 60 seconds

    // Start server
    app.listen(config.port, () => {
      logger.info(`FastGPT RAG Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info('Core API endpoints:');
      logger.info('  GET  /health - Health check');
      logger.info('  POST /api/core/dataset - Create dataset');
      logger.info('  GET  /api/core/dataset - List datasets');
      logger.info('  POST /api/core/dataset/collection - Create collection');
      logger.info('  POST /api/core/dataset/data - Add data');
      logger.info('  POST /api/core/dataset/searchTest - Search test');
      logger.info('Enhanced features:');
      logger.info('  - Mixed search (embedding + full text)');
      logger.info('  - Reranking support');
      logger.info('  - Query extension');
      logger.info('  - Deep search');
      logger.info('  - Advanced filters');
      logger.info('  - File processing (PDF, DOCX, HTML, MD, CSV)');
      logger.info('  - Training & vectorization jobs');
      logger.info('  - Data synchronization');
      logger.info('  - Performance monitoring');
      logger.info('  - Audit logging');
      logger.info('  - Rate limiting & security');
      logger.info('  - Compatible with FastGPT API format');
      logger.info('');
      logger.info('🎉 FastGPT RAG Server fully initialized with all enterprise features!');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
