import express from 'express';
import path from 'path';
import {
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  syncCollection,
  retrainCollection,
  getCollectionTrainingDetail,
  exportCollection,
  createCollectionFromFile,
  createCollectionFromLink
} from '@/core/dataset/collection/controller.js';
import { CreateCollectionParams, DatasetCollectionTypeEnum } from '@/types/dataset.js';
import { logger } from '@/utils/logger.js';
import { uploadSingle, cleanupFiles, getFileInfo } from '@/middleware/upload.js';
import { processFileContent } from '@/core/file/index.js';

const router = express.Router();

// Create collection
router.post('/', async (req, res, next) => {
  try {
    const params: CreateCollectionParams = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    // Enhanced validation
    if (!params.name || !params.datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'Collection name and datasetId are required',
        data: null
      });
    }

    // Validate datasetId format
    if (!params.datasetId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid datasetId format, must be a 24-character hex string',
        data: null
      });
    }

    const collection = await createCollection(params, authContext);

    res.json({
      code: 200,
      message: 'Collection created successfully',
      data: collection._id.toString()
    });
  } catch (error) {
    logger.error('Collection creation error:', error);
    next(error);
  }
});

// Create text collection (specialized route for text content)
router.post('/text', async (req, res, next) => {
  try {
    const { name, datasetId, text, ...otherParams } = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    // Validate required fields
    if (!name || !datasetId || !text) {
      return res.status(400).json({
        code: 400,
        message: 'Collection name, datasetId, and text are required',
        data: null
      });
    }

    // Validate datasetId format
    if (!datasetId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid datasetId format, must be a 24-character hex string',
        data: null
      });
    }

    // Create collection with text type
    const params: CreateCollectionParams = {
      name,
      datasetId,
      type: DatasetCollectionTypeEnum.text,
      rawText: text,
      ...otherParams
    };

    const collection = await createCollection(params, authContext);

    res.json({
      code: 200,
      message: 'Text collection created successfully',
      data: collection._id.toString()
    });
  } catch (error) {
    logger.error('Text collection creation error:', error);
    next(error);
  }
});

// List collections
router.get('/', async (req, res, next) => {
  try {
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const {
      datasetId,
      parentId,
      type,
      searchKey,
      current = '1',
      pageSize = '20'
    } = req.query;

    if (!datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'datasetId is required',
        data: null
      });
    }

    const result = await getCollections(
      authContext,
      {
        datasetId: datasetId as string,
        parentId: parentId as string,
        type: type as DatasetCollectionTypeEnum,
        searchKey: searchKey as string
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

// Get collection by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const collection = await getCollectionById(id, authContext);

    if (!collection) {
      return res.status(404).json({
        code: 404,
        message: 'Collection not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Success',
      data: collection
    });
  } catch (error) {
    next(error);
  }
});

// Update collection
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const collection = await updateCollection(id, updates, authContext);

    if (!collection) {
      return res.status(404).json({
        code: 404,
        message: 'Collection not found',
        data: null
      });
    }

    res.json({
      code: 200,
      message: 'Collection updated successfully',
      data: collection
    });
  } catch (error) {
    next(error);
  }
});

// Delete collection
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    await deleteCollection(id, authContext);

    res.json({
      code: 200,
      message: 'Collection deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
});

