import mongoose from 'mongoose';
import { getMongoModel } from '@/config/database.js';
import {
  DatasetCollectionTypeEnum,
  DatasetCollectionSchemaType,
  DatasetCollectionDataProcessModeEnum,
  ChunkTriggerConfigTypeEnum,
  ChunkSettingModeEnum,
  DataChunkSplitModeEnum,
  ParagraphChunkAIModeEnum
} from '@/types/dataset.js';
import { DatasetCollectionName } from '../schema.js';

export const DatasetColCollectionName = 'dataset_collections';

const ChunkSettings = {
  trainingType: {
    type: String,
    enum: Object.values(DatasetCollectionDataProcessModeEnum)
  },
  chunkTriggerType: {
    type: String,
    enum: Object.values(ChunkTriggerConfigTypeEnum)
  },
  chunkTriggerMinSize: Number,
  dataEnhanceCollectionName: Boolean,
  imageIndex: Boolean,
  autoIndexes: Boolean,
  indexPrefixTitle: Boolean,
  chunkSettingMode: {
    type: String,
    enum: Object.values(ChunkSettingModeEnum)
  },
  chunkSplitMode: {
    type: String,
    enum: Object.values(DataChunkSplitModeEnum)
  },
  paragraphChunkAIMode: {
    type: String,
    enum: Object.values(ParagraphChunkAIModeEnum)
  },
  paragraphChunkDeep: Number,
  paragraphChunkMinSize: Number,
  chunkSize: Number,
  chunkSplitter: String,
  indexSize: Number,
  qaPrompt: String
};

const DatasetCollectionSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DatasetColCollectionName,
    default: null
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  tmbId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DatasetCollectionName,
    required: true
  },
  // Basic info
  type: {
    type: String,
    enum: Object.values(DatasetCollectionTypeEnum),
    required: true
  },
  name: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  createTime: {
    type: Date,
    default: () => new Date()
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },
  // Metadata
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'dataset.files'
  },
  rawLink: String,
  apiFileId: String,
  externalFileId: String,
  externalFileUrl: String,
  rawTextLength: Number,
  hashRawText: String,
  metadata: {
    type: Object,
    default: {}
  },
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'training', 'ready', 'failed'],
    default: 'pending'
  },
  forbid: Boolean,
  customPdfParse: Boolean,
  apiFileParentId: String,
  // Chunk settings
  ...ChunkSettings
});

// Virtual populate
DatasetCollectionSchema.virtual('dataset', {
  ref: DatasetCollectionName,
  localField: 'datasetId',
  foreignField: '_id',
  justOne: true
});

// Create indexes
DatasetCollectionSchema.index({ teamId: 1, fileId: 1 });
DatasetCollectionSchema.index({
  teamId: 1,
  datasetId: 1,
  parentId: 1,
  updateTime: -1
});
DatasetCollectionSchema.index({ teamId: 1, datasetId: 1, tags: 1 });
DatasetCollectionSchema.index({ teamId: 1, datasetId: 1, createTime: 1 });
DatasetCollectionSchema.index(
  { datasetId: 1, externalFileId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalFileId: { $exists: true }
    }
  }
);
DatasetCollectionSchema.index({
  teamId: 1,
  'metadata.relatedImgId': 1
});

export const MongoDatasetCollection = getMongoModel<DatasetCollectionSchemaType>(
  DatasetColCollectionName,
  DatasetCollectionSchema
);
