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
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/knowledge/service"

)

// RAGServiceManager RAG服务管理器
type RAGServiceManager struct {
	client         service.RAGClient
	// syncService    service.RAGSyncService // 已移除RAGSyncService，采用直接API调用
	monitoring     *MonitoringService
	alertManager   *AlertManager
	logger         *RAGLogger
	auditLogger    *AuditLogger
	perfLogger     *PerformanceLogger
	
	config         *RAGConfig
	initialized    bool
}

// RAGConfig RAG服务配置
type RAGConfig struct {
	// 服务配置
	ServiceURL    string        `yaml:"service_url"`
	Timeout       time.Duration `yaml:"timeout"`
	MaxRetries    int           `yaml:"max_retries"`
	AuthToken     string        `yaml:"auth_token"`
	
	// 监控配置
	MonitoringEnabled     bool          `yaml:"monitoring_enabled"`
	MonitoringInterval    time.Duration `yaml:"monitoring_interval"`
	HealthCheckInterval   time.Duration `yaml:"health_check_interval"`
	MetricsRetentionDays  int           `yaml:"metrics_retention_days"`
	
	// 告警配置
	AlertingEnabled       bool                   `yaml:"alerting_enabled"`
	AlertThresholds       map[string]float64     `yaml:"alert_thresholds"`
	AlertHandlers         []string               `yaml:"alert_handlers"`
	
	// 日志配置
	LogLevel              string                 `yaml:"log_level"`
	AuditEnabled          bool                   `yaml:"audit_enabled"`
	PerformanceEnabled    bool                   `yaml:"performance_enabled"`
	SlowQueryThreshold    time.Duration          `yaml:"slow_query_threshold"`
	
	// 同步配置
	SyncEnabled           bool                   `yaml:"sync_enabled"`
	SyncBatchSize         int                    `yaml:"sync_batch_size"`
	SyncInterval          time.Duration          `yaml:"sync_interval"`
	AutoSyncOnCreate      bool                   `yaml:"auto_sync_on_create"`
	AutoSyncOnUpdate      bool                   `yaml:"auto_sync_on_update"`
	
	// 缓存配置
	CacheEnabled          bool                   `yaml:"cache_enabled"`
	CacheTTL              time.Duration          `yaml:"cache_ttl"`
	CacheSize             int                    `yaml:"cache_size"`
}

// DefaultRAGConfig 默认RAG配置
func DefaultRAGConfig() *RAGConfig {
	return &RAGConfig{
		ServiceURL:            "http://fastgpt-rag:3001",
		Timeout:               30 * time.Second,
		MaxRetries:            3,
		
		MonitoringEnabled:     true,
		MonitoringInterval:    60 * time.Second,
		HealthCheckInterval:   30 * time.Second,
		MetricsRetentionDays:  30,
		
		AlertingEnabled:       true,
		AlertThresholds: map[string]float64{
			"search_error_rate":  5.0,  // 5%
			"search_latency":     2000, // 2秒
			"memory_usage":       1024, // 1GB
			"cpu_usage":          80.0, // 80%
		},
		AlertHandlers:         []string{"log"},
		
		LogLevel:              "info",
		AuditEnabled:          true,
		PerformanceEnabled:    true,
		SlowQueryThreshold:    1 * time.Second,
		
		SyncEnabled:           true,
		SyncBatchSize:         100,
		SyncInterval:          5 * time.Minute,
		AutoSyncOnCreate:      true,
		AutoSyncOnUpdate:      true,
		
		CacheEnabled:          true,
		CacheTTL:              5 * time.Minute,
		CacheSize:             1000,
	}
}

// NewRAGServiceManager 创建RAG服务管理器
func NewRAGServiceManager(config *RAGConfig) *RAGServiceManager {
	if config == nil {
		config = DefaultRAGConfig()
	}
	
	return &RAGServiceManager{
		config:      config,
		logger:      NewRAGLogger("fastgpt-rag", "manager"),
		auditLogger: NewAuditLogger(),
		perfLogger:  NewPerformanceLogger(),
	}
}

