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

	"github.com/coze-dev/coze-studio/backend/api/model/crossdomain/knowledge"
)

//go:generate  mockgen -destination knowledgemock/knowledge_mock.go --package knowledgemock -source knowledge.go
type Knowledge interface {
	ListKnowledge(ctx context.Context, request *knowledge.ListKnowledgeRequest) (response *knowledge.ListKnowledgeResponse, err error)
	GetKnowledgeByID(ctx context.Context, request *knowledge.GetKnowledgeByIDRequest) (response *knowledge.GetKnowledgeByIDResponse, err error)
	Retrieve(ctx context.Context, req *knowledge.RetrieveRequest) (*knowledge.RetrieveResponse, error)
	DeleteKnowledge(ctx context.Context, request *knowledge.DeleteKnowledgeRequest) error
	MGetKnowledgeByID(ctx context.Context, request *knowledge.MGetKnowledgeByIDRequest) (response *knowledge.MGetKnowledgeByIDResponse, err error)
	Store(ctx context.Context, document *knowledge.CreateDocumentRequest) (*knowledge.CreateDocumentResponse, error)
	Delete(ctx context.Context, r *knowledge.DeleteDocumentRequest) (*knowledge.DeleteDocumentResponse, error)
	ListKnowledgeDetail(ctx context.Context, req *knowledge.ListKnowledgeDetailRequest) (*knowledge.ListKnowledgeDetailResponse, error)
}

var defaultSVC Knowledge

func DefaultSVC() Knowledge {
	return defaultSVC
}

func SetDefaultSVC(c Knowledge) {
	defaultSVC = c
}
