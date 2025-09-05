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

import { useEffect } from 'react';

import { merge } from 'lodash-es';

import { type UserSenderInfo } from '../../store/types';
import { type StoreSet } from '../../context/chat-area-context/type';

export const useAutoUpdateUserInfo = ({
  userInfo,
  storeSet,
}: {
  userInfo: UserSenderInfo | null;
  storeSet: Pick<StoreSet, 'useSenderInfoStore'>;
}) => {
  useEffect(() => {
    if (!userInfo) {
      return;
    }

    const { useSenderInfoStore } = storeSet;
    const { updateUserInfo, setUserInfoMap, userInfoMap } =
      useSenderInfoStore.getState();
    updateUserInfo(userInfo);
    setUserInfoMap(
      merge([], userInfoMap, {
        [userInfo.id]: userInfo,
      }),
    );
  }, [userInfo, storeSet]);
};