// Initialize 初始化RAG服务
func (m *RAGServiceManager) Initialize(ctx context.Context) error {
	if m.initialized {
		return fmt.Errorf("RAG service already initialized")
	}
	
	m.logger.Info(ctx, "Initializing RAG service manager", map[string]interface{}{
		"service_url": m.config.ServiceURL,
		"monitoring":  m.config.MonitoringEnabled,
		"alerting":    m.config.AlertingEnabled,
	})
	
	// 1. 初始化RAG客户端
	if err := m.initializeClient(ctx); err != nil {
		return fmt.Errorf("initialize client failed: %w", err)
	}
	
	// 2. 初始化同步服务（已移除，采用直接API调用）
	// if err := m.initializeSyncService(ctx); err != nil {
	//	return fmt.Errorf("initialize sync service failed: %w", err)
	// }
	
	// 3. 初始化监控服务
	if m.config.MonitoringEnabled {
		if err := m.initializeMonitoring(ctx); err != nil {
			return fmt.Errorf("initialize monitoring failed: %w", err)
		}
	}
	
	// 4. 初始化告警管理
	if m.config.AlertingEnabled {
		if err := m.initializeAlerting(ctx); err != nil {
			return fmt.Errorf("initialize alerting failed: %w", err)
		}
	}
	
	// 5. 验证服务连接
	if err := m.validateConnection(ctx); err != nil {
		return fmt.Errorf("validate connection failed: %w", err)
	}
	
	m.initialized = true
	m.logger.Info(ctx, "RAG service manager initialized successfully")
	
	return nil
}

// initializeClient 初始化RAG客户端
func (m *RAGServiceManager) initializeClient(ctx context.Context) error {
	clientConfig := &Config{
		BaseURL:    m.config.ServiceURL,
		Timeout:    m.config.Timeout,
		MaxRetries: m.config.MaxRetries,
		AuthToken:  m.config.AuthToken,
	}
	
	m.client = NewRAGClient(clientConfig)
	m.logger.Info(ctx, "RAG client initialized", map[string]interface{}{
		"base_url": clientConfig.BaseURL,
		"timeout":  clientConfig.Timeout.String(),
	})
	
	return nil
}

// initializeSyncService 初始化同步服务
func (m *RAGServiceManager) initializeSyncService(ctx context.Context) error {
	if !m.config.SyncEnabled {
		m.logger.Info(ctx, "RAG sync service disabled")
		return nil
	}
	
	// 这里需要注入实际的存储库实现
	// m.syncService = service.NewRAGSyncService(m.client, knowledgeRepo, documentRepo, sliceRepo)
	
	m.logger.Info(ctx, "RAG sync service initialized", map[string]interface{}{
		"batch_size":          m.config.SyncBatchSize,
		"sync_interval":       m.config.SyncInterval.String(),
		"auto_sync_on_create": m.config.AutoSyncOnCreate,
		"auto_sync_on_update": m.config.AutoSyncOnUpdate,
	})
	
	return nil
}

// initializeMonitoring 初始化监控服务
func (m *RAGServiceManager) initializeMonitoring(ctx context.Context) error {
	// 创建监控服务，不依赖具体的客户端实现
	m.monitoring = NewMonitoringService(m.client)
	
	// 启动监控服务
	if err := m.monitoring.Start(ctx, m.config.MonitoringInterval); err != nil {
		return fmt.Errorf("start monitoring service failed: %w", err)
	}
	
	m.logger.Info(ctx, "RAG monitoring service initialized", map[string]interface{}{
		"interval":       m.config.MonitoringInterval.String(),
		"health_check":   m.config.HealthCheckInterval.String(),
		"retention_days": m.config.MetricsRetentionDays,
	})
	
	return nil
}

