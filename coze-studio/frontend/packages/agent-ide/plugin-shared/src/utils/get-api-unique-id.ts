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

import { type PluginApi } from '@coze-arch/bot-api/developer_api';

export const getApiUniqueId = ({
  apiInfo,
}: {
  apiInfo?: Pick<PluginApi, 'plugin_id' | 'name'>;
}): string =>
  apiInfo?.name && apiInfo?.plugin_id
    ? `${apiInfo.name}_${apiInfo.plugin_id}`
    : '';
