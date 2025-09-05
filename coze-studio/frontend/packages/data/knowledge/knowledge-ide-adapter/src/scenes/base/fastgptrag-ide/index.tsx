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

import React, { useState, useEffect } from 'react';
import { KnowledgeIDEBaseLayout } from '@coze-data/knowledge-ide-base/layout/base';
import { BaseKnowledgeIDENavBar } from '@coze-data/knowledge-ide-base/features/nav-bar/base';
import {
  KnowledgeIDERegistryContext,
  type KnowledgeIDERegistry,
} from '@coze-data/knowledge-ide-base/context/knowledge-ide-registry-context';
import { useKnowledgeParamsStore } from '@coze-data/knowledge-stores';
import { I18n } from '@coze-arch/i18n';
import { 
  Card, 
  Button, 
  Upload, 
  Input, 
  Table, 
  Tag, 
  Space, 
  Divider,
  Typography,
  Tabs,
  Form,
  Toast,
  Progress,
  Alert
} from '@coze-arch/coze-design';
import { FastGPTRAGApi, type FastGPTRAGCollection, type FastGPTRAGSearchResult } from '@coze-data/knowledge-api/fastgptrag-api';

import { type BaseKnowledgeIDEProps } from '../types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

export interface BaseKnowledgeFastGPTRAGIDEProps extends BaseKnowledgeIDEProps {
  // FastGPTRAG specific props
}

const registryContextValue: KnowledgeIDERegistry = {
  importKnowledgeMenuSourceFeatureRegistry: [],
};

