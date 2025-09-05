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

import { isEqual } from 'lodash-es';

import { type LimitWaitingSelector } from '../../types/plugin-class/selector';
import { type Selector } from '../../types';
import { useChatAreaStoreSet } from '../../../hooks/context/use-chat-area-context';

export const useLimitWaitingSelector: Selector<LimitWaitingSelector> = ({
  selector,
  equalityFn,
}) => {
  const { useWaitingStore } = useChatAreaStoreSet();

  return useWaitingStore(
    selector,
    equalityFn ?? ((prev, next) => isEqual(prev, next)),
  );
};
