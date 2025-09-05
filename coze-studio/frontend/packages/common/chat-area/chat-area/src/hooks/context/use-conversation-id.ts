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

import { isValidContext } from '../../utils/is-valid-context';
import { useChatAreaStoreSet } from './use-chat-area-context';

export const useConversationId = () => {
  const chatAreaStoreSetContext = useChatAreaStoreSet();
  if (!isValidContext(chatAreaStoreSetContext)) {
    throw new Error('chatAreaStoreSetContext is not valid');
  }
  const { useGlobalInitStore } = chatAreaStoreSetContext;
  const conversationId = useGlobalInitStore(state => state.conversationId);

  return conversationId;
};
