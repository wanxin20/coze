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

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { useRequest } from 'ahooks';
import { useCreateKnowledgeModalV2 } from '@coze-data/knowledge-modal-adapter';
import {
  ActionKey,
  type ResourceInfo,
  ResType,
} from '@coze-arch/idl/plugin_develop';
import { DatasetStatus } from '@coze-arch/idl/knowledge';
import { I18n, type I18nKeysNoOptionsType } from '@coze-arch/i18n';
import { IconCozClock, IconCozKnowledge, IconCozDatabase } from '@coze-arch/coze-design/icons';
import { Menu, Switch, Tag, Toast, Table } from '@coze-arch/coze-design';
import { KnowledgeApi } from '@coze-arch/bot-api';
import { safeJSONParse } from '@coze-agent-ide/space-bot/util';

import { BaseLibraryItem } from '../../components/base-library-item';
import DocDefaultIcon from '../../assets/doc_default_icon.png';
import { 
  KnowledgeTypeSelectionModal, 
  KnowledgeBaseType 
} from '../../components/knowledge-type-selection-modal';
import { type UseEntityConfigHook } from './types';

const { TableAction } = Table;
/**
 * Knowledge base tags:
 * 0-text
 * 1-table
 * 2-image
 * 4-fastgpt_rag
 * */
const knowledgeSubTypeTextMap: Record<number, string> = {
  0: 'library_filter_tags_text',
  1: 'library_filter_tags_table',
  2: 'library_filter_tags_image',
  4: 'library_filter_tags_fastgpt_rag',
};

/**
 * Disable status tag:
 * 3-disabled
 * */
const knowledgeBizStatusTextMap: Record<number, I18nKeysNoOptionsType> = {
  3: 'library_filter_tags_disabled',
};

enum KnowledgeBizStatus {
  Disabled = 3,
}

const renderKnowledgeItem = (item: ResourceInfo) => {
  const knowledgeTag =
    item.res_sub_type !== undefined &&
    knowledgeSubTypeTextMap[item.res_sub_type];
  const knowledgeBizStatusTag =
    item.biz_res_status !== undefined &&
    knowledgeBizStatusTextMap[item.biz_res_status];
  
  return (
    <BaseLibraryItem
      resourceInfo={item}
      defaultIcon={DocDefaultIcon}
      tag={
        <>
          {safeJSONParse(item.biz_extend?.processing_file_id_list)?.length ? (
            <Tag
              data-testid="workspace.library.item.tag"
              color="brand"
              size="mini"
              className="flex-shrink-0 flex-grow-0"
              prefixIcon={<IconCozClock />}
            >
              {I18n.t('library_filter_tags_processing')}
            </Tag>
          ) : null}
          {knowledgeTag ? (
            <Tag
              data-testid="workspace.library.item.tag"
              color={item.res_sub_type === 4 ? "green" : "brand"}
              size="mini"
              className="flex-shrink-0 flex-grow-0"
              prefixIcon={item.res_sub_type === 4 ? <IconCozDatabase /> : undefined}
            >
              {I18n.t(knowledgeTag as any)}
            </Tag>
          ) : null}
          {knowledgeBizStatusTag ? (
            <Tag
              data-testid="workspace.library.item.tag"
              color="red"
              size="mini"
              className="flex-shrink-0 flex-grow-0"
            >
              {I18n.t(knowledgeBizStatusTag)}
            </Tag>
          ) : null}
        </>
      }
    />
  );
};

const getTypeFilters = () => ({
  label: (
    <span data-testid="space.library.filter.knowledge">
      {I18n.t('library_resource_type_knowledge')}
    </span>
  ),
  filterName: I18n.t('library_resource_type_knowledge'),
  value: ResType.Knowledge,
  children: [
    {
      label: (
        <span data-testid="space.library.filter.knowledge.all_types">
          {I18n.t('library_filter_tags_all_types')}
        </span>
      ),
      value: -1,
    },
    {
      label: (
        <span data-testid="space.library.filter.knowledge.text">
          {I18n.t('library_filter_tags_text')}
        </span>
      ),
      value: 0,
    },
    {
      label: (
        <span data-testid="space.library.filter.knowledge.table">
          {I18n.t('library_filter_tags_table')}
        </span>
      ),
      value: 1,
    },
    {
      label: (
        <span data-testid="space.library.filter.knowledge.image">
          {I18n.t('library_filter_tags_image')}
        </span>
      ),
      value: 2,
    },
    {
      label: (
        <span data-testid="space.library.filter.knowledge.fastgpt_rag">
          {I18n.t('library_filter_tags_fastgpt_rag' as any)}
        </span>
      ),
      value: 4,
    },
  ],
});

