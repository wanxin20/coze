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

import { useKnowledgeParams } from '@coze-data/knowledge-stores';
import {
  OptType,
  UnitType,
} from '@coze-data/knowledge-resource-processor-core';
import {
  KnowledgeResourceProcessorLayout,
  type KnowledgeResourceProcessorLayoutProps,
} from '@coze-data/knowledge-resource-processor-base/layout/base';

import { getUploadConfig } from './config';
import { FastGPTRAGUploadProcessor } from './fastgpt-rag-processor';

export type KnowledgeResourceProcessorProps =
  KnowledgeResourceProcessorLayoutProps;

export const KnowledgeResourceProcessor = (
  props: KnowledgeResourceProcessorProps,
) => {
  const { type, opt, isFastGPTRAG } = useKnowledgeParams();
  
  // 如果是FastGPT RAG知识库，使用专用的上传处理器
  if (isFastGPTRAG) {
    return <FastGPTRAGUploadProcessor {...props} />;
  }
  
  const uploadConfig = getUploadConfig(
    type ?? UnitType.TEXT,
    opt ?? OptType.ADD,
  );
  if (!uploadConfig) {
    return <></>;
  }
  return (
    <KnowledgeResourceProcessorLayout {...props} uploadConfig={uploadConfig} />
  );
};
