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

import { type PublishPluginRequest } from '@coze-arch/idl/plugin_develop';
import { I18n } from '@coze-arch/i18n';
import { type BaseFormProps, Form } from '@coze-arch/coze-design';

export type VersionDescFormValue = Pick<
  PublishPluginRequest,
  'version_desc' | 'version_name'
>;

const versionDescFormFiledMap: Record<
  keyof VersionDescFormValue,
  keyof VersionDescFormValue
> = {
  version_desc: 'version_desc',
  version_name: 'version_name',
};

export const VersionDescForm: React.FC<
  BaseFormProps<VersionDescFormValue>
> = formProps => (
  <Form<VersionDescFormValue> {...formProps}>
    <Form.Input
      noErrorMessage
      field={versionDescFormFiledMap.version_name}
      label={I18n.t('plugin_publish_form_version')}
      rules={[{ required: true }]}
      maxLength={40}
    />
    <Form.TextArea
      noErrorMessage
      field={versionDescFormFiledMap.version_desc}
      label={I18n.t('plugin_publish_form_version_desc')}
      rules={[{ required: true }]}
      maxLength={800}
    />
  </Form>
);
