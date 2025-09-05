/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package rag

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/knowledge/service"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// MonitoringService RAG监控服务
type MonitoringService struct {
	client     service.RAGClient
	metrics    *RAGMetrics
	collectors []MetricCollector
	stopCh     chan struct{}
	wg         sync.WaitGroup
}

// RAGMetrics RAG指标
type RAGMetrics struct {
	mu sync.RWMutex
	
	// 搜索指标
	SearchRequests    int64     `json:"search_requests"`
	SearchLatencyMS   float64   `json:"search_latency_ms"`
	SearchErrors      int64     `json:"search_errors"`
	
	// 向量化指标
	EmbeddingRequests int64     `json:"embedding_requests"`
	EmbeddingTokens   int64     `json:"embedding_tokens"`
	EmbeddingLatency  float64   `json:"embedding_latency_ms"`
	
	// 训练指标
	TrainingJobs      int64     `json:"training_jobs"`
	TrainingSuccess   int64     `json:"training_success"`
	TrainingErrors    int64     `json:"training_errors"`
	
	// 系统指标
	MemoryUsageMB     float64   `json:"memory_usage_mb"`
	CPUUsagePercent   float64   `json:"cpu_usage_percent"`
	DiskUsageMB       float64   `json:"disk_usage_mb"`
	
	// 时间戳
	LastUpdated       time.Time `json:"last_updated"`
}

// MetricCollector 指标收集器接口
type MetricCollector interface {
	Collect(ctx context.Context) (*RAGMetrics, error)
	Name() string
}

// NewMonitoringService 创建监控服务
func NewMonitoringService(client service.RAGClient) *MonitoringService {
	return &MonitoringService{
		client:  client,
		metrics: &RAGMetrics{},
		stopCh:  make(chan struct{}),
	}
}

// Start 启动监控服务
func (m *MonitoringService) Start(ctx context.Context, interval time.Duration) error {
	logs.CtxInfof(ctx, "Starting RAG monitoring service with interval: %v", interval)
	
	// 注册默认收集器
	if client, ok := m.client.(*Client); ok {
		m.RegisterCollector(&HealthCollector{client: client})
		m.RegisterCollector(&UsageCollector{client: client})
		m.RegisterCollector(&SystemCollector{client: client})
	} else {
		return fmt.Errorf("invalid client type, expected *Client")
	}
	
	// 启动收集协程
	m.wg.Add(1)
	go m.collectLoop(ctx, interval)
	
	return nil
}

// Stop 停止监控服务
func (m *MonitoringService) Stop() error {
	logs.Infof("Stopping RAG monitoring service")
	
	close(m.stopCh)
	m.wg.Wait()
	
	return nil
}

// RegisterCollector 注册指标收集器
func (m *MonitoringService) RegisterCollector(collector MetricCollector) {
	m.collectors = append(m.collectors, collector)
	logs.Infof("Registered metric collector: %s", collector.Name())
}

// GetMetrics 获取当前指标
func (m *MonitoringService) GetMetrics() *RAGMetrics {
	m.metrics.mu.RLock()
	defer m.metrics.mu.RUnlock()
	
	// 复制指标数据
	metrics := *m.metrics
	return &metrics
}

// collectLoop 指标收集循环
func (m *MonitoringService) collectLoop(ctx context.Context, interval time.Duration) {
	defer m.wg.Done()
	
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			m.collectMetrics(ctx)
		case <-m.stopCh:
			logs.CtxInfof(ctx, "RAG monitoring service stopped")
			return
		case <-ctx.Done():
			logs.CtxInfof(ctx, "RAG monitoring service context cancelled")
			return
		}
	}
}

