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

import { I18n } from '@coze-arch/i18n';

import { withNodeConfigForm } from '@/node-registries/common/hocs';

import { OutputsField } from '../common/fields';

export const FormRender = withNodeConfigForm(() => (
  <OutputsField
    id="input-node-output"
    name="outputs"
    title={I18n.t('workflow_detail_node_parameter_input')}
    tooltip={I18n.t('workflow_241120_01')}
    addItemTitle={I18n.t('workflow_add_input')}
    withDescription
    withRequired
    allowDeleteLast
    emptyPlaceholder={I18n.t('workflow_start_no_parameter')}
    maxLimit={20}
    hasFeedback={false}
  />
));
