import mongoose from 'mongoose';
import { getMongoModel } from '@/config/database.js';
import { DatasetDataSchemaType, DatasetDataIndexTypeEnum } from '@/types/dataset.js';
import { DatasetCollectionName } from '../schema.js';
import { DatasetColCollectionName } from '../collection/schema.js';

export const DatasetDataCollectionName = 'dataset_datas';

const DatasetDataSchema = new mongoose.Schema({
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
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: DatasetColCollectionName,
    required: true
  },
  q: {
    type: String,
    required: true
  },
  a: {
    type: String
  },
  imageId: String,
  imageDescMap: Object,
  history: {
    type: [
      {
        q: String,
        a: String,
        updateTime: Date
      }
    ]
  },
  indexes: {
    type: [
      {
        // Abandon
        defaultIndex: {
          type: Boolean
        },
        type: {
          type: String,
          enum: Object.values(DatasetDataIndexTypeEnum),
          default: DatasetDataIndexTypeEnum.custom
        },
        dataId: {
          type: String,
          required: true
        },
        text: {
          type: String,
          required: true
        }
      }
    ],
    default: []
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },
  chunkIndex: {
    type: Number,
    default: 0
  },
  rebuilding: Boolean
});

// Create indexes
DatasetDataSchema.index({
  teamId: 1,
  datasetId: 1,
  collectionId: 1,
  chunkIndex: 1,
  updateTime: -1
});

// Text search index for full-text search
DatasetDataSchema.index({
  q: 'text',
  'indexes.text': 'text',
  a: 'text'
}, {
  name: 'text_search_index',
  weights: {
    q: 10,
    'indexes.text': 5,
    a: 1
  }
});

DatasetDataSchema.index({ teamId: 1, datasetId: 1, collectionId: 1, 'indexes.dataId': 1 });
DatasetDataSchema.index({ rebuilding: 1, teamId: 1, datasetId: 1 });
DatasetDataSchema.index({ updateTime: 1 });

export const MongoDatasetData = getMongoModel<DatasetDataSchemaType>(
  DatasetDataCollectionName,
  DatasetDataSchema
);