// initializeAlerting 初始化告警管理
func (m *RAGServiceManager) initializeAlerting(ctx context.Context) error {
	m.alertManager = NewAlertManager()
	
	// 设置告警阈值
	for metric, threshold := range m.config.AlertThresholds {
		m.alertManager.SetThreshold(metric, threshold)
	}
	
	// 注册告警处理器
	for _, handlerType := range m.config.AlertHandlers {
		switch handlerType {
		case "log":
			m.alertManager.RegisterHandler(&LogAlertHandler{})
		default:
			m.logger.Warn(ctx, "Unknown alert handler type", map[string]interface{}{
				"handler_type": handlerType,
			})
		}
	}
	
	m.logger.Info(ctx, "RAG alert manager initialized", map[string]interface{}{
		"thresholds": m.config.AlertThresholds,
		"handlers":   m.config.AlertHandlers,
	})
	
	return nil
}

// validateConnection 验证服务连接
func (m *RAGServiceManager) validateConnection(ctx context.Context) error {
	m.logger.Info(ctx, "Validating RAG service connection")
	
	health, err := m.client.GetHealth(ctx)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	
	if health.Status != "ok" {
		return fmt.Errorf("RAG service unhealthy: %s", health.Status)
	}
	
	m.logger.Info(ctx, "RAG service connection validated", map[string]interface{}{
		"status":     health.Status,
		"version":    health.Version,
		"timestamp":  health.Timestamp,
		"capabilities": health.Capabilities,
	})
	
	return nil
}

// Shutdown 关闭RAG服务
func (m *RAGServiceManager) Shutdown(ctx context.Context) error {
	if !m.initialized {
		return nil
	}
	
	m.logger.Info(ctx, "Shutting down RAG service manager")
	
	// 停止监控服务
	if m.monitoring != nil {
		if err := m.monitoring.Stop(); err != nil {
			m.logger.Error(ctx, "Failed to stop monitoring service", err)
		}
	}
	
	m.initialized = false
	m.logger.Info(ctx, "RAG service manager shut down")
	
	return nil
}

// GetClient 获取RAG客户端
func (m *RAGServiceManager) GetClient() service.RAGClient {
	return m.client
}

// GetSyncService 获取同步服务（已移除）
// func (m *RAGServiceManager) GetSyncService() service.RAGSyncService {
//	return m.syncService
// }

// GetMetrics 获取监控指标
func (m *RAGServiceManager) GetMetrics() *RAGMetrics {
	if m.monitoring == nil {
		return nil
	}
	return m.monitoring.GetMetrics()
}

// CheckAlerts 检查告警
func (m *RAGServiceManager) CheckAlerts(ctx context.Context) {
	if m.alertManager == nil || m.monitoring == nil {
		return
	}
	
	metrics := m.monitoring.GetMetrics()
	if metrics != nil {
		m.alertManager.CheckMetrics(ctx, metrics)
	}
}

// IsInitialized 检查是否已初始化
func (m *RAGServiceManager) IsInitialized() bool {
	return m.initialized
}

// GetConfig 获取配置
func (m *RAGServiceManager) GetConfig() *RAGConfig {
	return m.config
}

// 全局RAG服务管理器实例
var GlobalRAGManager *RAGServiceManager

// InitializeGlobalRAGManager 初始化全局RAG管理器
func InitializeGlobalRAGManager(ctx context.Context, config *RAGConfig) error {
	if GlobalRAGManager != nil && GlobalRAGManager.IsInitialized() {
		return fmt.Errorf("global RAG manager already initialized")
	}
	
	GlobalRAGManager = NewRAGServiceManager(config)
	return GlobalRAGManager.Initialize(ctx)
}

// ShutdownGlobalRAGManager 关闭全局RAG管理器
func ShutdownGlobalRAGManager(ctx context.Context) error {
	if GlobalRAGManager == nil {
		return nil
	}
	
	return GlobalRAGManager.Shutdown(ctx)
}

// GetGlobalRAGClient 获取全局RAG客户端
func GetGlobalRAGClient() service.RAGClient {
	if GlobalRAGManager == nil {
		return nil
	}
	return GlobalRAGManager.GetClient()
}

// GetGlobalRAGSyncService 获取全局RAG同步服务（已移除）
// func GetGlobalRAGSyncService() service.RAGSyncService {
//	if GlobalRAGManager == nil {
//		return nil
//	}
//	return GlobalRAGManager.GetSyncService()
// }
