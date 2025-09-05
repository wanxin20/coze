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

export const CONVERSATION_NAME = 'conversationName';

export const PARAMS_COLUMNS = [
  {
    title: I18n.t('workflow_detail_node_parameter_name'),
    style: { width: 180 },
  },
  {
    title: I18n.t('workflow_detail_node_parameter_value'),
    style: { flex: '1' },
  },
];

export const INPUT_COLUMNS_NARROW = [
  {
    title: I18n.t('workflow_detail_node_parameter_name'),
    style: { width: 140 },
  },
  {
    title: I18n.t('workflow_detail_node_parameter_value'),
    style: { flex: '1' },
  },
];
