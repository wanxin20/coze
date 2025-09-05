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

import React from 'react';

import {
  ExpressionEditor as ExpressionEditorLeagcy,
  type ExpressionEditorProps,
} from '@/nodes-v2/components/expression-editor';
import { useField, withField } from '@/form';

type ExpressionEditorFieldProps = Omit<
  ExpressionEditorProps,
  'value' | 'onChange' | 'onBlur' | 'onFocus'
> & {
  dataTestName?: string;
};

function ExpressionEditor(props: ExpressionEditorFieldProps) {
  const { name, value, onChange, errors, onBlur, readonly } =
    useField<string>();

  return (
    <ExpressionEditorLeagcy
      {...props}
      name={props?.dataTestName ?? name}
      value={value as string}
      onChange={e => onChange(e as string)}
      isError={errors && errors?.length > 0}
      onBlur={onBlur}
      disableSuggestion={readonly}
    />
  );
}

export const ExpressionEditorField = withField(ExpressionEditor);
