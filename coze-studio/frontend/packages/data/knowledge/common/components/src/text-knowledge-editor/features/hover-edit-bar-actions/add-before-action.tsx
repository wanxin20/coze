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

import React from 'react';

import { KnowledgeE2e } from '@coze-data/e2e';
import { I18n } from '@coze-arch/i18n';
import { IconCozDocumentAddTop } from '@coze-arch/coze-design/icons';
import { IconButton, Tooltip } from '@coze-arch/coze-design';

import { useAddEmptyChunkAction } from '@/text-knowledge-editor/hooks/use-case/chunk-actions';
import { eventBus } from '@/text-knowledge-editor/event';

import { type HoverEditBarActionProps } from './module';

/**
 * Add the action component of a new sharding before a specific sharding
 */
export const AddBeforeAction: React.FC<HoverEditBarActionProps> = ({
  chunk,
  chunks = [],
  disabled,
}) => {
  // Add new shardings before specific shardings
  const { addEmptyChunkBefore } = useAddEmptyChunkAction({
    chunks,
    onChunksChange: ({ newChunk, chunks: newChunks }) => {
      eventBus.emit('hoverEditBarAction', {
        type: 'add-before',
        targetChunk: chunk,
        chunks: newChunks,
        newChunk,
      });
    },
  });

  return (
    <Tooltip
      content={I18n.t('knowledge_optimize_017')}
      clickToHide
      autoAdjustOverflow
    >
      <IconButton
        data-dtestid={`${KnowledgeE2e.SegmentDetailContentItemAddTopIcon}.${chunk.text_knowledge_editor_chunk_uuid}`}
        size="small"
        color="secondary"
        disabled={disabled}
        icon={<IconCozDocumentAddTop className="text-[14px]" />}
        iconPosition="left"
        className="coz-fg-secondary leading-none !w-6 !h-6"
        onClick={() => addEmptyChunkBefore(chunk)}
      />
    </Tooltip>
  );
};
