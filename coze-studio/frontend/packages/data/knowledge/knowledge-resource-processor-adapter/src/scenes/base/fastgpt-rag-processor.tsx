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

import React, { useState, useCallback, useRef } from 'react';
import { useKnowledgeParams } from '@coze-data/knowledge-stores';
import type { KnowledgeResourceProcessorLayoutProps } from '@coze-data/knowledge-resource-processor-base/layout/base';

interface FastGPTRAGUploadProcessorProps extends KnowledgeResourceProcessorLayoutProps {}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  message?: string;
  trainingJobId?: string;
}

export const FastGPTRAGUploadProcessor: React.FC<FastGPTRAGUploadProcessorProps> = (props) => {
  const { datasetID, spaceID } = useKnowledgeParams();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传到FastGPT RAG
  const handleFileUpload = useCallback(async (files: FileList) => {
    const newUploads: UploadProgress[] = Array.from(files).map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadProgress(prev => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadIndex = uploadProgress.length + i;

      try {
        // 创建FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // 构建FastGPT RAG上传请求数据
        const uploadData = {
          datasetId: datasetID,
          name: file.name.replace(/\.[^/.]+$/, ''), // 移除文件扩展名作为集合名称
          trainingType: 'auto',
          chunkSize: 1000,
          chunkOverlap: 200,
          preserveStructure: true,
          extractImages: false,
          tags: [],
          metadata: {
            uploadedBy: 'coze-studio',
            uploadTime: new Date().toISOString(),
          }
        };
        
        formData.append('data', JSON.stringify(uploadData));

        // 调用FastGPT RAG文件上传API
        const response = await fetch('/api/rag/core/dataset/collection/create/file', {
          method: 'POST',
          headers: {
            'x-team-id': '000000000000000000000001', // 默认团队ID
            'x-user-id': '000000000000000000000002', // 默认用户ID
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code !== 200) {
          throw new Error(result.message || 'Upload failed');
        }

        // 更新上传状态为处理中
        setUploadProgress(prev => prev.map((item, index) => 
          index === uploadIndex 
            ? { 
                ...item, 
                progress: 100, 
                status: 'processing',
                message: '文件上传成功，FastGPT RAG正在进行自动训练...',
                trainingJobId: result.data?.trainingJobId
              }
            : item
        ));

        // 如果有训练任务ID，开始轮询训练状态
        if (result.data?.trainingJobId) {
          pollTrainingStatus(result.data.trainingJobId, uploadIndex);
        } else {
          // 没有训练任务ID，直接标记为完成
          setTimeout(() => {
            setUploadProgress(prev => prev.map((item, index) => 
              index === uploadIndex 
                ? { ...item, status: 'completed', message: '文件处理完成' }
                : item
            ));
          }, 2000);
        }

      } catch (error) {
        console.error('FastGPT RAG upload error:', error);
        setUploadProgress(prev => prev.map((item, index) => 
          index === uploadIndex 
            ? { 
                ...item, 
                status: 'failed', 
                message: error instanceof Error ? error.message : '上传失败'
              }
            : item
        ));
      }
    }
  }, [datasetID, uploadProgress.length]);

  // 轮询训练状态
  const pollTrainingStatus = useCallback(async (trainingJobId: string, uploadIndex: number) => {
    const maxPollingTime = 300000; // 5分钟
    const pollingInterval = 3000; // 3秒
    const startTime = Date.now();

    const poll = async () => {
      try {
        const response = await fetch(`/api/rag/training/status/${trainingJobId}`, {
          headers: {
            'x-team-id': '000000000000000000000001',
            'x-user-id': '000000000000000000000002',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get training status');
        }

        const result = await response.json();
        
        if (result.code === 200) {
          const { status, progress, errorMessage } = result.data;
          
          setUploadProgress(prev => prev.map((item, index) => 
            index === uploadIndex 
              ? { 
                  ...item, 
                  progress: Math.min(progress || 0, 100),
                  message: status === 'completed' 
                    ? '训练完成，文件已成功添加到知识库'
                    : status === 'failed'
                    ? `训练失败: ${errorMessage || '未知错误'}`
                    : `训练中... ${progress || 0}%`
                }
              : item
          ));

          if (status === 'completed') {
            setUploadProgress(prev => prev.map((item, index) => 
              index === uploadIndex ? { ...item, status: 'completed' } : item
            ));
            return;
          } else if (status === 'failed') {
            setUploadProgress(prev => prev.map((item, index) => 
              index === uploadIndex ? { ...item, status: 'failed' } : item
            ));
            return;
          }
        }

        // 继续轮询
        if (Date.now() - startTime < maxPollingTime) {
          setTimeout(poll, pollingInterval);
        } else {
          // 超时
          setUploadProgress(prev => prev.map((item, index) => 
            index === uploadIndex 
              ? { ...item, status: 'completed', message: '训练可能仍在进行中，请稍后查看知识库内容' }
              : item
          ));
        }
      } catch (error) {
        console.error('Training status polling error:', error);
        setUploadProgress(prev => prev.map((item, index) => 
          index === uploadIndex 
            ? { ...item, status: 'completed', message: '无法获取训练状态，请稍后查看知识库内容' }
            : item
        ));
      }
    };

    setTimeout(poll, pollingInterval);
  }, []);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  // 点击上传
  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  }, [handleFileUpload]);

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* FastGPT RAG标识 */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f0f9ff',
        border: '1px solid #e0e7ff',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '6px 16px',
          backgroundColor: '#10b981',
          color: 'white',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          🚀 FastGPT RAG
        </div>
        <div style={{ color: '#64748b', fontSize: '14px' }}>
          文件将直接上传到FastGPT RAG服务进行自动训练和向量化处理
        </div>
      </div>

      {/* 上传区域 */}
      <div
        style={{
          border: `2px dashed ${isDragOver ? '#10b981' : '#d1d5db'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: isDragOver ? '#f0fdf4' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
        <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px', color: '#374151' }}>
          {isDragOver ? '释放文件开始上传' : '拖拽文件到此处或点击选择文件'}
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          支持 PDF, DOCX, TXT, MD, HTML, CSV, JSON 等格式
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
          文件将自动进行智能分块和向量化处理
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.html,.csv,.json"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 上传进度列表 */}
      {uploadProgress.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>
            上传进度
          </h3>
          {uploadProgress.map((item, index) => (
            <div key={index} style={{
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              marginBottom: '12px',
              backgroundColor: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 500, color: '#374151' }}>{item.fileName}</span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: 
                    item.status === 'completed' ? '#dcfce7' :
                    item.status === 'failed' ? '#fee2e2' :
                    item.status === 'processing' ? '#fef3c7' : '#dbeafe',
                  color:
                    item.status === 'completed' ? '#166534' :
                    item.status === 'failed' ? '#dc2626' :
                    item.status === 'processing' ? '#d97706' : '#2563eb'
                }}>
                  {item.status === 'uploading' && '上传中'}
                  {item.status === 'processing' && '训练中'}
                  {item.status === 'completed' && '完成'}
                  {item.status === 'failed' && '失败'}
                </span>
              </div>
              
              {/* 进度条 */}
              {item.status !== 'failed' && (
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: `${item.progress}%`,
                    height: '100%',
                    backgroundColor: item.status === 'completed' ? '#10b981' : '#3b82f6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              )}
              
              {/* 状态消息 */}
              {item.message && (
                <div style={{ 
                  fontSize: '13px', 
                  color: item.status === 'failed' ? '#dc2626' : '#6b7280',
                  marginTop: '4px'
                }}>
                  {item.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 使用说明 */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
          📋 使用说明
        </h4>
        <ul style={{ fontSize: '13px', color: '#6b7280', margin: 0, paddingLeft: '16px' }}>
          <li>文件上传后将自动发送到FastGPT RAG服务进行处理</li>
          <li>系统会自动进行文档解析、智能分块和向量化</li>
          <li>训练完成后，内容将自动添加到当前知识库中</li>
          <li>您可以在知识库页面查看处理后的文档片段</li>
        </ul>
      </div>
    </div>
  );
};
