/**
 * 文件处理相关类型定义
 * 复刻FastGPT-2的类型系统
 */

import { ParagraphChunkAIModeEnum } from '@/core/dataset/processing/paragraphProcessor.js';

export interface ImageType {
  uuid: string;
  base64: string;
  mime: string;
}

export interface FileProcessResult {
  rawText: string;
  formatText?: string;
  imageList?: ImageType[];
  chunks?: ChunkResult[]; // 添加分块结果
  metadata?: {
    format: string;
    totalChunks?: number;
    totalCharacters?: number;
    language?: string;
    pageCount?: number;
    sheetCount?: number;
    imageCount?: number;
    contentLength?: number;
    [key: string]: any;
  };
}

export interface FileProcessOptions {
  content?: string;
  filePath?: string;
  buffer?: Buffer;
  type: SupportedFileType;
  chunkSize?: number;
  chunkOverlap?: number;
  preserveStructure?: boolean;
  extractImages?: boolean;
  filename?: string;
  encoding?: string;
  vlmModel?: string;
  imagePrompt?: string;
  // 段落优化相关选项
  enableParagraphOptimization?: boolean;
  paragraphChunkAIMode?: ParagraphChunkAIModeEnum;
  agentModel?: string;
  language?: 'zh' | 'en' | 'auto';
}

export type SupportedFileType = 
  | 'txt' 
  | 'md' 
  | 'markdown'
  | 'html' 
  | 'pdf' 
  | 'docx' 
  | 'pptx' 
  | 'xlsx' 
  | 'csv' 
  | 'json'
  | 'text'
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp';

export interface ChunkResult {
  text: string;
  index: number;
  metadata?: Record<string, any>;
}

export interface SplitTextOptions {
  text: string;
  chunkSize: number;
  chunkOverlap: number;
  preserveStructure: boolean;
  language?: 'zh' | 'en' | 'mixed';
}

// 文件信息
export interface FileInfo {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  extension: string;
}

// 处理状态
export enum FileProcessStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 文件处理任务
export interface FileProcessTask {
  id: string;
  fileInfo: FileInfo;
  options: FileProcessOptions;
  status: FileProcessStatus;
  result?: FileProcessResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
