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

import { I18n } from '@coze-arch/i18n';
import { Button } from '@coze-arch/coze-design';

import { useOpenDatabaseDetail } from '@/components/database-detail-modal';

export function ViewDataButton() {
  const { openDatabaseDetail } = useOpenDatabaseDetail();

  return (
    <Button
      onClick={e => {
        e.stopPropagation();
        openDatabaseDetail();
      }}
      size="small"
      color="secondary"
      className="!coz-fg-hglt"
    >
      {I18n.t('workflow_view_data', {}, '查看数据')}
    </Button>
  );
}
