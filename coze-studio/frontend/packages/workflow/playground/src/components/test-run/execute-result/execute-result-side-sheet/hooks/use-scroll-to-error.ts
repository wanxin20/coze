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

/* eslint-disable @coze-arch/no-deep-relative-import */
import { useScrollToNode, useScrollToLine } from '../../../../../hooks';
import { type NodeError } from '../../../../../entities/workflow-exec-state-entity';

export const useScrollToError = () => {
  const scrollToNode = useScrollToNode();
  const scrollToLine = useScrollToLine();

  const scrollToError = (error: NodeError) => {
    const { nodeId, errorType, targetNodeId } = error;
    if (errorType === 'line') {
      return scrollToLine(nodeId, targetNodeId || '');
    } else {
      return scrollToNode(nodeId);
    }
  };

  return scrollToError;
};
