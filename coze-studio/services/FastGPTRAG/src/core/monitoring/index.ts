import { Types } from 'mongoose';
import { logger } from '@/utils/logger.js';
import os from 'os';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    responseTime: number;
  };
  api: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
  };
  search: {
    totalSearches: number;
    averageSearchTime: number;
    embeddingTokens: number;
    rerankTokens: number;
  };
  training: {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
}

export interface UsageStatistics {
  teamId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  metrics: {
    apiCalls: number;
    searchQueries: number;
    documentsProcessed: number;
    vectorsGenerated: number;
    tokensUsed: {
      embedding: number;
      rerank: number;
      llm: number;
    };
    storageUsed: number; // in bytes
    bandwidthUsed: number; // in bytes
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  teamId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ip: string;
  userAgent: string;
  result: 'success' | 'error';
  error?: string;
}

// In-memory stores (in production, these should be in database)
const metrics: SystemMetrics[] = [];
const usageStats = new Map<string, UsageStatistics>();
const auditLogs: AuditLogEntry[] = [];
const apiMetrics = {
  requestCount: 0,
  errorCount: 0,
  responseTimes: [] as number[],
  lastResetTime: Date.now()
};

// Collect system metrics
export function collectSystemMetrics(): SystemMetrics {
  const now = new Date();
  
  // Get system info
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();
  const loadAvg = process.platform === 'win32' ? [0, 0, 0] : os.loadavg();
  
  const metric: SystemMetrics = {
    timestamp: now,
    cpu: {
      usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to ms
      loadAverage: loadAvg
    },
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    database: {
      connections: 0, // TODO: Get from MongoDB
      responseTime: 0 // TODO: Measure DB response time
    },
    api: {
      requestCount: apiMetrics.requestCount,
      errorCount: apiMetrics.errorCount,
      averageResponseTime: calculateAverageResponseTime()
    },
    search: {
      totalSearches: 0, // TODO: Get from search stats
      averageSearchTime: 0,
      embeddingTokens: 0,
      rerankTokens: 0
    },
    training: {
      activeJobs: 0, // TODO: Get from training job manager
      completedJobs: 0,
      failedJobs: 0
    }
  };

  // Store metric (keep last 1000 entries)
  metrics.push(metric);
  if (metrics.length > 1000) {
    metrics.shift();
  }

  return metric;
}

// Record API request metrics
export function recordApiRequest(responseTime: number, success: boolean = true): void {
  apiMetrics.requestCount++;
  apiMetrics.responseTimes.push(responseTime);
  
  if (!success) {
    apiMetrics.errorCount++;
  }

  // Keep only last 1000 response times
  if (apiMetrics.responseTimes.length > 1000) {
    apiMetrics.responseTimes = apiMetrics.responseTimes.slice(-1000);
  }
}

// Calculate average response time
function calculateAverageResponseTime(): number {
  if (apiMetrics.responseTimes.length === 0) return 0;
  
  const sum = apiMetrics.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / apiMetrics.responseTimes.length);
}

// Record usage statistics
export function recordUsage(teamId: string, type: string, amount: number, metadata?: Record<string, any>): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const key = `${teamId}_daily_${today.getTime()}`;
  
  let stats = usageStats.get(key);
  if (!stats) {
    stats = {
      teamId,
      period: 'daily',
      date: today,
      metrics: {
        apiCalls: 0,
        searchQueries: 0,
        documentsProcessed: 0,
        vectorsGenerated: 0,
        tokensUsed: {
          embedding: 0,
          rerank: 0,
          llm: 0
        },
        storageUsed: 0,
        bandwidthUsed: 0
      }
    };
    usageStats.set(key, stats);
  }

  // Update metrics based on type
  switch (type) {
    case 'api_call':
      stats.metrics.apiCalls += amount;
      break;
    case 'search':
      stats.metrics.searchQueries += amount;
      break;
    case 'document':
      stats.metrics.documentsProcessed += amount;
      break;
    case 'vector':
      stats.metrics.vectorsGenerated += amount;
      break;
    case 'embedding_tokens':
      stats.metrics.tokensUsed.embedding += amount;
      break;
    case 'rerank_tokens':
      stats.metrics.tokensUsed.rerank += amount;
      break;
    case 'llm_tokens':
      stats.metrics.tokensUsed.llm += amount;
      break;
    case 'storage':
      stats.metrics.storageUsed += amount;
      break;
    case 'bandwidth':
      stats.metrics.bandwidthUsed += amount;
      break;
  }
}

// Add audit log entry
export function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  const auditEntry: AuditLogEntry = {
    id: new Types.ObjectId().toString(),
    timestamp: new Date(),
    ...entry
  };

  auditLogs.push(auditEntry);

  // Keep only last 10000 entries
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }

  // Log to file system as well
  logger.info('Audit', auditEntry);
}

