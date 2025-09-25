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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BaseKnowledgeIDE, type BaseKnowledgeIDEProps } from '../base';
import { BaseKnowledgeTextIDE } from '../base/text-ide';
import { useKnowledgeParams } from '@coze-data/knowledge-stores';

// FastGPT RAG集合列表组件
const FastGPTRAGCollectionList = () => {
  const { datasetID, spaceID } = useKnowledgeParams();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取集合列表的函数
  const fetchCollections = useCallback(async () => {
    if (!datasetID) {
      console.warn('datasetID为空，无法获取集合列表');
      return [];
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('开始获取集合列表，datasetID:', datasetID);
      
      // 首先需要通过Coze知识库ID获取对应的RAG数据集ID
      // 由于我们传入的datasetID是Coze知识库ID，需要先转换为RAG数据集ID
      const knowledgeResponse = await fetch(`/api/knowledge/rag/core/dataset/item/${datasetID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!knowledgeResponse.ok) {
        throw new Error(`获取知识库信息失败: ${knowledgeResponse.statusText}`);
      }

      const knowledgeResult = await knowledgeResponse.json();
      console.log('知识库信息响应:', knowledgeResult);

      // 检查是否是FastGPT RAG类型的知识库
      if (knowledgeResult.code !== 200 || !knowledgeResult.data) {
        throw new Error('获取知识库信息失败或知识库不存在');
      }

      // 使用知识库响应中的_id作为RAG数据集ID来获取集合列表
      const ragDatasetId = knowledgeResult.data.ragDatasetId || knowledgeResult.data._id || datasetID;
      console.log('使用RAG数据集ID:', ragDatasetId);
      
      // 构建带查询参数的URL
      const url = new URL('/api/knowledge/rag/core/dataset/collection', window.location.origin);
      url.searchParams.set('datasetId', ragDatasetId);
      url.searchParams.set('current', '1');
      url.searchParams.set('pageSize', '50');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取集合列表失败: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('集合列表响应:', result);
      
      // 适配两种可能的API响应格式:
      // 格式1 (后端原始): { code: 200, message: "Success", data: { list: [...], total: 1 } }
      // 格式2 (前端转换后): { code: 0, msg: "success", list: [...], total: 1 }
      let collections = [];
      
      if (result.code === 200 && result.data && result.data.list && Array.isArray(result.data.list)) {
        // 格式1：嵌套data结构
        collections = result.data.list;
      } else if (result.code === 0 && result.list && Array.isArray(result.list)) {
        // 格式2：直接list结构
        collections = result.list;
      } else {
        console.warn('集合列表响应格式异常:', result);
        setCollections([]);
        return [];
      }
      
      console.log(`成功获取到 ${collections.length} 个集合`);
      console.log('集合数据详情:', collections);
      setCollections(collections);
      return collections;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取集合列表失败';
      console.error('获取集合列表错误:', error);
      setError(errorMessage);
      setCollections([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [datasetID]);

  // 组件挂载时获取集合列表
  useEffect(() => {
    if (datasetID) {
      fetchCollections();
    }
  }, [datasetID, fetchCollections]);

  // 格式化创建时间
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('zh-CN');
    } catch {
      return dateString;
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 修复文件名乱码问题
  const fixFileName = (fileName: string) => {
    if (!fileName) return '';
    
    // 检查是否包含乱码字符（Unicode转义序列）
    if (fileName.includes('\\u')) {
      try {
        // 尝试修复常见的中文乱码
        return fileName
          .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/[\u0080-\u00FF]/g, ''); // 移除无效字符
      } catch (error) {
        // 如果修复失败，返回清理后的文件名
        return fileName.replace(/[^\w\s.-]/g, '').substring(0, 50) + '...';
      }
    }
    
    // 如果文件名过长，截断处理
    if (fileName.length > 50) {
      return fileName.substring(0, 50) + '...';
    }
    
    return fileName;
  };

  // 获取集合类型显示文本
  const getCollectionTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      file: '📄 文件',
      text: '📝 文本',
      link: '🔗 链接',
      qa: '❓ 问答',
      folder: '📁 文件夹',
    };
    return typeMap[type] || type || '未知';
  };

  // 获取训练状态显示
  const getTrainingStatusText = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      waiting: { text: '等待中', color: '#faad14' },
      training: { text: '训练中', color: '#1890ff' },
      trained: { text: '已完成', color: '#52c41a' },
      ready: { text: '已完成', color: '#52c41a' }, // 映射FastGPT的ready状态到已完成
      error: { text: '失败', color: '#ff4d4f' },
    };
    return statusMap[status] || { text: status || '未知', color: '#666' };
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
      }}>
        <div style={{ marginBottom: '12px' }}>🔄 正在加载集合列表...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#ff4d4f',
        fontSize: '14px',
      }}>
        <div style={{ marginBottom: '12px', fontSize: '48px' }}>❌</div>
        <div style={{ marginBottom: '8px', fontWeight: 500 }}>获取集合列表失败</div>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
          {error}
        </div>
        <button
          onClick={() => fetchCollections()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#40a9ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1890ff';
          }}
        >
          🔄 重试
        </button>
      </div>
    );
  }

  if (!collections || collections.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#999',
        fontSize: '14px',
      }}>
        <div style={{ marginBottom: '12px', fontSize: '48px' }}>📂</div>
        <div style={{ marginBottom: '8px' }}>暂无数据集合</div>
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          请使用上方的"添加内容"按钮创建新的集合
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: '1px solid #f0f0f0',
        paddingBottom: '12px',
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '16px', 
          fontWeight: 600,
          color: '#333',
        }}>
          📚 数据集合列表 ({collections.length})
        </h3>
        <button
          onClick={() => fetchCollections()}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            color: '#666',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e6f7ff';
            e.currentTarget.style.borderColor = '#91d5ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            e.currentTarget.style.borderColor = '#d9d9d9';
          }}
        >
          🔄 刷新
        </button>
      </div>

      <div style={{
        display: 'grid',
        gap: '12px',
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        {collections.map((collection, index) => {
          const trainingStatus = getTrainingStatusText(collection.status);
          
          // 调试信息：打印每个集合的详细数据
          console.log(`集合 ${index}:`, collection);
          console.log(`集合metadata:`, collection.metadata);
          
          return (
            <div
              key={collection._id || index}
              style={{
                padding: '16px',
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
                e.currentTarget.style.borderColor = '#91d5ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.borderColor = '#f0f0f0';
              }}
            >
              {/* 集合标题和类型 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: '4px',
                    wordBreak: 'break-word',
                  }}>
                    {collection.name || '未命名集合'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span>{getCollectionTypeText(collection.type)}</span>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: trainingStatus.color,
                      color: 'white',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}>
                      {trainingStatus.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* 集合详细信息 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '8px',
                fontSize: '12px',
                color: '#666',
              }}>
                <div>
                  <span style={{ fontWeight: 500 }}>文档数:</span>
                  <span style={{ marginLeft: '4px' }}>
                    {collection.metadata?.imageCount ? collection.metadata.imageCount : 1}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 500 }}>向量数:</span>
                  <span style={{ marginLeft: '4px' }}>
                    {collection.metadata?.processedChunks || 0}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 500 }}>大小:</span>
                  <span style={{ marginLeft: '4px' }}>
                    {formatFileSize(collection.metadata?.fileSize || 0)}
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 500 }}>创建时间:</span>
                  <span style={{ marginLeft: '4px' }}>
                    {formatDate(collection.createTime)}
                  </span>
                </div>
              </div>

              {/* 集合描述 */}
              {(collection.intro || collection.metadata?.fileName) && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#666',
                  fontStyle: 'italic',
                }}>
                  {collection.intro || `文件: ${fixFileName(collection.metadata?.fileName || '未知文件')}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// FastGPT RAG搜索测试组件
const FastGPTRAGSearchTest = () => {
  const { datasetID, spaceID } = useKnowledgeParams();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasetId: datasetID, // 直接传递字符串，避免精度丢失
          text: searchQuery,
          limit: 10,
          similarity: 0.3, // 相似度阈值（降低以获得更多结果）
          searchMode: "embedding", // 搜索模式
          usingReRank: false,
          rerankModel: "",
          datasetSearchUsingExtensionQuery: false,
          datasetSearchExtensionModel: "",
          collectionIds: [], // 可选：指定集合ID
        }),
      });

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('搜索响应:', result); // 调试信息
      setSearchResults(result.searchResults || []);
    } catch (err) {
      console.error('搜索错误:', err);
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  if (!isSearchOpen) {
    return (
      <button
        style={{
          padding: '8px 16px',
          backgroundColor: '#52c41a',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 0 rgba(0,0,0,0.02)',
          transition: 'all 0.3s',
          outline: 'none',
          marginRight: '8px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#389e0d';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#52c41a';
        }}
        onClick={() => setIsSearchOpen(true)}
      >
        🔍 搜索测试
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90%',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}>
        {/* 头部 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '16px',
        }}>
          <h2 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: 600 }}>
            🚀 FastGPT RAG 搜索测试
          </h2>
          <button
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
              setSearchResults([]);
              setError(null);
            }}
          >
            ✕
          </button>
        </div>

        {/* 搜索输入框 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
              }}>
                搜索查询
              </label>
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入搜索内容，支持自然语言查询..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#40a9ff';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#d9d9d9';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: isSearching || !searchQuery.trim() ? '#f5f5f5' : '#1890ff',
                color: isSearching || !searchQuery.trim() ? '#999' : 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                minWidth: '80px',
                height: '44px',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                if (!isSearching && searchQuery.trim()) {
                  e.currentTarget.style.backgroundColor = '#40a9ff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSearching && searchQuery.trim()) {
                  e.currentTarget.style.backgroundColor = '#1890ff';
                }
              }}
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#ff4d4f',
            fontSize: '14px',
          }}>
            ❌ {error}
          </div>
        )}

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#333',
              marginBottom: '16px',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '8px',
            }}>
              搜索结果 ({searchResults.length})
            </h3>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {searchResults.map((result, index) => (
                <div key={index} style={{
                  padding: '16px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  backgroundColor: '#fafafa',
                }}>
                  <div style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#333',
                    marginBottom: '8px',
                  }}>
                    {result.content || '无内容'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    {result.score !== undefined && (
                      <span>相似度: {(result.score * 100).toFixed(1)}%</span>
                    )}
                    {result.sourceName && (
                      <span>来源: {result.sourceName}</span>
                    )}
                    {result.collectionName && (
                      <span>集合: {result.collectionName}</span>
                    )}
                    {result.chunkIndex !== undefined && (
                      <span>片段: #{result.chunkIndex}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 无结果提示 */}
        {!isSearching && searchResults.length === 0 && searchQuery && !error && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#999',
            fontSize: '14px',
          }}>
            🔍 未找到相关结果，请尝试其他关键词
          </div>
        )}
      </div>
    </div>
  );
};

