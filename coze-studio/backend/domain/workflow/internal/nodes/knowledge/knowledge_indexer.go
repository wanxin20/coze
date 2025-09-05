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
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/spf13/cast"

	"github.com/coze-dev/coze-studio/backend/api/model/crossdomain/knowledge"
	crossknowledge "github.com/coze-dev/coze-studio/backend/crossdomain/contract/knowledge"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
	"github.com/coze-dev/coze-studio/backend/infra/contract/document/parser"
)

type IndexerConfig struct {
	KnowledgeID      int64
	ParsingStrategy  *knowledge.ParsingStrategy
	ChunkingStrategy *knowledge.ChunkingStrategy
}

func (i *IndexerConfig) Adapt(_ context.Context, n *vo.Node, _ ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{
		Key:     vo.NodeKey(n.ID),
		Type:    entity.NodeTypeKnowledgeIndexer,
		Name:    n.Data.Meta.Title,
		Configs: i,
	}

	inputs := n.Data.Inputs
	datasetListInfoParam := inputs.DatasetParam[0]
	datasetIDs := datasetListInfoParam.Input.Value.Content.([]any)
	if len(datasetIDs) == 0 {
		return nil, fmt.Errorf("dataset ids is required")
	}
	knowledgeID, err := cast.ToInt64E(datasetIDs[0])
	if err != nil {
		return nil, err
	}

	i.KnowledgeID = knowledgeID
	ps := inputs.StrategyParam.ParsingStrategy
	parseMode, err := convertParsingType(ps.ParsingType)
	if err != nil {
		return nil, err
	}
	parsingStrategy := &knowledge.ParsingStrategy{
		ParseMode:    parseMode,
		ImageOCR:     ps.ImageOcr,
		ExtractImage: ps.ImageExtraction,
		ExtractTable: ps.TableExtraction,
	}
	i.ParsingStrategy = parsingStrategy

	cs := inputs.StrategyParam.ChunkStrategy
	chunkType, err := convertChunkType(cs.ChunkType)
	if err != nil {
		return nil, err
	}
	chunkingStrategy := &knowledge.ChunkingStrategy{
		ChunkType: chunkType,
		Separator: cs.Separator,
		ChunkSize: cs.MaxToken,
		Overlap:   int64(cs.Overlap * float64(cs.MaxToken)),
	}
	i.ChunkingStrategy = chunkingStrategy

	if err = convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	if err = convert.SetOutputTypesForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	return ns, nil
}

func (i *IndexerConfig) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	if i.ParsingStrategy == nil {
		return nil, errors.New("parsing strategy is required")
	}
	if i.ChunkingStrategy == nil {
		return nil, errors.New("chunking strategy is required")
	}
	return &Indexer{
		knowledgeID:      i.KnowledgeID,
		parsingStrategy:  i.ParsingStrategy,
		chunkingStrategy: i.ChunkingStrategy,
	}, nil
}

type Indexer struct {
	knowledgeID      int64
	parsingStrategy  *knowledge.ParsingStrategy
	chunkingStrategy *knowledge.ChunkingStrategy
}

func (k *Indexer) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
	fileURL, ok := input["knowledge"].(string)
	if !ok {
		return nil, errors.New("knowledge is required")
	}

	fileName, ext, err := parseToFileNameAndFileExtension(fileURL)

	if err != nil {
		return nil, err
	}

	req := &knowledge.CreateDocumentRequest{
		KnowledgeID:      k.knowledgeID,
		ParsingStrategy:  k.parsingStrategy,
		ChunkingStrategy: k.chunkingStrategy,
		FileURL:          fileURL,
		FileName:         fileName,
		FileExtension:    ext,
	}

	response, err := crossknowledge.DefaultSVC().Store(ctx, req)
	if err != nil {
		return nil, err
	}

	result := make(map[string]any)
	result["documentId"] = response.DocumentID
	result["fileName"] = response.FileName
	result["fileUrl"] = response.FileURL

	return result, nil
}

func parseToFileNameAndFileExtension(fileURL string) (string, parser.FileExtension, error) {

	u, err := url.Parse(fileURL)
	if err != nil {
		return "", "", err
	}

	fileName := u.Query().Get("x-wf-file_name")
	if len(fileName) == 0 {
		return "", "", errors.New("file name is required")
	}

	fileExt := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))

	ext, support := parser.ValidateFileExtension(fileExt)
	if !support {
		return "", "", fmt.Errorf("unsupported file type: %s", fileExt)
	}
	return fileName, ext, nil
}
