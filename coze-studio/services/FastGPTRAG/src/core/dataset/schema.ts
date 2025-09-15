import mongoose from 'mongoose';
import { getMongoModel } from '@/config/database.js';
import {
  DatasetTypeEnum,
  DatasetCollectionDataProcessModeEnum,
  ChunkTriggerConfigTypeEnum,
  ChunkSettingModeEnum,
  DataChunkSplitModeEnum,
  ParagraphChunkAIModeEnum,
  DatasetSchemaType
} from '@/types/dataset.js';

export const DatasetCollectionName = 'datasets';

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

const DatasetSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DatasetCollectionName,
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
  type: {
    type: String,
    enum: Object.values(DatasetTypeEnum),
    required: true,
    default: DatasetTypeEnum.dataset
  },
  avatar: {
    type: String,
    default: '/icon/logo.svg'
  },
  name: {
    type: String,
    required: true
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },
  vectorModel: {
    type: String,
    required: true,
    default: 'text-embedding-3-small'
  },
  agentModel: {
    type: String,
    required: true,
    default: 'gpt-4o-mini'
  },
  vlmModel: String,
  intro: {
    type: String,
    default: ''
  },
  websiteConfig: {
    type: {
      url: {
        type: String,
        required: true
      },
      selector: {
        type: String,
        default: 'body'
      }
    }
  },
  chunkSettings: {
    type: ChunkSettings
  },
  inheritPermission: {
    type: Boolean,
    default: true
  },
  apiDatasetServer: Object
});

// Create indexes
DatasetSchema.index({ teamId: 1 });
DatasetSchema.index({ type: 1 });
DatasetSchema.index({ teamId: 1, parentId: 1, updateTime: -1 });

export const MongoDataset = getMongoModel<DatasetSchemaType>(DatasetCollectionName, DatasetSchema);
