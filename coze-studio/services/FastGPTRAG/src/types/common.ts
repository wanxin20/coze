import { Types } from 'mongoose';

// Common response types
export interface ApiResponse<T = any> {
  code: number;
  statusText?: string;
  message?: string;
  data: T;
}

// Auth types
export interface UserInfo {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  tmbId: Types.ObjectId;
  email: string;
  role: string;
}

export interface AuthContext {
  teamId: string;
  tmbId: string;
  userId: string;
}

// File types
export interface FileInfo {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  uid: string;
  filename: string;
  contentType: string;
  length: number;
  uploadDate: Date;
  metadata: Record<string, any>;
}

// Model configuration types
export interface EmbeddingModel {
  model: string;
  name: string;
  provider: string;
  maxToken: number;
  defaultToken: number;
  weight: number;
  requestUrl?: string;
  requestAuth?: string;
  defaultConfig?: Record<string, any>;
  dbConfig?: Record<string, any>;
  queryConfig?: Record<string, any>;
}

export interface LLMModel {
  model: string;
  name: string;
  provider: string;
  maxContext: number;
  maxResponse: number;
  quoteMaxToken: number;
  maxTemperature: number;
  charsPointsPrice: number;
  censor: boolean;
  vision: boolean;
  datasetProcess: boolean;
  usedInClassify: boolean;
  usedInExtractFields: boolean;
  usedInToolCall: boolean;
  toolChoice: boolean;
  functionCall: boolean;
  requestUrl?: string;
  requestAuth?: string;
  defaultConfig?: Record<string, any>;
}

export interface VLMModel extends LLMModel {
  vision: true;
}

// Pagination types
export interface PaginationParams {
  current?: number;
  pageSize?: number;
}

export interface PaginationResponse<T> {
  list: T[];
  total: number;
  current: number;
  pageSize: number;
}

// Search types
export interface SearchParams {
  searchText?: string;
  tags?: string[];
  parentId?: string;
}

// Vector types
export interface VectorData {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchResult extends VectorData {
  score: number;
}
