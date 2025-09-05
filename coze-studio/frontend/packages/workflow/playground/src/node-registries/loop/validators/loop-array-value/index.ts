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

/* eslint-disable  @typescript-eslint/naming-convention*/
import { get } from 'lodash-es';
import { type Validate } from '@flowgram-adapter/free-layout-editor';
import { type ValueExpression } from '@coze-workflow/base';

import { LoopInputValueValidator } from '../loop-input-value';
import { LoopPath, LoopType } from '../../constants';

export const LoopArrayValueValidator: Validate<ValueExpression> = params => {
  const { formValues } = params;
  const loopType = get(formValues, LoopPath.LoopType);
  if (loopType !== LoopType.Array) {
    return;
  }
  return LoopInputValueValidator(params);
};
