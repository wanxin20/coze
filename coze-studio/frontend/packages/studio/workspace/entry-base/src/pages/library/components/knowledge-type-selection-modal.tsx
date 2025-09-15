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

import React, { useState } from 'react';

import { I18n } from '@coze-arch/i18n';
import { Modal, Radio, Typography } from '@coze-arch/coze-design';
import { IconCozKnowledge, IconCozDatabase } from '@coze-arch/coze-design/icons';

export enum KnowledgeBaseType {
  COZE_NATIVE = 'coze_native',
  FASTGPT_RAG = 'fastgpt_rag',
}

interface KnowledgeTypeSelectionModalProps {
  visible: boolean;
  onConfirm: (type: KnowledgeBaseType) => void;
  onCancel: () => void;
}

export const KnowledgeTypeSelectionModal: React.FC<KnowledgeTypeSelectionModalProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  const [selectedType, setSelectedType] = useState<KnowledgeBaseType>(KnowledgeBaseType.COZE_NATIVE);

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  const handleCancel = () => {
    setSelectedType(KnowledgeBaseType.COZE_NATIVE); // Reset to default
    onCancel();
  };

  return (
    <Modal
      title="选择知识库类型"
      width={480}
      visible={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="确定"
      cancelText="取消"
    >
      <div className="py-4">
        <Typography.Paragraph className="mb-4 text-gray-600">
          请选择要创建的知识库类型：
        </Typography.Paragraph>
        
        <Radio.Group 
          value={selectedType} 
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full"
        >
          <div className="w-full space-y-4">
            <div 
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => setSelectedType(KnowledgeBaseType.COZE_NATIVE)}
            >
              <Radio 
                value={KnowledgeBaseType.COZE_NATIVE}
                className="mb-2"
              >
                <div className="flex items-center">
                  <IconCozKnowledge className="mr-2 text-blue-600" />
                  <span className="font-medium">Coze 原生知识库</span>
                </div>
              </Radio>
              <Typography.Paragraph className="ml-6 text-sm text-gray-500 mb-0">
                使用 Coze 平台内置的知识库功能，集成文档解析、向量化和检索能力
              </Typography.Paragraph>
            </div>

            <div 
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => setSelectedType(KnowledgeBaseType.FASTGPT_RAG)}
            >
              <Radio 
                value={KnowledgeBaseType.FASTGPT_RAG}
                className="mb-2"
              >
                <div className="flex items-center">
                  <IconCozDatabase className="mr-2 text-green-600" />
                  <span className="font-medium">FastGPT RAG 知识库</span>
                </div>
              </Radio>
              <Typography.Paragraph className="ml-6 text-sm text-gray-500 mb-0">
                使用 FastGPT RAG 微服务提供的高级检索增强生成能力，支持更多自定义选项
              </Typography.Paragraph>
            </div>
          </div>
        </Radio.Group>
      </div>
    </Modal>
  );
};
