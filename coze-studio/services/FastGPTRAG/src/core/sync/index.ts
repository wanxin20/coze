import { Types } from 'mongoose';
import { MongoDatasetCollection } from '@/core/dataset/collection/schema.js';
import { MongoDataset } from '@/core/dataset/schema.js';
import { MongoDatasetData } from '@/core/dataset/data/schema.js';
import { DatasetCollectionTypeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';
import { processFileContent } from '@/core/file/index.js';
import { startTrainingJob } from '@/jobs/newTraining.js';
import { hashText } from '@/utils/text.js';

export interface SyncJob {
  id: string;
  collectionId: string;
  type: 'url' | 'api' | 'file';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  error?: string;
  lastSyncTime?: Date;
  nextSyncTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConfig {
  interval: number; // in minutes
  autoSync: boolean;
  retryCount: number;
  timeout: number; // in seconds
}

// In-memory sync job storage
const syncJobs = new Map<string, SyncJob>();
const syncSchedules = new Map<string, NodeJS.Timeout>();

// Start sync job for a collection
export async function startSyncJob(
  collectionId: string,
  teamId: string,
  config?: Partial<SyncConfig>
): Promise<string> {
  try {
    const collection = await MongoDatasetCollection.findOne({
      _id: new Types.ObjectId(collectionId),
      teamId: new Types.ObjectId(teamId)
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    const jobId = new Types.ObjectId().toString();
    const syncConfig: SyncConfig = {
      interval: 60, // 1 hour default
      autoSync: true,
      retryCount: 3,
      timeout: 300, // 5 minutes
      ...config
    };

    // Create sync job
    const job: SyncJob = {
      id: jobId,
      collectionId,
      type: getSyncTypeFromCollection(collection),
      status: 'pending',
      progress: 0,
      total: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextSyncTime: new Date(Date.now() + syncConfig.interval * 60 * 1000)
    };

    syncJobs.set(jobId, job);

    // Execute sync immediately
    await executeSyncJob(jobId, syncConfig);

    // Schedule recurring sync if enabled
    if (syncConfig.autoSync) {
      scheduleSyncJob(jobId, syncConfig);
    }

    logger.info(`Sync job started: ${jobId} for collection: ${collectionId}`);
    return jobId;
  } catch (error) {
    logger.error('Failed to start sync job:', error);
    throw error;
  }
}

// Execute sync job
async function executeSyncJob(jobId: string, config: SyncConfig): Promise<void> {
  const job = syncJobs.get(jobId);
  if (!job) throw new Error('Sync job not found');

  try {
    job.status = 'running';
    job.updatedAt = new Date();
    
    const collection = await MongoDatasetCollection.findById(job.collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    let newContent: string | null = null;
    let contentHash: string | null = null;

    switch (job.type) {
      case 'url':
        if (collection.rawLink) {
          const urlResult = await syncFromUrl(collection.rawLink, config.timeout);
          newContent = urlResult.content;
          contentHash = hashText(newContent);
        }
        break;

      case 'api':
        if (collection.externalFileUrl) {
          const apiResult = await syncFromAPI(collection.externalFileUrl, config.timeout);
          newContent = apiResult.content;
          contentHash = hashText(newContent);
        }
        break;

      case 'file':
        // File sync would check for file updates
        logger.info(`File sync not implemented for collection: ${job.collectionId}`);
        break;
    }

    // Check if content has changed
    if (newContent && contentHash && contentHash !== collection.hashRawText) {
      await updateCollectionContent(collection, newContent, contentHash);
      job.progress = 100;
    } else {
      job.progress = 100;
      logger.info(`No content changes detected for collection: ${job.collectionId}`);
    }

    job.status = 'completed';
    job.lastSyncTime = new Date();
    job.nextSyncTime = new Date(Date.now() + config.interval * 60 * 1000);
    
    logger.info(`Sync job completed: ${jobId}`);
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Sync job failed: ${jobId}`, error);
  } finally {
    job.updatedAt = new Date();
  }
}

// Schedule recurring sync
function scheduleSyncJob(jobId: string, config: SyncConfig): void {
  const timeoutId = setTimeout(async () => {
    try {
      await executeSyncJob(jobId, config);
      // Reschedule for next interval
      scheduleSyncJob(jobId, config);
    } catch (error) {
      logger.error(`Scheduled sync failed: ${jobId}`, error);
    }
  }, config.interval * 60 * 1000);

  syncSchedules.set(jobId, timeoutId);
}

// Sync content from URL
async function syncFromUrl(url: string, timeout: number): Promise<{ content: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FastGPT-RAG/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    
    // Basic content processing based on content type
    const contentType = response.headers.get('content-type') || '';
    let processedContent = content;

    if (contentType.includes('text/html')) {
      // Process HTML content
      processedContent = processHTMLContent(content);
    } else if (contentType.includes('application/json')) {
      // Process JSON content
      try {
        const json = JSON.parse(content);
        processedContent = JSON.stringify(json, null, 2);
      } catch {
        processedContent = content;
      }
    }

    return { content: processedContent };
  } catch (error) {
    logger.error(`Failed to sync from URL: ${url}`, error);
    throw error;
  }
}

// Sync content from API
async function syncFromAPI(apiUrl: string, timeout: number): Promise<{ content: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FastGPT-RAG/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convert API response to readable text
    const content = convertAPIResponseToText(data);
    
    return { content };
  } catch (error) {
    logger.error(`Failed to sync from API: ${apiUrl}`, error);
    throw error;
  }
}

// Update collection content
async function updateCollectionContent(
  collection: any,
  newContent: string,
  contentHash: string
): Promise<void> {
  try {
    // Update collection metadata
    await MongoDatasetCollection.findByIdAndUpdate(collection._id, {
      rawTextLength: newContent.length,
      hashRawText: contentHash,
      updateTime: new Date()
    });

    // Process new content into chunks
    const { chunks } = await processFileContent({
      content: newContent,
      type: 'text',
      chunkSize: collection.chunkSize || 512,
      chunkOverlap: 50
    });

    // Clear old data (this is a simple approach - in production you might want to be more careful)
    await MongoDatasetData.deleteMany({
      collectionId: collection._id
    });

    // Insert new data chunks
    if (!chunks) {
      throw new Error('Failed to process content into chunks');
    }
    
    const dataItems = chunks.map((chunk, index) => ({
      teamId: collection.teamId,
      tmbId: collection.tmbId,
      datasetId: collection.datasetId,
      collectionId: collection._id,
      q: chunk.text,
      a: '',
      chunkIndex: index,
      indexes: [{
        type: 'custom' as const,
        dataId: `${collection._id}_${Date.now()}_${index}`,
        text: chunk.text
      }],
      updateTime: new Date()
    }));

    if (dataItems.length > 0) {
      await MongoDatasetData.insertMany(dataItems);
      
      // Start vectorization
      await startTrainingJob({
        collectionId: collection._id.toString(),
        teamId: collection.teamId.toString(),
        tmbId: collection.tmbId.toString(),
        mode: 'chunk' as any
      });
    }

    logger.info(`Updated collection content: ${collection._id}, ${chunks?.length || 0} chunks`);
  } catch (error) {
    logger.error('Failed to update collection content:', error);
    throw error;
  }
}

// Get sync job status
export function getSyncJobStatus(jobId: string): SyncJob | null {
  return syncJobs.get(jobId) || null;
}

// List all sync jobs
export function listSyncJobs(): SyncJob[] {
  return Array.from(syncJobs.values());
}

// Stop sync job
export function stopSyncJob(jobId: string): boolean {
  const job = syncJobs.get(jobId);
  if (!job) return false;

  // Cancel scheduled execution
  const timeoutId = syncSchedules.get(jobId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    syncSchedules.delete(jobId);
  }

  // Mark job as stopped
  job.status = 'failed';
  job.error = 'Stopped by user';
  job.updatedAt = new Date();

  return true;
}

// Clean up old jobs
export function cleanupSyncJobs(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
  const now = new Date();
  let cleaned = 0;

  for (const [jobId, job] of syncJobs.entries()) {
    if (job.status === 'completed' || job.status === 'failed') {
      const age = now.getTime() - job.updatedAt.getTime();
      if (age > maxAge) {
        syncJobs.delete(jobId);
        const timeoutId = syncSchedules.get(jobId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          syncSchedules.delete(jobId);
        }
        cleaned++;
      }
    }
  }

  logger.info(`Cleaned up ${cleaned} old sync jobs`);
  return cleaned;
}

// Utility functions
function getSyncTypeFromCollection(collection: any): 'url' | 'api' | 'file' {
  if (collection.type === DatasetCollectionTypeEnum.link) return 'url';
  if (collection.externalFileUrl) return 'api';
  return 'file';
}

function processHTMLContent(html: string): string {
  // Remove script and style tags
  let processed = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Convert to text
  processed = processed.replace(/<[^>]+>/g, ' ');
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

function convertAPIResponseToText(data: any): string {
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

// Start periodic cleanup
setInterval(() => {
  cleanupSyncJobs();
}, 24 * 60 * 60 * 1000); // Run daily