export const useKnowledgeConfig: UseEntityConfigHook = ({
  spaceId,
  reloadList,
  getCommonActions,
}) => {
  const navigate = useNavigate();
  const [typeSelectionVisible, setTypeSelectionVisible] = useState(false);
  const [selectedKnowledgeType, setSelectedKnowledgeType] = useState<KnowledgeBaseType>(KnowledgeBaseType.COZE_NATIVE);
  
  const {
    modal: createKnowledgeModal,
    open: openCreateKnowledgeModal,
    close: closeCreateKnowledgeModal,
  } = useCreateKnowledgeModalV2({
    knowledgeType: selectedKnowledgeType, // 传递知识库类型
    onFinish: (datasetID, unitType, shouldUpload) => {
      // 刷新资源库列表
      reloadList();
      closeCreateKnowledgeModal();
      
      // 如果需要上传文件，跳转到上传页面
      if (shouldUpload) {
        const uploadParams = new URLSearchParams({
          type: unitType,
          from: 'create'
        });
        if (selectedKnowledgeType === KnowledgeBaseType.FASTGPT_RAG) {
          uploadParams.set('knowledge_type', 'fastgpt_rag');
        }
        navigate(`/space/${spaceId}/knowledge/${datasetID}/upload?${uploadParams.toString()}`);
      } else {
        // 如果不需要上传，跳转到知识库详情页面
        const detailParams = new URLSearchParams({ from: 'library' });
        if (selectedKnowledgeType === KnowledgeBaseType.FASTGPT_RAG) {
          detailParams.set('knowledge_type', 'fastgpt_rag');
        }
        navigate(`/space/${spaceId}/knowledge/${datasetID}?${detailParams.toString()}`);
      }
    },
  });

  const handleKnowledgeTypeSelection = (type: KnowledgeBaseType) => {
    setTypeSelectionVisible(false);
    setSelectedKnowledgeType(type);
    
    // 无论选择哪种类型，都使用相同的创建模态窗口
    openCreateKnowledgeModal();
  };


  const handleOpenTypeSelection = () => {
   
    setTypeSelectionVisible(true);
  };

  const handleCloseTypeSelection = () => {
    setTypeSelectionVisible(false);
  };

  // delete
  const { run: delKnowledge } = useRequest(
    (datasetId: string) =>
      KnowledgeApi.DeleteDataset({
        dataset_id: datasetId,
      }),
    {
      manual: true,
      onSuccess: () => {
        reloadList();
        Toast.success(I18n.t('Delete_success'));
      },
    },
  );

  // turn on switch
  const { run: enableKnowledge, loading } = useRequest(
    (enableStatus: boolean, record: ResourceInfo) =>
      KnowledgeApi.UpdateDataset({
        dataset_id: record.res_id,
        name: record.name,
        description: record.desc,
        icon_uri: record.biz_extend?.icon_uri, // Get from business field
        status: enableStatus
          ? DatasetStatus.DatasetReady
          : DatasetStatus.DatasetForbid,
      }),
    {
      manual: true,
      debounceWait: 300,
      onSuccess: reloadList,
    },
  );

  return {
    modals: (
      <>
        {createKnowledgeModal}
        <KnowledgeTypeSelectionModal
          visible={typeSelectionVisible}
          onConfirm={handleKnowledgeTypeSelection}
          onCancel={handleCloseTypeSelection}
        />
      </>
    ),
    config: {
      typeFilter: getTypeFilters(),
      renderCreateMenu: () => (
        <Menu.Item
          data-testid="workspace.library.header.create.knowledge"
          icon={<IconCozKnowledge />}
          onClick={handleOpenTypeSelection}
        >
          {I18n.t('library_resource_type_knowledge')}
        </Menu.Item>
      ),
      target: [ResType.Knowledge],
      onItemClick: (item: ResourceInfo) => {
        // 检查是否为FastGPT RAG知识库 (res_sub_type = 4)
        const isFastGPTKnowledge = item.res_sub_type === 4;
        const queryParams = new URLSearchParams({ from: 'library' });
        
        if (isFastGPTKnowledge) {
          queryParams.set('knowledge_type', 'fastgpt_rag');
        }
        
        navigate(`/space/${spaceId}/knowledge/${item.res_id}?${queryParams.toString()}`);
      },
      renderItem: renderKnowledgeItem,
      renderActions: (item: ResourceInfo) => {
        const deleteDisabled = !item.actions?.find(
          action => action.key === ActionKey.Delete,
        )?.enable;
        // Knowledge Resource Enabled Status Whether the switch enabled is disabled (i.e. the disabled state of the switch label)
        const enableDisabled = !item.actions?.find(
          action => action.key === ActionKey.EnableSwitch,
        )?.enable;

        const deleteProps = {
          disabled: deleteDisabled,
          deleteDesc: I18n.t('library_delete_desc'),
          handler: () => {
            delKnowledge(item.res_id || '');
          },
        };

        const enableProps = {
          actionKey: 'enable',
          actionText: I18n.t('library_actions_enable'),
          disabled: enableDisabled || loading,
          extActionDom: (
            <Switch
              size="mini"
              disabled={enableDisabled}
              loading={loading}
              defaultChecked={Boolean(
                item.biz_res_status !== KnowledgeBizStatus.Disabled,
              )}
              onChange={v => {
                enableKnowledge(v, item);
              }}
            />
          ),
        };

        return (
          <TableAction
            deleteProps={deleteProps}
            actionList={[enableProps, ...(getCommonActions?.(item) ?? [])]}
          />
        );
      },
    },
  };
};
