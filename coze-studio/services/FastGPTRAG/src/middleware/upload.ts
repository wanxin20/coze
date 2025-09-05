import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

// Ensure upload directory exists
const ensureUploadDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.uploadPath;
    ensureUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/html',
    'application/xml',
    'text/xml'
  ];

  const allowedExtensions = [
    '.txt', '.md', '.csv', '.json', '.pdf', '.docx', '.doc', '.html', '.xml',
    '.xlsx', '.xls', '.pptx', '.ppt', '.htm', '.markdown'
  ];

  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    logger.warn(`File type not allowed: ${file.mimetype}, extension: ${fileExtension}`);
    cb(new Error(`File type not allowed. Supported types: ${allowedExtensions.join(', ')}`));
  }
};

// Create multer upload middleware
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize * 1024 * 1024, // Convert MB to bytes
    files: 1
  }
});

// Upload middleware for multiple files
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize * 1024 * 1024,
    files: 10
  }
});

// Helper function to clean up uploaded files
export const cleanupFiles = (filePaths: string[]) => {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to cleanup file ${filePath}:`, error);
    }
  });
};

// Helper function to get file info
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    extension: path.extname(file.originalname).toLowerCase()
  };
};