// 创建FastGPT RAG专用的添加内容按钮组件
const FastGPTRAGAddContentButton = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAddDataset = (type: 'text' | 'image' | 'blank') => {
    console.log(`FastGPT RAG: Adding ${type} dataset`);
    
    // 实现跳转到上传页面的逻辑
    // 获取当前页面的参数
    const urlParams = new URLSearchParams(window.location.search);
    const spaceId = urlParams.get('space_id') || window.location.pathname.split('/')[2];
    const datasetId = urlParams.get('dataset_id') || window.location.pathname.split('/')[4];
    
    // 构建上传页面的URL参数，保留原始页面的重要参数
    const uploadParams = new URLSearchParams();
    
    // 保留原始详情页的参数，这样返回时能正确跳转
    if (urlParams.get('from')) {
      uploadParams.set('from', urlParams.get('from')!);
    }
    if (urlParams.get('knowledge_type')) {
      uploadParams.set('knowledge_type', urlParams.get('knowledge_type')!);
    }
    
    // 添加上传页面特有的参数
    uploadParams.set('fastgpt_rag', 'true'); // 标识这是FastGPT RAG操作
    
    switch (type) {
      case 'text':
        uploadParams.set('type', 'text_doc'); // 文本数据集使用text_doc类型 (对应UnitType.TEXT_DOC)
        break;
      case 'image':
        uploadParams.set('type', 'image_file'); // 图片数据集使用image_file类型 (对应UnitType.IMAGE_FILE)
        break;
      case 'blank':
        uploadParams.set('type', 'text_custom'); // 空白数据集使用text_custom类型 (对应UnitType.TEXT_CUSTOM)
        break;
    }
    
    // 跳转到上传页面
    const uploadUrl = `/space/${spaceId}/knowledge/${datasetId}/upload?${uploadParams.toString()}`;
    console.log('跳转到上传页面:', uploadUrl);
    
    // 关闭菜单
    setIsMenuOpen(false);
    
    // 延迟跳转，确保菜单关闭动画完成
    setTimeout(() => {
      window.location.href = uploadUrl;
    }, 100);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const menuItems = [
    { type: 'text' as const, label: '📝 添加文本数据集' },
    { type: 'image' as const, label: '🖼️ 添加图片数据集' },
    { type: 'blank' as const, label: '➕ 添加空白数据集' },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        style={{
          padding: '8px 16px',
          backgroundColor: '#fff',
          color: isMenuOpen ? '#40a9ff' : '#333',
          border: `1px solid ${isMenuOpen ? '#40a9ff' : '#d9d9d9'}`,
          borderRadius: '6px',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 0 rgba(0,0,0,0.02)',
          transition: 'all 0.3s',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isMenuOpen) {
            e.currentTarget.style.borderColor = '#40a9ff';
            e.currentTarget.style.color = '#40a9ff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMenuOpen) {
            e.currentTarget.style.borderColor = '#d9d9d9';
            e.currentTarget.style.color = '#333';
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsMenuOpen(!isMenuOpen);
          console.log('按钮被点击，菜单状态:', !isMenuOpen);
        }}
      >
        添加内容
        <span style={{ 
          fontSize: '12px',
          transform: isMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s'
        }}>
          ▼
        </span>
      </button>
      
      {isMenuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '200px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {menuItems.map((item, index) => (
            <div
              key={item.type}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: index < menuItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                transition: 'background-color 0.3s',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('菜单项被点击:', item.type);
                handleAddDataset(item.type);
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
      
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export type BizLibraryFastGPTRAGKnowledgeIDEProps = BaseKnowledgeIDEProps;

// 自定义FastGPT RAG知识库IDE组件
const FastGPTRAGKnowledgeIDEContent = () => {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#fff',
    }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fafafa',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          🗂️ FastGPT RAG 知识库
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FastGPTRAGSearchTest />
          <FastGPTRAGAddContentButton />
        </div>
      </div>

      {/* 主内容区域 - 集合列表 */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <FastGPTRAGCollectionList />
      </div>
    </div>
  );
};

export const BizLibraryFastGPTRAGKnowledgeIDE = (props: BizLibraryFastGPTRAGKnowledgeIDEProps) => {
  // 直接返回自定义的FastGPT RAG界面
  return <FastGPTRAGKnowledgeIDEContent />;
};
