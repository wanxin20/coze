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
	"encoding/json"
	"fmt"
	"time"

	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// LogLevel 日志级别
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

// RAGLogger RAG专用日志器
type RAGLogger struct {
	service   string
	component string
}

// NewRAGLogger 创建RAG日志器
func NewRAGLogger(service, component string) *RAGLogger {
	return &RAGLogger{
		service:   service,
		component: component,
	}
}

// LogEntry 日志条目
type LogEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       LogLevel               `json:"level"`
	Service     string                 `json:"service"`
	Component   string                 `json:"component"`
	Message     string                 `json:"message"`
	RequestID   string                 `json:"request_id,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	TeamID      string                 `json:"team_id,omitempty"`
	Operation   string                 `json:"operation,omitempty"`
	Duration    time.Duration          `json:"duration,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Debug 记录调试日志
func (r *RAGLogger) Debug(ctx context.Context, message string, metadata ...map[string]interface{}) {
	r.log(ctx, LogLevelDebug, message, "", metadata...)
}

// Info 记录信息日志
func (r *RAGLogger) Info(ctx context.Context, message string, metadata ...map[string]interface{}) {
	r.log(ctx, LogLevelInfo, message, "", metadata...)
}

// Warn 记录警告日志
func (r *RAGLogger) Warn(ctx context.Context, message string, metadata ...map[string]interface{}) {
	r.log(ctx, LogLevelWarn, message, "", metadata...)
}

// Error 记录错误日志
func (r *RAGLogger) Error(ctx context.Context, message string, err error, metadata ...map[string]interface{}) {
	errorMsg := ""
	if err != nil {
		errorMsg = err.Error()
	}
	r.log(ctx, LogLevelError, message, errorMsg, metadata...)
}

// LogOperation 记录操作日志
func (r *RAGLogger) LogOperation(ctx context.Context, operation string, duration time.Duration, err error, metadata ...map[string]interface{}) {
	level := LogLevelInfo
	message := fmt.Sprintf("Operation completed: %s", operation)
	errorMsg := ""
	
	if err != nil {
		level = LogLevelError
		message = fmt.Sprintf("Operation failed: %s", operation)
		errorMsg = err.Error()
	}
	
	entry := &LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Service:   r.service,
		Component: r.component,
		Message:   message,
		Operation: operation,
		Duration:  duration,
		Error:     errorMsg,
	}
	
	// 从上下文提取信息
	r.extractContextInfo(ctx, entry)
	
	// 添加元数据
	if len(metadata) > 0 {
		entry.Metadata = metadata[0]
	}
	
	r.writeLog(entry)
}

// LogSearch 记录搜索日志
func (r *RAGLogger) LogSearch(ctx context.Context, query string, datasetID string, results int, duration time.Duration, err error) {
	metadata := map[string]interface{}{
		"query":      query,
		"dataset_id": datasetID,
		"results":    results,
		"duration":   duration.String(),
	}
	
	if err != nil {
		r.Error(ctx, "Search operation failed", err, metadata)
	} else {
		r.Info(ctx, "Search operation completed", metadata)
	}
}

// LogTraining 记录训练日志
func (r *RAGLogger) LogTraining(ctx context.Context, collectionID string, status string, progress float64, err error) {
	metadata := map[string]interface{}{
		"collection_id": collectionID,
		"status":        status,
		"progress":      progress,
	}
	
	message := fmt.Sprintf("Training %s: progress %.2f%%", status, progress*100)
	
	if err != nil {
		r.Error(ctx, message, err, metadata)
	} else {
		r.Info(ctx, message, metadata)
	}
}

// LogDataSync 记录数据同步日志
func (r *RAGLogger) LogDataSync(ctx context.Context, syncType string, resourceID string, status string, err error) {
	metadata := map[string]interface{}{
		"sync_type":   syncType,
		"resource_id": resourceID,
		"status":      status,
	}
	
	message := fmt.Sprintf("Data sync %s: %s", syncType, status)
	
	if err != nil {
		r.Error(ctx, message, err, metadata)
	} else {
		r.Info(ctx, message, metadata)
	}
}

