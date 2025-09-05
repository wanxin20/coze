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

import { useMemo } from 'react';

import { I18n } from '@coze-arch/i18n';

import { ExpressionEditorParserBuiltin } from '@/expression-editor/parser';
import {
  ExpressionEditorTreeHelper,
  type ExpressionEditorTreeNode,
} from '@/expression-editor';

import { type InterpolationContent } from './types';

function isEmpty(value: unknown) {
  return !value || !Array.isArray(value) || value.length === 0;
}

function useEmptyContent(
  fullVariableTree: ExpressionEditorTreeNode[] | undefined,
  variableTree: ExpressionEditorTreeNode[] | undefined,
  interpolationContent: InterpolationContent | undefined,
) {
  return useMemo(() => {
    if (!interpolationContent) {
      return;
    }

    if (isEmpty(fullVariableTree)) {
      if (interpolationContent.textBefore === '') {
        return I18n.t('workflow_variable_refer_no_input');
      }
      return;
    }

    if (isEmpty(variableTree)) {
      if (interpolationContent.text === '') {
        return I18n.t('workflow_variable_refer_no_input');
      }

      const segments = ExpressionEditorParserBuiltin.toSegments(
        interpolationContent.textBefore,
      );

      if (!segments) {
        return;
      }

      const matchTreeBranch = ExpressionEditorTreeHelper.matchTreeBranch({
        tree: fullVariableTree ?? [],
        segments,
      });
      const isMatchedButEmpty = matchTreeBranch && matchTreeBranch.length !== 0;

      if (isMatchedButEmpty) {
        return I18n.t('workflow_variable_refer_no_sub_variable');
      }

      return;
    }
    return;
  }, [fullVariableTree, variableTree, interpolationContent]);
}

export { useEmptyContent };
