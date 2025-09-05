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

import { AnswerItem } from './question-pairs-answer';
import { Field } from './field';
export function MessageOutput() {
  const { data } = useWorkflowNode();
  const outputContent = data?.inputs?.content;
  return (
    <Field label={I18n.t('workflow_241111_01')}>
      <AnswerItem
        showLabel={false}
        label=""
        content={outputContent}
        maxWidth={260}
      />
    </Field>
  );
}
