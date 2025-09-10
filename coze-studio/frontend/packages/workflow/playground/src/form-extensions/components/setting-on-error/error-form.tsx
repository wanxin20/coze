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

import React, { useMemo } from 'react';

import { I18n } from '@coze-arch/i18n';
import { Switch } from '@coze-arch/coze-design';

import { JsonEditorAdapter as JsonEditorAdapterNew } from '@/components/test-run/test-form-materials/json-editor/new';

import { FormItemFeedback } from '../form-item-feedback';
import { FormCard } from '../form-card';
import { generateJSONSchema } from './utils/generate-json-schema';
import { type ErrorFormProps } from './types';

import styles from './index.module.less';

const ErrorFormCard: React.FC<ErrorFormProps> = ({
  isOpen = false,
  onSwitchChange,
  json,
  onJSONChange,
  readonly,
  errorMsg,
  defaultValue,
  noPadding,
  outputs,
}) => (
  <FormCard
    header={I18n.t('workflow_exception_ignore_title')}
    tooltip={I18n.t('workflow_exception_ignore_icon_tips')}
    actionButton={
      <div className="flex items-center h-6">
        <Switch
          size="mini"
          checked={isOpen}
          onChange={onSwitchChange}
          disabled={readonly}
        />
      </div>
    }
    noPadding={noPadding}
  >
    <div className="text-xs leading-[16px] coz-fg-secondary">
      {I18n.t('workflow_exception_ignore_desc')}
    </div>

    {isOpen ? (
      <div className="mt-[12px]">
        <div className="text-xs coz-fg-primary leading-[16px] font-medium">
          {I18n.t('workflow_exception_ignore_default_output')}
          <span className="coz-fg-hglt-red">*</span>
        </div>
        <div className={'mt-[4px]'}>
          <JsonEditorAdapterNew
            className={styles['json-editor']}
            value={json ?? ''}
            jsonSchema={generateJSONSchema(outputs)}
            options={{
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
            }}
            onChange={onJSONChange}
            disabled={readonly}
            height={200}
            defaultValue={defaultValue}
          />
        </div>
      </div>
    ) : undefined}
    {errorMsg ? (
      <FormItemFeedback feedbackText={errorMsg}></FormItemFeedback>
    ) : undefined}
  </FormCard>
);

export const ErrorForm: React.FC<ErrorFormProps> = ({
  isOpen = false,
  json,
  onSwitchChange,
  onJSONChange,
  readonly,
  errorMsg,
  defaultValue,
  noPadding,
  outputs,
}) => {
  const hasError = useMemo(() => {
    if (!isOpen) {
      return { rs: true };
    } else {
      // If there is an external error, just report the error directly.
      if (errorMsg) {
        return { rs: false, msg: errorMsg };
      }
      // When isOpen = true for the first time, json will be given the default value, and json = undefined for a moment. Just return true, otherwise it will flash.
      if (json === undefined) {
        return { rs: true };
      }
      try {
        const obj = JSON.parse(json);
        if (typeof obj !== 'object') {
          return {
            rs: false,
            msg: I18n.t('workflow_exception_ignore_json_error'),
          };
        }
        return { rs: true };
        // eslint-disable-next-line @coze-arch/use-error-in-catch
      } catch (e) {
        return {
          rs: false,
          msg: I18n.t('workflow_exception_ignore_json_error'),
        };
      }
    }
  }, [isOpen, json, errorMsg]);

  return (
    <ErrorFormCard
      isOpen={isOpen}
      json={json}
      onSwitchChange={onSwitchChange}
      onJSONChange={onJSONChange}
      readonly={readonly}
      errorMsg={hasError.msg}
      defaultValue={defaultValue}
      noPadding={noPadding}
      outputs={outputs}
    />
  );
};
