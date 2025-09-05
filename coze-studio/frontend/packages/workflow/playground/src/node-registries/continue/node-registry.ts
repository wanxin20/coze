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

import { DEFAULT_NODE_META_PATH } from '@coze-workflow/nodes';
import {
  StandardNodeType,
  type WorkflowNodeRegistry,
} from '@coze-workflow/base';

import { CONTINUE_FORM_META } from './form-meta';

export const CONTINUE_NODE_REGISTRY: WorkflowNodeRegistry = {
  type: StandardNodeType.Continue,
  meta: {
    isNodeEnd: true,
    hideTest: true,
    nodeDTOType: StandardNodeType.Continue,
    defaultPorts: [{ type: 'input' }],
    size: { width: 360, height: 67.86 },
    nodeMetaPath: DEFAULT_NODE_META_PATH,
  },
  formMeta: CONTINUE_FORM_META,
  getOutputPoints: () => [], // Continue node has no output
};
