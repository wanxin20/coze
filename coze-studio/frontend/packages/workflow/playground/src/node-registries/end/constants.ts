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

import { TerminatePlan } from './types';
// Imported parameter path, practice running and other functions rely on this path to extract parameters
export const INPUT_PATH = 'inputs.inputParameters';
export const TERMINATE_PLAN_PATH = 'inputs.terminatePlan';
export const ANSWER_CONTENT_PATH = 'inputs.content';
export const STREAMING_OUTPUT_PATH = 'inputs.streamingOutput';
export const defaultTerminalPlanOptions = [
  {
    value: TerminatePlan.ReturnVariables,
    label: I18n.t('workflow_241111_02'),
  },
  {
    value: TerminatePlan.UseAnswerContent,
    label: I18n.t('workflow_241111_03'),
  },
];
