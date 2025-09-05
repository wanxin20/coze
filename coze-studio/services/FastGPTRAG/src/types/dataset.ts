import { Types } from 'mongoose';

// Dataset Types
export enum DatasetTypeEnum {
  dataset = 'dataset',
  folder = 'folder',
  apiDataset = 'apiDataset',
  feishu = 'feishu',
  yuque = 'yuque'
}

export enum DatasetCollectionTypeEnum {
  folder = 'folder',
  file = 'file',
  link = 'link',
  text = 'text',
  images = 'images',
  apiFile = 'apiFile'
}

export enum DatasetCollectionDataProcessModeEnum {
  chunk = 'chunk',
  qa = 'qa',
  auto = 'auto',
  parse = 'parse',
  image = 'image',
  imageParse = 'imageParse',
  template = 'template'
}

export enum ChunkSettingModeEnum {
  custom = 'custom',
  auto = 'auto'
}

export enum DataChunkSplitModeEnum {
  mark = 'mark',
  custom = 'custom'
}

export enum ChunkTriggerConfigTypeEnum {
  minSize = 'minSize',
  maxSize = 'maxSize',
  forceChunk = 'forceChunk'
}

export enum ParagraphChunkAIModeEnum {
  enable = 'enable',
  disable = 'disable'
}

export enum TrainingModeEnum {
  chunk = 'chunk',
  qa = 'qa',
  auto = 'auto',
  image = 'image',
  imageParse = 'imageParse'
}

export enum DatasetDataIndexTypeEnum {
  summary = 'summary',
  custom = 'custom'
}

// Dataset Schema Types
export interface DatasetSchemaType {
  _id: Types.ObjectId;
  parentId?: Types.ObjectId;
  teamId: Types.ObjectId;
  tmbId: Types.ObjectId;
  type: DatasetTypeEnum;
  avatar: string;
  name: string;
  updateTime: Date;
  vectorModel: string;
  agentModel: string;
  vlmModel?: string;
  intro: string;
  websiteConfig?: {
    url: string;
    selector: string;
  };
  chunkSettings?: ChunkSettings;
  inheritPermission: boolean;
  apiDatasetServer?: any;
}

export interface DatasetCollectionSchemaType {
  _id: Types.ObjectId;
  parentId?: Types.ObjectId;
  teamId: Types.ObjectId;
  tmbId: Types.ObjectId;
  datasetId: Types.ObjectId;
  type: DatasetCollectionTypeEnum;
  name: string;
  tags: string[];
  createTime: Date;
  updateTime: Date;
  fileId?: Types.ObjectId;
  rawLink?: string;
  apiFileId?: string;
  externalFileId?: string;
  externalFileUrl?: string;
  rawTextLength?: number;
  hashRawText?: string;
  metadata?: Record<string, any>;
  status?: 'pending' | 'processing' | 'training' | 'ready' | 'failed';
  forbid?: boolean;
  customPdfParse?: boolean;
  apiFileParentId?: string;
  // Chunk settings
  trainingType?: DatasetCollectionDataProcessModeEnum;
  chunkTriggerType?: ChunkTriggerConfigTypeEnum;
  chunkTriggerMinSize?: number;
  dataEnhanceCollectionName?: boolean;
  imageIndex?: boolean;
  autoIndexes?: boolean;
  indexPrefixTitle?: boolean;
  chunkSettingMode?: ChunkSettingModeEnum;
  chunkSplitMode?: DataChunkSplitModeEnum;
  paragraphChunkAIMode?: ParagraphChunkAIModeEnum;
  paragraphChunkDeep?: number;
  paragraphChunkMinSize?: number;
  chunkSize?: number;
  chunkSplitter?: string;
  indexSize?: number;
  qaPrompt?: string;
}

export interface DatasetDataSchemaType {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  tmbId: Types.ObjectId;
  datasetId: Types.ObjectId;
  collectionId: Types.ObjectId;
  q: string;
  a?: string;
  imageId?: string;
  imageDescMap?: Record<string, string>;
  history?: Array<{
    q: string;
    a: string;
    updateTime: Date;
  }>;
  indexes: Array<{
    type: DatasetDataIndexTypeEnum;
    dataId: string;
    text: string;
  }>;
  updateTime: Date;
  chunkIndex: number;
  rebuilding?: boolean;
}

export interface ChunkSettings {
  trainingType?: DatasetCollectionDataProcessModeEnum;
  chunkTriggerType?: ChunkTriggerConfigTypeEnum;
  chunkTriggerMinSize?: number;
  dataEnhanceCollectionName?: boolean;
  imageIndex?: boolean;
  autoIndexes?: boolean;
  indexPrefixTitle?: boolean;
  chunkSettingMode?: ChunkSettingModeEnum;
  chunkSplitMode?: DataChunkSplitModeEnum;
  paragraphChunkAIMode?: ParagraphChunkAIModeEnum;
  paragraphChunkDeep?: number;
  paragraphChunkMinSize?: number;
  chunkSize?: number;
  chunkSplitter?: string;
  indexSize?: number;
  qaPrompt?: string;
}

// API Types
export interface CreateDatasetParams {
  parentId?: string;
  type: DatasetTypeEnum;
  name: string;
  intro?: string;
  avatar?: string;
  vectorModel?: string;
  agentModel?: string;
  vlmModel?: string;
}

export interface CreateCollectionParams {
  datasetId: string;
  parentId?: string;
  name: string;
  type: DatasetCollectionTypeEnum;
  fileId?: string;
  rawText?: string;
  link?: string;
  trainingType?: DatasetCollectionDataProcessModeEnum;
  chunkSize?: number;
  chunkSplitter?: string;
  qaPrompt?: string;
  metadata?: Record<string, any>;
}

export interface PushDatasetDataParams {
  collectionId: string;
  data: Array<{
    q: string;
    a?: string;
    indexes?: Array<{
      type: DatasetDataIndexTypeEnum;
      text: string;
    }>;
  }>;
  mode?: TrainingModeEnum;
  prompt?: string;
  billId?: string;
}

export interface SearchDatasetParams {
  datasetId: string;
  text: string;
  limit?: number;
  similarity?: number;
  searchMode?: 'embedding' | 'fullTextRecall' | 'mixedRecall';
  usingReRank?: boolean;
  datasetSearchUsingExtensionQuery?: boolean;
  datasetSearchExtensionModel?: string;
  datasetSearchExtensionBg?: string;
}

// Search Mode Enum
export enum DatasetSearchModeEnum {
  embedding = 'embedding',
  fullTextRecall = 'fullTextRecall', 
  mixedRecall = 'mixedRecall'
}

export interface DatasetSearchResult {
  id: string;
  q: string;
  a: string;
  score: number;
  indexes: Array<{
    type: DatasetDataIndexTypeEnum;
    text: string;
  }>;
}
