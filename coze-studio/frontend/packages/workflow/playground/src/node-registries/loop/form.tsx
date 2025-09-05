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

import { PrivateScopeProvider } from '@coze-workflow/variable';

import { NodeConfigForm } from '@/node-registries/common/components';

import {
  LoopArrayField,
  LoopCountField,
  LoopOutputsField,
  LoopSettingsSection,
  LoopTypeField,
  LoopVariablesField,
} from './loop-fields';
import { LoopPath } from './constants';

export const LoopFormRender = () => (
  <NodeConfigForm>
    <PrivateScopeProvider>
      <LoopSettingsSection>
        <LoopTypeField name={LoopPath.LoopType} />
        <LoopCountField name={LoopPath.LoopCount} />
      </LoopSettingsSection>
      <LoopArrayField name={LoopPath.LoopArray} />
      <LoopVariablesField name={LoopPath.LoopVariables} />
    </PrivateScopeProvider>
    <LoopOutputsField name={LoopPath.LoopOutputs} />
  </NodeConfigForm>
);
