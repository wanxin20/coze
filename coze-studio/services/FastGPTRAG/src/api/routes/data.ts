import express from 'express';
import {
  insertData,
  pushDatasetData,
  getDataList,
  getDataById,
  updateData,
  deleteData,
  getDataPermission
} from '@/core/dataset/data/controller.js';
import { PushDatasetDataParams, TrainingModeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';

const router = express.Router();

// Insert single data item
router.post('/', async (req, res, next) => {
  try {
    const {
      collectionId,
      q,
      a,
      indexes,
      chunkIndex
    } = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    // Enhanced validation
    if (!collectionId || !q) {
      return res.status(400).json({
        code: 400,
        message: 'collectionId and q are required',
        data: null
      });
    }

    // Validate collectionId format
    if (!collectionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid collectionId format, must be a 24-character hex string',
        data: null
      });
    }

    // Validate q field
    if (typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'Field q must be a non-empty string',
        data: null
      });
    }

    const dataItem = await insertData({
      collectionId,
      q,
      a: a || '',
      indexes: indexes || [],
      chunkIndex: chunkIndex || 0
    }, authContext);

    res.json({
      code: 200,
      message: 'Data inserted successfully',
      data: dataItem._id.toString()
    });
  } catch (error) {
    logger.error('Insert data error:', error);
    next(error);
  }
});

// Push batch data
router.post('/push', async (req, res, next) => {
  try {
    const params: PushDatasetDataParams = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    // Enhanced validation
    if (!params.collectionId || !params.data || !Array.isArray(params.data) || params.data.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'collectionId and data array are required',
        data: null
      });
    }

    // Validate collectionId format
    if (!params.collectionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid collectionId format, must be a 24-character hex string',
        data: null
      });
    }

    // Validate data items
    for (let i = 0; i < params.data.length; i++) {
      const item = params.data[i];
      if (!item.q || typeof item.q !== 'string') {
        return res.status(400).json({
          code: 400,
          message: `Data item ${i} is missing required field 'q' (question/text)`,
          data: null
        });
      }
    }

    const result = await pushDatasetData(params, authContext);

    res.json({
      code: 200,
      message: 'Data pushed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Push data error:', error);
    next(error);
  }
});

// List data items - explicit route for /list
router.get('/list', async (req, res, next) => {
  try {
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const {
      collectionId,
      datasetId,
      searchText,
      current = '1',
      pageSize = '20'
    } = req.query;

    if (!collectionId && !datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'collectionId or datasetId is required',
        data: null
      });
    }

    const result = await getDataList(
      authContext,
      {
        collectionId: collectionId as string,
        datasetId: datasetId as string,
        searchText: searchText as string
      },
      {
        current: parseInt(current as string),
        pageSize: parseInt(pageSize as string)
      }
    );

    res.json({
      code: 200,
      message: 'Success',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// List data items - root route for backward compatibility
router.get('/', async (req, res, next) => {
  try {
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const {
      collectionId,
      datasetId,
      searchText,
      current = '1',
      pageSize = '20'
    } = req.query;

    if (!collectionId && !datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'collectionId or datasetId is required',
        data: null
      });
    }

    const result = await getDataList(
      authContext,
      {
        collectionId: collectionId as string,
        datasetId: datasetId as string,
        searchText: searchText as string
      },
      {
        current: parseInt(current as string),
        pageSize: parseInt(pageSize as string)
      }
    );

    res.json({
      code: 200,
      message: 'Success',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get data by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const dataItem = await getDataById(id, authContext);

    if (!dataItem) {
      return res.status(404).json({
        code: 404,
        message: 'Data not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Success',
      data: dataItem
    });
  } catch (error) {
    next(error);
  }
});

// Update data
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const dataItem = await updateData(id, updates, authContext);

    if (!dataItem) {
      return res.status(404).json({
        code: 404,
        message: 'Data not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Data updated successfully',
      data: dataItem
    });
  } catch (error) {
    next(error);
  }
});

// Delete data
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    await deleteData(id, authContext);

    res.json({
      code: 200,
      message: 'Data deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
});

// Get data permission
router.get('/:id/permission', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const permission = await getDataPermission(id, authContext);

    res.json({
      code: 200,
      message: 'Success',
      data: permission
    });
  } catch (error) {
    next(error);
  }
});

export default router;