export const BaseKnowledgeFastGPTRAGIDE = (props: BaseKnowledgeFastGPTRAGIDEProps) => {
  const { datasetID } = useKnowledgeParamsStore();
  const [collections, setCollections] = useState<FastGPTRAGCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('collections');
  const [searchResults, setSearchResults] = useState<FastGPTRAGSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<{
    status: 'idle' | 'training' | 'error';
    progress: number;
    message?: string;
  }>({ status: 'idle', progress: 0 });

  // 获取集合列表
  const fetchCollections = async () => {
    if (!datasetID) return;
    setLoading(true);
    try {
      const data = await FastGPTRAGApi.getCollectionList(datasetID);
      setCollections(data);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      Toast.error('获取数据集合失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取训练状态
  const fetchTrainingStatus = async () => {
    if (!datasetID) return;
    try {
      const status = await FastGPTRAGApi.getTrainingStatus(datasetID);
      setTrainingStatus(status);
    } catch (error) {
      console.error('Failed to fetch training status:', error);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchTrainingStatus();
  }, [datasetID]);

  // 定期轮询训练状态
  useEffect(() => {
    if (!datasetID) return;
    
    const interval = setInterval(() => {
      fetchTrainingStatus();
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(interval);
  }, [datasetID]);

  // 文件上传处理
  const handleFileUpload = async (file: File) => {
    if (!datasetID) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('type', 'file');
      
      await FastGPTRAGApi.uploadFile(datasetID, formData);
      Toast.success('文件上传成功');
      fetchCollections(); // 刷新列表
    } catch (error) {
      console.error('File upload failed:', error);
      Toast.error('文件上传失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索测试
  const handleSearch = async (searchText: string) => {
    if (!datasetID || !searchText.trim()) return;
    setSearchLoading(true);
    try {
      const response = await FastGPTRAGApi.searchTest({
        datasetId: datasetID,
        text: searchText.trim(),
        limit: 10,
        similarity: 0.6,
        searchMode: 'mixedRecall',
      });
      setSearchResults(response.list);
    } catch (error) {
      console.error('Search failed:', error);
      Toast.error('搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 删除集合
  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await FastGPTRAGApi.deleteCollection(collectionId);
      Toast.success('删除成功');
      fetchCollections(); // 刷新列表
    } catch (error) {
      console.error('Delete failed:', error);
      Toast.error('删除失败');
    }
  };

  const collectionsColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap = {
          text: { color: 'blue', text: '文本' },
          file: { color: 'green', text: '文件' },
          link: { color: 'orange', text: '链接' },
        };
        const config = typeMap[type as keyof typeof typeMap] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          active: { color: 'green', text: '活跃' },
          training: { color: 'orange', text: '训练中' },
          error: { color: 'red', text: '错误' },
        };
        const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: FastGPTRAGCollection) => (
        <Space>
          <Button 
            type="text" 
            size="small" 
            danger
            onClick={() => handleDeleteCollection(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const searchResultColumns = [
    {
      title: '内容',
      dataIndex: 'q',
      key: 'q',
      ellipsis: true,
    },
    {
      title: '相似度',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (score * 100).toFixed(2) + '%',
      width: 100,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
  ];

  return (
    <KnowledgeIDERegistryContext.Provider value={registryContextValue}>
      <KnowledgeIDEBaseLayout
        renderNavBar={({ statusInfo }) => (
          <BaseKnowledgeIDENavBar
            progressMap={statusInfo.progressMap}
            {...props.navBarProps}
          />
        )}
        renderContent={() => (
          <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
            <Title level={3}>FastGPT RAG 知识库</Title>
            <Text type="secondary">
              这是一个FastGPT RAG知识库，支持文件上传、数据管理和智能搜索功能。
            </Text>
            
            {/* 训练状态显示 */}
            {trainingStatus.status !== 'idle' && (
              <Alert
                message={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>
                        训练状态: {
                          trainingStatus.status === 'training' ? '训练中' :
                          trainingStatus.status === 'error' ? '训练失败' : '空闲'
                        }
                      </Text>
                    </div>
                    {trainingStatus.status === 'training' && (
                      <Progress 
                        percent={trainingStatus.progress} 
                        size="small"
                        status="active"
                      />
                    )}
                    {trainingStatus.message && (
                      <Text type="secondary">{trainingStatus.message}</Text>
                    )}
                  </Space>
                }
                type={
                  trainingStatus.status === 'training' ? 'info' :
                  trainingStatus.status === 'error' ? 'error' : 'success'
                }
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <Divider />
            
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="数据集合" key="collections">
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <Upload
                        accept=".pdf,.docx,.txt,.md,.csv,.json"
                        beforeUpload={(file) => {
                          handleFileUpload(file);
                          return false; // 阻止默认上传行为
                        }}
                        showUploadList={false}
                      >
                        <Button type="primary" loading={loading}>
                          上传文件
                        </Button>
                      </Upload>
                      <Text style={{ marginLeft: '8px' }} type="secondary">
                        支持 PDF、DOCX、TXT、MD、CSV、JSON 格式
                      </Text>
                    </div>
                    
                    <Table
                      columns={collectionsColumns}
                      dataSource={collections}
                      loading={loading}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                    />
                  </Space>
                </Card>
              </TabPane>
              
              <TabPane tab="搜索测试" key="search">
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Form
                      onFinish={(values) => handleSearch(values.searchText)}
                      layout="vertical"
                    >
                      <Form.Item
                        name="searchText"
                        label="搜索内容"
                        rules={[{ required: true, message: '请输入搜索内容' }]}
                      >
                        <TextArea
                          placeholder="输入要搜索的问题或关键词..."
                          rows={3}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={searchLoading}>
                          搜索
                        </Button>
                      </Form.Item>
                    </Form>
                    
                    {searchResults.length > 0 && (
                      <div>
                        <Title level={4}>搜索结果</Title>
                        <Table
                          columns={searchResultColumns}
                          dataSource={searchResults}
                          rowKey="id"
                          pagination={{ pageSize: 5 }}
                        />
                      </div>
                    )}
                  </Space>
                </Card>
              </TabPane>
            </Tabs>
          </div>
        )}
        {...props.layoutProps}
      />
    </KnowledgeIDERegistryContext.Provider>
  );
};
