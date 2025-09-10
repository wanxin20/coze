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

import { useRef } from 'react';

import { I18n } from '@coze-arch/i18n';
import { Modal } from '@coze-arch/coze-design';
import { useAlterOnLogout as useAlertOnLogoutImpl } from '@coze-foundation/account-adapter';

export const useAlertOnLogout = () => {
  const alertRef = useRef(false);

  const callback = () => {
    if (alertRef.current) {
      return;
    }
    alertRef.current = true;
    Modal.confirm({
      title: I18n.t('account_update_hint'),
      okText: I18n.t('api_analytics_refresh'),
      closeOnEsc: false,
      maskClosable: false,
      onOk: () => {
        window.location.reload();
      },
    });
  };
  useAlertOnLogoutImpl(callback);
};