// LogAPICall 记录API调用日志
func (r *RAGLogger) LogAPICall(ctx context.Context, method string, url string, statusCode int, duration time.Duration, err error) {
	metadata := map[string]interface{}{
		"method":      method,
		"url":         url,
		"status_code": statusCode,
		"duration":    duration.String(),
	}
	
	message := fmt.Sprintf("API call: %s %s", method, url)
	
	if err != nil || statusCode >= 400 {
		if err == nil {
			err = fmt.Errorf("HTTP %d", statusCode)
		}
		r.Error(ctx, message, err, metadata)
	} else {
		r.Info(ctx, message, metadata)
	}
}

// log 通用日志记录方法
func (r *RAGLogger) log(ctx context.Context, level LogLevel, message string, errorMsg string, metadata ...map[string]interface{}) {
	entry := &LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Service:   r.service,
		Component: r.component,
		Message:   message,
		Error:     errorMsg,
	}
	
	// 从上下文提取信息
	r.extractContextInfo(ctx, entry)
	
	// 添加元数据
	if len(metadata) > 0 {
		entry.Metadata = metadata[0]
	}
	
	r.writeLog(entry)
}

// extractContextInfo 从上下文提取信息
func (r *RAGLogger) extractContextInfo(ctx context.Context, entry *LogEntry) {
	// 尝试从上下文提取请求ID
	if requestID := ctx.Value("request_id"); requestID != nil {
		if id, ok := requestID.(string); ok {
			entry.RequestID = id
		}
	}
	
	// 尝试从上下文提取用户ID
	if userID := ctx.Value("user_id"); userID != nil {
		if id, ok := userID.(string); ok {
			entry.UserID = id
		}
	}
	
	// 尝试从上下文提取团队ID
	if teamID := ctx.Value("team_id"); teamID != nil {
		if id, ok := teamID.(string); ok {
			entry.TeamID = id
		}
	}
}

// writeLog 写入日志
func (r *RAGLogger) writeLog(entry *LogEntry) {
	// 将日志条目转换为JSON
	logData, err := json.Marshal(entry)
	if err != nil {
		logs.Errorf("Failed to marshal log entry: %v", err)
		return
	}
	
	// 根据日志级别使用不同的日志方法
	switch entry.Level {
	case LogLevelDebug:
		logs.Debugf("RAG: %s", string(logData))
	case LogLevelInfo:
		logs.Infof("RAG: %s", string(logData))
	case LogLevelWarn:
		logs.Warnf("RAG: %s", string(logData))
	case LogLevelError:
		logs.Errorf("RAG: %s", string(logData))
	}
}

// AuditLogger 审计日志器
type AuditLogger struct {
	ragLogger *RAGLogger
}

// NewAuditLogger 创建审计日志器
func NewAuditLogger() *AuditLogger {
	return &AuditLogger{
		ragLogger: NewRAGLogger("fastgpt-rag", "audit"),
	}
}

// AuditEntry 审计日志条目
type AuditEntry struct {
	Timestamp    time.Time              `json:"timestamp"`
	UserID       string                 `json:"user_id"`
	TeamID       string                 `json:"team_id"`
	Action       string                 `json:"action"`
	Resource     string                 `json:"resource"`
	ResourceID   string                 `json:"resource_id"`
	Result       string                 `json:"result"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	RequestID    string                 `json:"request_id,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
}

// LogDatasetAction 记录数据集操作审计日志
func (a *AuditLogger) LogDatasetAction(ctx context.Context, action string, datasetID string, result string, details map[string]interface{}) {
	entry := &AuditEntry{
		Timestamp:  time.Now(),
		Action:     action,
		Resource:   "dataset",
		ResourceID: datasetID,
		Result:     result,
		Details:    details,
	}
	
	a.extractAuditInfo(ctx, entry)
	a.writeAuditLog(ctx, entry)
}

// LogCollectionAction 记录集合操作审计日志
func (a *AuditLogger) LogCollectionAction(ctx context.Context, action string, collectionID string, result string, details map[string]interface{}) {
	entry := &AuditEntry{
		Timestamp:  time.Now(),
		Action:     action,
		Resource:   "collection",
		ResourceID: collectionID,
		Result:     result,
		Details:    details,
	}
	
	a.extractAuditInfo(ctx, entry)
	a.writeAuditLog(ctx, entry)
}

// LogSearchAction 记录搜索操作审计日志
func (a *AuditLogger) LogSearchAction(ctx context.Context, datasetID string, query string, results int) {
	details := map[string]interface{}{
		"query":        query,
		"result_count": results,
	}
	
	entry := &AuditEntry{
		Timestamp:  time.Now(),
		Action:     "search",
		Resource:   "dataset",
		ResourceID: datasetID,
		Result:     "success",
		Details:    details,
	}
	
	a.extractAuditInfo(ctx, entry)
	a.writeAuditLog(ctx, entry)
}

