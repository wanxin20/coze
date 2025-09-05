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

import type {
  WorkflowNodeEntity,
  WorkflowSubCanvas,
} from '@flowgram-adapter/free-layout-editor';
import {
  FlowNodeBaseType,
  FlowNodeTransformData,
} from '@flowgram-adapter/free-layout-editor';
import { FlowRendererKey } from '@flowgram-adapter/free-layout-editor';
import {
  type IPoint,
  type PaddingSchema,
  type PositionSchema,
} from '@flowgram-adapter/common';
import type { WorkflowNodeJSON } from '@coze-workflow/base';
import { I18n } from '@coze-arch/i18n';

import { LoopFunctionSize } from '../constants';
import { getLoopID } from './relation';

export const createLoopFunctionJSON = (params: {
  id: string;
  position: IPoint;
  loopNode: WorkflowNodeEntity;
}): WorkflowNodeJSON => {
  const { id, position } = params;
  return {
    id,
    type: FlowNodeBaseType.SUB_CANVAS,
    data: {},
    meta: {
      isContainer: true,
      position,
      nodeDTOType: FlowNodeBaseType.SUB_CANVAS,
      useDynamicPort: true,
      disableSideSheet: true,
      renderKey: FlowRendererKey.SUB_CANVAS,
      size: {
        width: LoopFunctionSize.width,
        height: LoopFunctionSize.height,
      },
      defaultPorts: [
        { type: 'input', portID: 'loop-function-input', disabled: true },
        { type: 'input', portID: 'loop-function-inline-input' },
        { type: 'output', portID: 'loop-function-inline-output' },
      ],
      padding: (transform: FlowNodeTransformData): PaddingSchema => ({
        top: 100,
        bottom: 60,
        left: 100,
        right: 100,
      }),
      selectable(node: WorkflowNodeEntity, mousePos?: PositionSchema): boolean {
        if (!mousePos) {
          return true;
        }
        const transform = node.getData<FlowNodeTransformData>(
          FlowNodeTransformData,
        );
        // The mouse can only be selected when the starting position does not include the current node
        return !transform.bounds.contains(mousePos.x, mousePos.y);
      },
      renderSubCanvas: () => ({
        title: I18n.t('workflow_loop_body_canva'),
        tooltip: I18n.t('workflow_loop_body_canva_tips'),
        style: {
          minWidth: LoopFunctionSize.width,
          minHeight: LoopFunctionSize.height,
        },
        renderPorts: [
          {
            id: 'loop-function-input',
            type: 'input',
            style: {
              position: 'absolute',
              left: '50%',
              top: '0',
            },
          },
          {
            id: 'loop-function-inline-input',
            type: 'input',
            style: {
              position: 'absolute',
              right: '0',
              top: '50%',
              transform: 'translateY(20px)',
            },
          },
          {
            id: 'loop-function-inline-output',
            type: 'output',
            style: {
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(20px)',
            },
          },
        ],
      }),
      subCanvas: (node: WorkflowNodeEntity): WorkflowSubCanvas | undefined => {
        const canvasNode = node;
        const parentNodeID = getLoopID(canvasNode.id);
        const parentNode = node.document.getNode(parentNodeID);
        if (!parentNode) {
          return undefined;
        }
        const subCanvas: WorkflowSubCanvas = {
          isCanvas: true,
          parentNode,
          canvasNode,
        };
        return subCanvas;
      },
    },
  };
};
