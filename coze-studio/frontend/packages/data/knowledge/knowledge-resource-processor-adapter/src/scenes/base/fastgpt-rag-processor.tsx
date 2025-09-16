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
  const { datasetID, spaceID, type: unitType } = useKnowledgeParams();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 根据URL参数确定上传类型
  const uploadType: 'text' | 'image' = unitType === 'image_file' ? 'image' : 'text';

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
        
        // 检测文件类型，设置合适的训练类型
        const fileExtension = file.name.toLowerCase().split('.').pop() || '';
        const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExtension);
        
        // 构建FastGPT RAG上传请求数据
        const uploadData = {
          datasetId: datasetID,
          name: file.name.replace(/\.[^/.]+$/, ''), // 移除文件扩展名作为集合名称
          trainingType: isImageFile ? 'imageParse' : 'auto', // 图片使用imageParse模式
          chunkSize: 1000,
          chunkOverlap: 200,
          preserveStructure: true,
          extractImages: !isImageFile, // 图片文件本身不需要提取图片
          tags: [],
          metadata: {
            uploadedBy: 'coze-studio',
            uploadTime: new Date().toISOString(),
            fileType: isImageFile ? 'image' : 'document',
          }
        };
        
        formData.append('data', JSON.stringify(uploadData));

        // 调用FastGPT RAG文件上传API - 使用正确的端点
        const response = await fetch('/api/knowledge/rag/core/dataset/collection/create/file', {
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

  const textFormats = ['PDF', 'DOCX', 'TXT', 'MD', 'HTML', 'CSV', 'JSON'];
  const imageFormats = ['JPG', 'PNG', 'GIF', 'WEBP', 'BMP'];

  // 返回按钮逻辑
  const handleGoBack = useCallback(() => {
    const currentUrl = new URL(window.location.href);
    const pathParts = currentUrl.pathname.split('/');
    
    // 从 /space/{spaceId}/knowledge/{datasetId}/upload 返回到 /space/{spaceId}/knowledge/{datasetId}
    if (pathParts.length >= 5 && pathParts[pathParts.length - 1] === 'upload') {
      const backUrl = pathParts.slice(0, -1).join('/') + currentUrl.search;
      window.location.href = backUrl;
    } else {
      // fallback: 使用 history.back()
      window.history.back();
    }
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--coz-mg-card, #ffffff)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--coz-bd-dim, #e5e7eb)',
        backgroundColor: 'var(--coz-mg-card, #ffffff)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <button
          onClick={handleGoBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            border: '1px solid var(--coz-bd-dim, #d1d5db)',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'var(--coz-fg-default, #374151)',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--coz-mg-weak, #f3f4f6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ← 返回
        </button>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 500
          }}>
            🚀 FastGPT RAG
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--coz-fg-default, #1f2937)'
          }}>
            {uploadType === 'text' ? '📄 上传文本文档' : '🖼️ 上传图片文件'}
          </h1>
        </div>
      </div>

      {/* 主内容区域 */}
      <div style={{ 
        flex: 1,
        padding: '32px 24px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%'
      }}>

        {/* 上传区域 */}
        <div
          style={{
            border: `2px dashed ${isDragOver ? '#10b981' : 'var(--coz-bd-dim, #d1d5db)'}`,
            borderRadius: '8px',
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: isDragOver ? '#f0fdf4' : 'var(--coz-mg-card, #fafafa)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            minHeight: '240px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickUpload}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.8 }}>
            {uploadType === 'text' ? '📄' : '🖼️'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px', color: 'var(--coz-fg-default, #374151)' }}>
            {isDragOver ? '释放文件开始上传' : `拖拽${uploadType === 'text' ? '文档' : '图片'}到此处或点击选择文件`}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--coz-fg-dim, #6b7280)', marginBottom: '16px' }}>
            支持格式：{uploadType === 'text' ? textFormats.join(', ') : imageFormats.join(', ')}
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px', 
            justifyContent: 'center',
            marginTop: '8px'
          }}>
            {(uploadType === 'text' ? textFormats : imageFormats).map(format => (
              <span 
                key={format}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--coz-mg-weak, #e5e7eb)',
                  color: 'var(--coz-fg-dim, #6b7280)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                {format}
              </span>
            ))}
          </div>
        </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={uploadType === 'text' 
          ? '.pdf,.docx,.txt,.md,.html,.csv,.json'
          : '.jpg,.jpeg,.png,.gif,.webp,.bmp'
        }
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 上传进度列表 */}
      {uploadProgress.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: 600, 
            marginBottom: '16px', 
            color: 'var(--coz-fg-default, #374151)' 
          }}>
            上传进度
          </h3>
          {uploadProgress.map((item, index) => (
            <div key={index} style={{
              padding: '16px',
              border: '1px solid var(--coz-bd-dim, #e5e7eb)',
              borderRadius: '8px',
              marginBottom: '12px',
              backgroundColor: 'var(--coz-mg-card, white)',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '8px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>
                    {item.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? '🖼️' : '📄'}
                  </span>
                  <span style={{ 
                    fontWeight: 500, 
                    color: 'var(--coz-fg-default, #374151)',
                    fontSize: '14px'
                  }}>
                    {item.fileName}
                  </span>
                </div>
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
                  backgroundColor: 'var(--coz-mg-weak, #f3f4f6)',
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
                  color: item.status === 'failed' ? '#dc2626' : 'var(--coz-fg-dim, #6b7280)',
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
          padding: '20px',
          backgroundColor: 'var(--coz-mg-weak, #f8fafc)',
          borderRadius: '8px',
          border: '1px solid var(--coz-bd-dim, #e2e8f0)'
        }}>
          <h4 style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            marginBottom: '12px', 
            color: 'var(--coz-fg-default, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💡 智能处理说明
          </h4>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--coz-fg-dim, #64748b)', 
            lineHeight: '22px'
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              文件上传后将自动发送到 <strong>FastGPT RAG</strong> 服务进行智能处理：
            </p>
            <div style={{ paddingLeft: '16px' }}>
              <div style={{ marginBottom: '4px' }}>• 自动文档解析和内容提取</div>
              <div style={{ marginBottom: '4px' }}>• 智能分块和向量化处理</div>
              <div style={{ marginBottom: '4px' }}>• 训练完成后自动添加到知识库</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
