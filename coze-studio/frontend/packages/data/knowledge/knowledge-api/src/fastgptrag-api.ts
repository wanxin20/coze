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

import { request } from '@coze-arch/bot-api/request';

// FastGPTRAG API 接口定义
export interface FastGPTRAGDataset {
  id: string;
  name: string;
  intro?: string;
  type: 'dataset';
  vectorModel: string;
  agentModel?: string;
  status: 'active' | 'training' | 'error';
  createTime: string;
  updateTime: string;
}

export interface CreateFastGPTRAGDatasetRequest {
  name: string;
  intro?: string;
  type?: string;
  vectorModel?: string;
  agentModel?: string;
}

export interface CreateFastGPTRAGDatasetResponse {
  id: string;
  name: string;
  intro?: string;
}

export interface FastGPTRAGCollection {
  id: string;
  name: string;
  datasetId: string;
  type: 'text' | 'file' | 'link';
  status: 'active' | 'training' | 'error';
  createTime: string;
  fileCount?: number;
}

export interface CreateFastGPTRAGCollectionRequest {
  datasetId: string;
  name: string;
  type: 'text' | 'file' | 'link';
  rawText?: string;
  trainingType?: 'chunk' | 'qa';
  chunkSize?: number;
}

export interface FastGPTRAGSearchRequest {
  datasetId: string;
  text: string;
  limit?: number;
  similarity?: number;
  searchMode?: 'embedding' | 'fullText' | 'mixedRecall';
}

export interface FastGPTRAGSearchResult {
  id: string;
  q: string;
  a?: string;
  score: number;
  source?: string;
}

export interface FastGPTRAGSearchResponse {
  list: FastGPTRAGSearchResult[];
  total: number;
}

export class FastGPTRAGApi {
  private static baseURL = '/api/fastgptrag';

  // 创建数据集
  static async createDataset(
    params: CreateFastGPTRAGDatasetRequest,
  ): Promise<CreateFastGPTRAGDatasetResponse> {
    return request.post(`${this.baseURL}/dataset`, params);
  }

  // 获取数据集列表
  static async getDatasetList(spaceId: string): Promise<FastGPTRAGDataset[]> {
    return request.get(`${this.baseURL}/dataset`, {
      params: { spaceId },
    });
  }

  // 获取数据集详情
  static async getDataset(id: string): Promise<FastGPTRAGDataset> {
    return request.get(`${this.baseURL}/dataset/${id}`);
  }

  // 更新数据集
  static async updateDataset(
    id: string,
    params: Partial<CreateFastGPTRAGDatasetRequest>,
  ): Promise<void> {
    return request.put(`${this.baseURL}/dataset/${id}`, params);
  }

  // 删除数据集
  static async deleteDataset(id: string): Promise<void> {
    return request.delete(`${this.baseURL}/dataset/${id}`);
  }

  // 创建集合
  static async createCollection(
    params: CreateFastGPTRAGCollectionRequest,
  ): Promise<FastGPTRAGCollection> {
    return request.post(`${this.baseURL}/collection`, params);
  }

  // 获取集合列表
  static async getCollectionList(datasetId: string): Promise<FastGPTRAGCollection[]> {
    return request.get(`${this.baseURL}/collection`, {
      params: { datasetId },
    });
  }

  // 删除集合
  static async deleteCollection(id: string): Promise<void> {
    return request.delete(`${this.baseURL}/collection/${id}`);
  }

  // 文件上传创建集合
  static async uploadFile(
    datasetId: string,
    formData: FormData,
  ): Promise<FastGPTRAGCollection> {
    return request.post(`${this.baseURL}/collection/upload`, formData, {
      params: { datasetId },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // 搜索测试
  static async searchTest(
    params: FastGPTRAGSearchRequest,
  ): Promise<FastGPTRAGSearchResponse> {
    return request.post(`${this.baseURL}/search`, params);
  }

  // 获取训练状态
  static async getTrainingStatus(datasetId: string): Promise<{
    status: 'idle' | 'training' | 'error';
    progress: number;
    message?: string;
  }> {
    return request.get(`${this.baseURL}/dataset/${datasetId}/training-status`);
  }
}
