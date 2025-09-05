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

import React, { type CSSProperties } from 'react';

import { type Model } from '@coze-arch/bot-api/developer_api';

import {
  ModelSelectV2,
  type ModelSelectV2Props,
} from '@/form-extensions/setters/model-select/components/selector/model-select-v2';

export interface ModelSelectProps
  extends Pick<ModelSelectV2Props, 'popoverPosition' | 'triggerRender'> {
  className?: string;
  style?: CSSProperties;
  value: number | undefined;
  onChange: (value: number) => void;
  models: Model[];
  readonly?: boolean;
}

export const ModelSelector: React.FC<ModelSelectProps> = ({
  className,
  value,
  onChange,
  models,
  readonly,
  triggerRender,
  popoverPosition,
}) => (
  <ModelSelectV2
    className={className}
    value={value}
    onChange={onChange}
    models={models}
    readonly={readonly}
    popoverPosition={popoverPosition}
    triggerRender={triggerRender}
  />
);
