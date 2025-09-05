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

import { SearchScope } from '@coze-arch/idl/intelligence_api';

import { DevelopCustomPublishStatus } from '../type';

export function isPublishStatus(
  val: unknown,
): val is DevelopCustomPublishStatus {
  const statusList: unknown[] = [
    DevelopCustomPublishStatus.All,
    DevelopCustomPublishStatus.NoPublish,
    DevelopCustomPublishStatus.Publish,
  ];

  return statusList.includes(val);
}

export const isRecentOpen = (val: unknown) => val === 'recentOpened';

export const isSearchScopeEnum = (val: unknown): val is SearchScope =>
  val === SearchScope.All || val === SearchScope.CreateByMe;
