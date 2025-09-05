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

import { useWorkflowNode } from '@coze-workflow/base';
import { I18n } from '@coze-arch/i18n';

import { VariableTagList } from './variable-tag-list';
import { useInputParametersVariableTags } from './use-input-parameters-variable-tags';
import { Field } from './field';

interface InputParametersProps {
  label?: string;
}

export function InputParameters({
  label = I18n.t('workflow_detail_node_parameter_input'),
}: InputParametersProps) {
  const { inputParameters } = useWorkflowNode();
  const variableTags = useInputParametersVariableTags(inputParameters);

  const isEmpty = !variableTags || variableTags.length === 0;

  return (
    <Field label={label} isEmpty={isEmpty}>
      <VariableTagList value={variableTags} />
    </Field>
  );
}
