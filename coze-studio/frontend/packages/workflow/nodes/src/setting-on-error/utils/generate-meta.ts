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

import { nanoid } from 'nanoid';
import { ViewVariableType } from '@coze-workflow/base';

import { ERROR_BODY_NAME, IS_SUCCESS_NAME } from '../constants';

export const generateErrorBodyMeta = () => ({
  key: nanoid(),
  name: ERROR_BODY_NAME,
  type: ViewVariableType.Object,
  readonly: true,
  children: [
    {
      key: nanoid(),
      name: 'errorMessage',
      type: ViewVariableType.String,
      readonly: true,
    },
    {
      key: nanoid(),
      name: 'errorCode',
      type: ViewVariableType.String,
      readonly: true,
    },
  ],
});

export const generateIsSuccessMeta = () => ({
  key: nanoid(),
  name: IS_SUCCESS_NAME,
  type: ViewVariableType.Boolean,
  readonly: true,
});