// LogTrainingAction 记录训练操作审计日志
func (a *AuditLogger) LogTrainingAction(ctx context.Context, action string, collectionID string, result string, details map[string]interface{}) {
	entry := &AuditEntry{
		Timestamp:  time.Now(),
		Action:     action,
		Resource:   "training",
		ResourceID: collectionID,
		Result:     result,
		Details:    details,
	}
	
	a.extractAuditInfo(ctx, entry)
	a.writeAuditLog(ctx, entry)
}

// extractAuditInfo 从上下文提取审计信息
func (a *AuditLogger) extractAuditInfo(ctx context.Context, entry *AuditEntry) {
	// 提取用户ID
	if userID := ctx.Value("user_id"); userID != nil {
		if id, ok := userID.(string); ok {
			entry.UserID = id
		}
	}
	
	// 提取团队ID
	if teamID := ctx.Value("team_id"); teamID != nil {
		if id, ok := teamID.(string); ok {
			entry.TeamID = id
		}
	}
	
	// 提取请求ID
	if requestID := ctx.Value("request_id"); requestID != nil {
		if id, ok := requestID.(string); ok {
			entry.RequestID = id
		}
	}
	
	// 提取IP地址
	if ipAddress := ctx.Value("ip_address"); ipAddress != nil {
		if ip, ok := ipAddress.(string); ok {
			entry.IPAddress = ip
		}
	}
	
	// 提取User Agent
	if userAgent := ctx.Value("user_agent"); userAgent != nil {
		if ua, ok := userAgent.(string); ok {
			entry.UserAgent = ua
		}
	}
}

// writeAuditLog 写入审计日志
func (a *AuditLogger) writeAuditLog(ctx context.Context, entry *AuditEntry) {
	// 将审计日志作为结构化数据记录
	metadata := map[string]interface{}{
		"audit_entry": entry,
	}
	
	message := fmt.Sprintf("Audit: %s %s %s - %s", entry.Action, entry.Resource, entry.ResourceID, entry.Result)
	a.ragLogger.Info(ctx, message, metadata)
}

// PerformanceLogger 性能日志器
type PerformanceLogger struct {
	ragLogger *RAGLogger
}

// NewPerformanceLogger 创建性能日志器
func NewPerformanceLogger() *PerformanceLogger {
	return &PerformanceLogger{
		ragLogger: NewRAGLogger("fastgpt-rag", "performance"),
	}
}

// LogSlowQuery 记录慢查询日志
func (p *PerformanceLogger) LogSlowQuery(ctx context.Context, query string, duration time.Duration, threshold time.Duration) {
	if duration > threshold {
		metadata := map[string]interface{}{
			"query":     query,
			"duration":  duration.String(),
			"threshold": threshold.String(),
		}
		
		message := fmt.Sprintf("Slow query detected: %s", duration)
		p.ragLogger.Warn(ctx, message, metadata)
	}
}

// LogResourceUsage 记录资源使用日志
func (p *PerformanceLogger) LogResourceUsage(ctx context.Context, resourceType string, usage float64, threshold float64) {
	if usage > threshold {
		metadata := map[string]interface{}{
			"resource_type": resourceType,
			"usage":         usage,
			"threshold":     threshold,
		}
		
		message := fmt.Sprintf("High %s usage: %.2f", resourceType, usage)
		p.ragLogger.Warn(ctx, message, metadata)
	}
}

// LogCacheHitRate 记录缓存命中率日志
func (p *PerformanceLogger) LogCacheHitRate(ctx context.Context, cacheType string, hitRate float64) {
	metadata := map[string]interface{}{
		"cache_type": cacheType,
		"hit_rate":   hitRate,
	}
	
	message := fmt.Sprintf("Cache hit rate: %s %.2f%%", cacheType, hitRate*100)
	
	if hitRate < 0.5 { // 命中率低于50%时记录警告
		p.ragLogger.Warn(ctx, message, metadata)
	} else {
		p.ragLogger.Info(ctx, message, metadata)
	}
}

// 全局日志器实例
var (
	DefaultRAGLogger     = NewRAGLogger("fastgpt-rag", "default")
	DefaultAuditLogger   = NewAuditLogger()
	DefaultPerfLogger    = NewPerformanceLogger()
)