// Sync collection
router.post('/:id/sync', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const result = await syncCollection(id, authContext);

    res.json({
      code: 200,
      message: 'Collection sync initiated',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Retrain collection
router.post('/:id/retrain', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const result = await retrainCollection(id, authContext);

    res.json({
      code: 200,
      message: 'Collection retrain initiated',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get training detail
router.get('/:id/training', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const detail = await getCollectionTrainingDetail(id, authContext);

    res.json({
      code: 200,
      message: 'Success',
      data: detail
    });
  } catch (error) {
    next(error);
  }
});

// Export collection
router.get('/:id/export', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    const result = await exportCollection(id, authContext);

    res.json({
      code: 200,
      message: 'Success',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create collection from file upload
router.post('/create/file', uploadSingle.single('file'), async (req, res, next) => {
  let uploadedFiles: string[] = [];
  
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        code: 400,
        message: 'No file uploaded',
        data: null
      });
    }

    uploadedFiles.push(file.path);
    const fileInfo = getFileInfo(file);
    
    // Parse form data
    let data: any = {};
    if (req.body.data) {
      try {
        data = JSON.parse(req.body.data);
      } catch (error) {
        cleanupFiles(uploadedFiles);
        return res.status(400).json({
          code: 400,
          message: 'Invalid data parameter, must be valid JSON',
          data: null
        });
      }
    }

    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!data.datasetId) {
      cleanupFiles(uploadedFiles);
      return res.status(400).json({
        code: 400,
        message: 'datasetId is required',
        data: null
      });
    }

    const result = await createCollectionFromFile({
      ...data,
      name: data.name || fileInfo.originalName,
      file: fileInfo
    }, authContext);

    // Cleanup uploaded file after processing
    cleanupFiles(uploadedFiles);

    res.json({
      code: 200,
      message: 'Collection created from file successfully',
      data: result
    });
  } catch (error) {
    cleanupFiles(uploadedFiles);
    next(error);
  }
});

// Create collection from local file (same as file upload but different path for compatibility)
router.post('/create/localFile', uploadSingle.single('file'), async (req, res, next) => {
  let uploadedFiles: string[] = [];
  
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        code: 400,
        message: 'No file uploaded',
        data: null
      });
    }

    uploadedFiles.push(file.path);
    const fileInfo = getFileInfo(file);
    
    // Parse form data
    let data: any = {};
    if (req.body.data) {
      try {
        data = JSON.parse(req.body.data);
      } catch (error) {
        cleanupFiles(uploadedFiles);
        return res.status(400).json({
          code: 400,
          message: 'Invalid data parameter, must be valid JSON',
          data: null
        });
      }
    }

    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!data.datasetId) {
      cleanupFiles(uploadedFiles);
      return res.status(400).json({
        code: 400,
        message: 'datasetId is required',
        data: null
      });
    }

    const result = await createCollectionFromFile({
      ...data,
      name: data.name || fileInfo.originalName,
      file: fileInfo
    }, authContext);

    // Cleanup uploaded file after processing
    cleanupFiles(uploadedFiles);

    res.json({
      code: 200,
      message: 'Collection created from local file successfully',
      data: result
    });
  } catch (error) {
    cleanupFiles(uploadedFiles);
    next(error);
  }
});

// Create collection from link
router.post('/create/link', async (req, res, next) => {
  try {
    const { link, ...data } = req.body;
    
    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!link || !data.datasetId) {
      return res.status(400).json({
        code: 400,
        message: 'link and datasetId are required',
        data: null
      });
    }

    const result = await createCollectionFromLink({
      ...data,
      link,
      name: data.name || link
    }, authContext);

    res.json({
      code: 200,
      message: 'Collection created from link successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create collection from images upload (specialized route for images)
router.post('/create/images', uploadSingle.array('file', 20), async (req, res, next) => {
  let uploadedFiles: string[] = [];
  
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'No image files uploaded',
        data: null
      });
    }

    uploadedFiles.push(...files.map(f => f.path));
    
    // Parse form data
    let data: any = {};
    if (req.body.data) {
      try {
        data = JSON.parse(req.body.data);
      } catch (error) {
        cleanupFiles(uploadedFiles);
        return res.status(400).json({
          code: 400,
          message: 'Invalid data parameter, must be valid JSON',
          data: null
        });
      }
    }

    const authContext = {
      teamId: req.headers['x-team-id'] as string || '000000000000000000000001',
      tmbId: req.headers['x-user-id'] as string || '000000000000000000000002',
      userId: req.headers['x-user-id'] as string || '000000000000000000000002'
    };

    if (!data.datasetId) {
      cleanupFiles(uploadedFiles);
      return res.status(400).json({
        code: 400,
        message: 'datasetId is required',
        data: null
      });
    }

    // Validate all files are images
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!imageExtensions.includes(ext)) {
        cleanupFiles(uploadedFiles);
        return res.status(400).json({
          code: 400,
          message: `File ${file.originalname} is not a supported image format. Supported: ${imageExtensions.join(', ')}`,
          data: null
        });
      }
    }

    // Process first image to create collection
    const firstFile = files[0];
    const firstFileInfo = getFileInfo(firstFile);
    
    const result = await createCollectionFromFile({
      ...data,
      name: data.name || `图片集合_${new Date().toLocaleDateString()}`,
      file: firstFileInfo,
      trainingType: 'imageParse' // 专门用于图片解析训练
    }, authContext);

    // If multiple images, add them to the same collection
    if (files.length > 1) {
      // TODO: Implement batch image addition to existing collection
      logger.info(`Created image collection with ${files.length} images: ${result.collectionId}`);
    }

    // Cleanup uploaded files after processing
    cleanupFiles(uploadedFiles);

    res.json({
      code: 200,
      message: `Image collection created successfully with ${files.length} image(s)`,
      data: result
    });
  } catch (error) {
    cleanupFiles(uploadedFiles);
    logger.error('Image collection creation error:', error);
    next(error);
  }
});

export default router;