// collectMetrics 收集指标
func (m *MonitoringService) collectMetrics(ctx context.Context) {
	aggregatedMetrics := &RAGMetrics{
		LastUpdated: time.Now(),
	}
	
	// 从所有收集器收集指标
	for _, collector := range m.collectors {
		metrics, err := collector.Collect(ctx)
		if err != nil {
			logs.CtxWarnf(ctx, "Failed to collect metrics from %s: %v", collector.Name(), err)
			continue
		}
		
		// 聚合指标
		m.aggregateMetrics(aggregatedMetrics, metrics)
	}
	
	// 更新全局指标
	m.metrics.mu.Lock()
	*m.metrics = *aggregatedMetrics
	m.metrics.mu.Unlock()
	
	// 记录指标日志
	logs.CtxInfof(ctx, "RAG metrics updated: searches=%d, embeddings=%d, trainings=%d, errors=%d",
		aggregatedMetrics.SearchRequests,
		aggregatedMetrics.EmbeddingRequests,
		aggregatedMetrics.TrainingJobs,
		aggregatedMetrics.SearchErrors+aggregatedMetrics.TrainingErrors)
}

// aggregateMetrics 聚合指标
func (m *MonitoringService) aggregateMetrics(target, source *RAGMetrics) {
	target.SearchRequests += source.SearchRequests
	target.SearchErrors += source.SearchErrors
	target.EmbeddingRequests += source.EmbeddingRequests
	target.EmbeddingTokens += source.EmbeddingTokens
	target.TrainingJobs += source.TrainingJobs
	target.TrainingSuccess += source.TrainingSuccess
	target.TrainingErrors += source.TrainingErrors
	
	// 延迟取平均值
	if source.SearchLatencyMS > 0 {
		if target.SearchLatencyMS == 0 {
			target.SearchLatencyMS = source.SearchLatencyMS
		} else {
			target.SearchLatencyMS = (target.SearchLatencyMS + source.SearchLatencyMS) / 2
		}
	}
	
	if source.EmbeddingLatency > 0 {
		if target.EmbeddingLatency == 0 {
			target.EmbeddingLatency = source.EmbeddingLatency
		} else {
			target.EmbeddingLatency = (target.EmbeddingLatency + source.EmbeddingLatency) / 2
		}
	}
	
	// 系统指标取最新值
	if source.MemoryUsageMB > 0 {
		target.MemoryUsageMB = source.MemoryUsageMB
	}
	if source.CPUUsagePercent > 0 {
		target.CPUUsagePercent = source.CPUUsagePercent
	}
	if source.DiskUsageMB > 0 {
		target.DiskUsageMB = source.DiskUsageMB
	}
}

// HealthCollector 健康检查收集器
type HealthCollector struct {
	client *Client
}

func (h *HealthCollector) Name() string {
	return "health"
}

func (h *HealthCollector) Collect(ctx context.Context) (*RAGMetrics, error) {
	health, err := h.client.GetHealth(ctx)
	if err != nil {
		return &RAGMetrics{
			SearchErrors: 1, // 健康检查失败计入错误
		}, err
	}
	
	metrics := &RAGMetrics{}
	
	// 根据健康状态设置指标
	if health.Status != "ok" {
		metrics.SearchErrors = 1
	}
	
	return metrics, nil
}

// UsageCollector 使用统计收集器
type UsageCollector struct {
	client *Client
}

func (u *UsageCollector) Name() string {
	return "usage"
}

func (u *UsageCollector) Collect(ctx context.Context) (*RAGMetrics, error) {
	stats, err := u.client.GetUsageStats(ctx, "daily")
	if err != nil {
		return &RAGMetrics{}, err
	}
	
	metrics := &RAGMetrics{}
	
	if len(stats.UsageRecords) > 0 {
		record := stats.UsageRecords[0]
		metrics.SearchRequests = int64(record.SearchCount)
		metrics.EmbeddingTokens = int64(record.EmbeddingTokens)
		metrics.SearchLatencyMS = record.AvgResponseTime
	}
	
	if stats.Summary != nil {
		metrics.SearchRequests = int64(stats.Summary.TotalSearches)
		metrics.EmbeddingTokens = int64(stats.Summary.TotalEmbeddingTokens)
		metrics.SearchLatencyMS = stats.Summary.AvgResponseTime
	}
	
	return metrics, nil
}

// SystemCollector 系统指标收集器
type SystemCollector struct {
	client *Client
}

func (s *SystemCollector) Name() string {
	return "system"
}

func (s *SystemCollector) Collect(ctx context.Context) (*RAGMetrics, error) {
	// 这里可以调用RAG服务的系统指标接口
	// 或者通过其他方式收集系统指标
	
	metrics := &RAGMetrics{
		MemoryUsageMB:   0, // 需要实际实现
		CPUUsagePercent: 0, // 需要实际实现
		DiskUsageMB:     0, // 需要实际实现
	}
	
	return metrics, nil
}

