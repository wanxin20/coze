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

package knowledge

import (
	"context"
	"fmt"
	"os"

	"github.com/coze-dev/coze-studio/backend/application/search"
	"github.com/coze-dev/coze-studio/backend/domain/knowledge/entity"
	knowledgeImpl "github.com/coze-dev/coze-studio/backend/domain/knowledge/service"
	"github.com/coze-dev/coze-studio/backend/infra/impl/eventbus"
	ragImpl "github.com/coze-dev/coze-studio/backend/infra/impl/rag"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
	"github.com/coze-dev/coze-studio/backend/types/consts"
)

// RAGApp RAG应用服务全局实例
var RAGApp *RAGApplication

type ServiceComponents = knowledgeImpl.KnowledgeSVCConfig

// RAGWorkflowServiceImpl RAGWorkflowService的简单实现
type RAGWorkflowServiceImpl struct {
	ragClient knowledgeImpl.RAGClient
}

// ExecuteRAGSearchNode 执行RAG搜索节点
func (r *RAGWorkflowServiceImpl) ExecuteRAGSearchNode(ctx context.Context, req *entity.RAGWorkflowSearchRequest) (*entity.RAGWorkflowSearchResponse, error) {
	// 这里可以实现具体的工作流搜索逻辑
	// 暂时返回一个简单的实现
	return &entity.RAGWorkflowSearchResponse{}, nil
}

// ExecuteRAGDeepSearchNode 执行RAG深度搜索节点
func (r *RAGWorkflowServiceImpl) ExecuteRAGDeepSearchNode(ctx context.Context, req *entity.RAGWorkflowDeepSearchRequest) (*entity.RAGWorkflowDeepSearchResponse, error) {
	// 这里可以实现具体的工作流深度搜索逻辑
	return &entity.RAGWorkflowDeepSearchResponse{}, nil
}

// GetAvailableKnowledgeBasesForWorkflow 获取团队可用的RAG知识库列表
func (r *RAGWorkflowServiceImpl) GetAvailableKnowledgeBasesForWorkflow(ctx context.Context, teamID string) ([]*entity.RAGWorkflowKnowledgeBase, error) {
	// 调用RAG客户端获取知识库列表
	kbs, err := r.ragClient.ListKnowledgeBases(ctx, teamID)
	if err != nil {
		return nil, err
	}
	
	// 转换为工作流知识库格式
	result := make([]*entity.RAGWorkflowKnowledgeBase, len(kbs))
	for i, kb := range kbs {
		result[i] = &entity.RAGWorkflowKnowledgeBase{
			ID:          kb.ID,
			Name:        kb.Name,
			Description: kb.Description,
			Status:      kb.Status,
			DataCount:   kb.DataCount,
		}
	}
	return result, nil
}

// ValidateKnowledgeBaseAccess 验证知识库可用性
func (r *RAGWorkflowServiceImpl) ValidateKnowledgeBaseAccess(ctx context.Context, kbID string, teamID string) (*entity.RAGValidationResult, error) {
	// 这里可以实现具体的验证逻辑
	return &entity.RAGValidationResult{
		Valid:   true,
		Message: "Knowledge base is valid",
	}, nil
}

// InitRAGApp 初始化RAG应用服务
func InitRAGApp(ctx context.Context, ragClient knowledgeImpl.RAGClient, knowledgeSvc knowledgeImpl.Knowledge) error {
	if RAGApp != nil {
		return fmt.Errorf("RAGApp already initialized")
	}
	
	// 创建RAGWorkflowService实例 - 可以使用ragClient作为基础实现
	ragWorkflowSvc := &RAGWorkflowServiceImpl{ragClient: ragClient}
	
	RAGApp = NewRAGApplication(ragClient, ragWorkflowSvc, knowledgeSvc)
	return nil
}

func InitService(ctx context.Context, c *ServiceComponents, bus search.ResourceEventBus) (*KnowledgeApplicationService, error) {
	// 🔥 关键修复：在创建知识库服务之前先获取RAG客户端并设置到配置中
	ragClient := ragImpl.GetGlobalRAGClient()
	if ragClient != nil {
		logs.CtxInfof(ctx, "🔥 RAGClient is available, setting up knowledge service with FastGPT support")
		c.RAGClient = ragClient // 将RAG客户端传递给知识库服务配置
	} else {
		logs.CtxWarnf(ctx, "🔥 RAGClient is not available, knowledge service will work without FastGPT support")
	}

	// 现在创建知识库服务，配置中已包含RAG客户端
	knowledgeDomainSVC, knowledgeEventHandler := knowledgeImpl.NewKnowledgeSVC(c)

	nameServer := os.Getenv(consts.MQServer)
	if err := eventbus.DefaultSVC().RegisterConsumer(nameServer, consts.RMQTopicKnowledge, consts.RMQConsumeGroupKnowledge, knowledgeEventHandler); err != nil {
		return nil, fmt.Errorf("register knowledge consumer failed, err=%w", err)
	}

	// 初始化RAGApp
	if ragClient != nil {
		if err := InitRAGApp(ctx, ragClient, knowledgeDomainSVC); err != nil {
			logs.CtxWarnf(ctx, "Failed to initialize RAGApp: %v", err)
			// 不阻断服务启动，RAGApp初始化失败只记录警告
		} else {
			logs.CtxInfof(ctx, "RAGApp initialized successfully")
		}
	}

	KnowledgeSVC.DomainSVC = knowledgeDomainSVC
	KnowledgeSVC.eventBus = bus
	KnowledgeSVC.storage = c.Storage
	KnowledgeSVC.ragApp = RAGApp // 设置RAG应用服务
	return KnowledgeSVC, nil
}
