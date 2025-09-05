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

import { type FC, useState } from 'react';

import { AddIcon } from '@/nodes-v2/components/add-icon';

import { SkillModal, type SkillModalProps } from './skill-modal';

export const AddSkill: FC<
  Omit<SkillModalProps, 'visible' | 'onCancel'> & {
    disabledTooltip?: string;
  }
> = props => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpenModal = e => {
    e.stopPropagation();
    setModalVisible(true);
  };
  const handleCloseModal = () => setModalVisible(false);

  return (
    <div
      onClick={e => {
        e.stopPropagation();
      }}
    >
      <AddIcon
        disabledTooltip={props.disabledTooltip}
        onClick={handleOpenModal}
      />

      <SkillModal
        visible={modalVisible}
        onCancel={handleCloseModal}
        {...props}
      />
    </div>
  );
};
