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

import { nanoid } from '@flowgram-adapter/free-layout-editor';
import { ViewVariableType } from '@coze-workflow/nodes';
import { I18n } from '@coze-arch/i18n';

export const DEFAULT_SUCCESS_OUTPUT = [
  {
    key: nanoid(),
    name: 'isSuccess',
    type: ViewVariableType.Boolean,
    required: true,
    description: I18n.t(
      'workflow_detail_variable_set_output_tooltip',
      {},
      '变量设置是否成功',
    ),
  },
];

export const DEFAULT_GET_OUTPUT = [
  {
    key: nanoid(),
    name: '',
    type: ViewVariableType.String,
    required: true,
  },
];

export enum ModeValue {
  Get = 'get',
  Set = 'set',
}