// AlertManager 告警管理器
type AlertManager struct {
	thresholds map[string]float64
	handlers   []AlertHandler
}

// AlertHandler 告警处理器接口
type AlertHandler interface {
	Handle(ctx context.Context, alert *Alert) error
}

// Alert 告警信息
type Alert struct {
	Level       string                 `json:"level"`       // info, warn, error, critical
	Message     string                 `json:"message"`
	Metric      string                 `json:"metric"`
	Value       float64                `json:"value"`
	Threshold   float64                `json:"threshold"`
	Timestamp   time.Time              `json:"timestamp"`
	Labels      map[string]string      `json:"labels"`
}

// NewAlertManager 创建告警管理器
func NewAlertManager() *AlertManager {
	return &AlertManager{
		thresholds: make(map[string]float64),
		handlers:   make([]AlertHandler, 0),
	}
}

// SetThreshold 设置告警阈值
func (a *AlertManager) SetThreshold(metric string, threshold float64) {
	a.thresholds[metric] = threshold
}

// RegisterHandler 注册告警处理器
func (a *AlertManager) RegisterHandler(handler AlertHandler) {
	a.handlers = append(a.handlers, handler)
}

// CheckMetrics 检查指标并触发告警
func (a *AlertManager) CheckMetrics(ctx context.Context, metrics *RAGMetrics) {
	// 检查搜索错误率
	if metrics.SearchRequests > 0 {
		errorRate := float64(metrics.SearchErrors) / float64(metrics.SearchRequests) * 100
		if threshold, exists := a.thresholds["search_error_rate"]; exists && errorRate > threshold {
			alert := &Alert{
				Level:     "error",
				Message:   "High search error rate detected",
				Metric:    "search_error_rate",
				Value:     errorRate,
				Threshold: threshold,
				Timestamp: time.Now(),
				Labels: map[string]string{
					"service": "fastgpt-rag",
					"type":    "search",
				},
			}
			a.triggerAlert(ctx, alert)
		}
	}
	
	// 检查搜索延迟
	if threshold, exists := a.thresholds["search_latency"]; exists && metrics.SearchLatencyMS > threshold {
		alert := &Alert{
			Level:     "warn",
			Message:   "High search latency detected",
			Metric:    "search_latency",
			Value:     metrics.SearchLatencyMS,
			Threshold: threshold,
			Timestamp: time.Now(),
			Labels: map[string]string{
				"service": "fastgpt-rag",
				"type":    "performance",
			},
		}
		a.triggerAlert(ctx, alert)
	}
	
	// 检查内存使用
	if threshold, exists := a.thresholds["memory_usage"]; exists && metrics.MemoryUsageMB > threshold {
		alert := &Alert{
			Level:     "warn",
			Message:   "High memory usage detected",
			Metric:    "memory_usage",
			Value:     metrics.MemoryUsageMB,
			Threshold: threshold,
			Timestamp: time.Now(),
			Labels: map[string]string{
				"service": "fastgpt-rag",
				"type":    "resource",
			},
		}
		a.triggerAlert(ctx, alert)
	}
}

// triggerAlert 触发告警
func (a *AlertManager) triggerAlert(ctx context.Context, alert *Alert) {
	logs.CtxWarnf(ctx, "Alert triggered: %s - %s (value: %.2f, threshold: %.2f)",
		alert.Level, alert.Message, alert.Value, alert.Threshold)
	
	// 调用所有告警处理器
	for _, handler := range a.handlers {
		if err := handler.Handle(ctx, alert); err != nil {
			logs.CtxErrorf(ctx, "Alert handler failed: %v", err)
		}
	}
}

// LogAlertHandler 日志告警处理器
type LogAlertHandler struct{}

func (l *LogAlertHandler) Handle(ctx context.Context, alert *Alert) error {
	logs.CtxWarnf(ctx, "ALERT [%s] %s: %s (%.2f > %.2f)",
		alert.Level, alert.Metric, alert.Message, alert.Value, alert.Threshold)
	return nil
}