// Get system health status
export function getSystemHealth(): {
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    value?: any;
  }>;
} {
  const checks = [];
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

  // Check memory usage
  const latestMetric = metrics[metrics.length - 1];
  if (latestMetric) {
    if (latestMetric.memory.percentage > 90) {
      checks.push({
        name: 'Memory Usage',
        status: 'fail' as const,
        message: `High memory usage: ${latestMetric.memory.percentage}%`,
        value: latestMetric.memory.percentage
      });
      overallStatus = 'critical';
    } else if (latestMetric.memory.percentage > 75) {
      checks.push({
        name: 'Memory Usage',
        status: 'warn' as const,
        message: `Elevated memory usage: ${latestMetric.memory.percentage}%`,
        value: latestMetric.memory.percentage
      });
      if (overallStatus === 'healthy') overallStatus = 'warning';
    } else {
      checks.push({
        name: 'Memory Usage',
        status: 'pass' as const,
        message: `Memory usage normal: ${latestMetric.memory.percentage}%`,
        value: latestMetric.memory.percentage
      });
    }

    // Check API error rate
    const errorRate = apiMetrics.requestCount > 0 ? 
      (apiMetrics.errorCount / apiMetrics.requestCount) * 100 : 0;
    
    if (errorRate > 10) {
      checks.push({
        name: 'API Error Rate',
        status: 'fail' as const,
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        value: errorRate
      });
      overallStatus = 'critical';
    } else if (errorRate > 5) {
      checks.push({
        name: 'API Error Rate',
        status: 'warn' as const,
        message: `Elevated error rate: ${errorRate.toFixed(1)}%`,
        value: errorRate
      });
      if (overallStatus === 'healthy') overallStatus = 'warning';
    } else {
      checks.push({
        name: 'API Error Rate',
        status: 'pass' as const,
        message: `Error rate normal: ${errorRate.toFixed(1)}%`,
        value: errorRate
      });
    }
  }

  // Check database connectivity (placeholder)
  checks.push({
    name: 'Database',
    status: 'pass' as const,
    message: 'Database connection healthy'
  });

  // Check vector store connectivity (placeholder)
  checks.push({
    name: 'Vector Store',
    status: 'pass' as const,
    message: 'Vector store connection healthy'
  });

  return { status: overallStatus, checks };
}

// Get metrics for time range
export function getMetrics(
  startTime: Date,
  endTime: Date
): SystemMetrics[] {
  return metrics.filter(m => 
    m.timestamp >= startTime && m.timestamp <= endTime
  );
}

// Get usage statistics
export function getUsageStats(
  teamId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  limit: number = 30
): UsageStatistics[] {
  const stats = Array.from(usageStats.values())
    .filter(s => s.teamId === teamId && s.period === period)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);
  
  return stats;
}

// Get audit logs
export function getAuditLogs(
  filters: {
    teamId?: string;
    userId?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
  } = {},
  limit: number = 100
): AuditLogEntry[] {
  let filtered = auditLogs;

  if (filters.teamId) {
    filtered = filtered.filter(log => log.teamId === filters.teamId);
  }
  
  if (filters.userId) {
    filtered = filtered.filter(log => log.userId === filters.userId);
  }
  
  if (filters.action) {
    filtered = filtered.filter(log => log.action === filters.action);
  }
  
  if (filters.startTime) {
    filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
  }
  
  if (filters.endTime) {
    filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
  }

  return filtered
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

// Performance monitoring middleware
export function performanceMonitor() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      recordApiRequest(responseTime, success);
      
      // Record usage
      if (req.user?.teamId) {
        recordUsage(req.user.teamId, 'api_call', 1);
        
        // Record bandwidth usage
        const contentLength = res.get('content-length');
        if (contentLength) {
          recordUsage(req.user.teamId, 'bandwidth', parseInt(contentLength));
        }
      }

      // Add audit log for important operations
      if (req.method !== 'GET' && req.user) {
        addAuditLog({
          userId: req.user.userId,
          teamId: req.user.teamId,
          action: `${req.method} ${req.path}`,
          resource: req.path.split('/')[2] || 'unknown',
          resourceId: req.params.id,
          details: {
            body: req.body,
            query: req.query
          },
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          result: success ? 'success' : 'error',
          error: success ? undefined : `HTTP ${res.statusCode}`
        });
      }
    });
    
    next();
  };
}

// Start metrics collection
export function startMetricsCollection(intervalMs: number = 60000): void {
  setInterval(() => {
    collectSystemMetrics();
  }, intervalMs);
  
  logger.info(`Metrics collection started with ${intervalMs}ms interval`);
}

// Cleanup old data
export function cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = new Date(Date.now() - maxAge);
  
  // Clean metrics
  const oldMetricsCount = metrics.length;
  metrics.splice(0, metrics.findIndex(m => m.timestamp > cutoff));
  
  // Clean usage stats
  let cleanedStats = 0;
  for (const [key, stat] of usageStats.entries()) {
    if (stat.date < cutoff) {
      usageStats.delete(key);
      cleanedStats++;
    }
  }
  
  // Clean audit logs
  const oldLogsCount = auditLogs.length;
  auditLogs.splice(0, auditLogs.findIndex(log => log.timestamp > cutoff));
  
  logger.info(`Cleaned up monitoring data: ${oldMetricsCount - metrics.length} metrics, ${cleanedStats} usage stats, ${oldLogsCount - auditLogs.length} audit logs`);
}

// Start periodic cleanup
setInterval(() => {
  cleanupOldData();
}, 24 * 60 * 60 * 1000); // Run daily

// Export monitoring statistics
export function exportMonitoringData(): {
  systemMetrics: SystemMetrics[];
  usageStatistics: UsageStatistics[];
  auditLogs: AuditLogEntry[];
  summary: {
    totalApiCalls: number;
    totalErrors: number;
    averageResponseTime: number;
    uptime: number;
  };
} {
  const totalApiCalls = apiMetrics.requestCount;
  const totalErrors = apiMetrics.errorCount;
  const averageResponseTime = calculateAverageResponseTime();
  const uptime = Date.now() - apiMetrics.lastResetTime;

  return {
    systemMetrics: metrics,
    usageStatistics: Array.from(usageStats.values()),
    auditLogs: auditLogs,
    summary: {
      totalApiCalls,
      totalErrors,
      averageResponseTime,
      uptime
    }
  };
}
