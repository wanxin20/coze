/**
 * Quick fix script for ObjectId validation issues
 * Run: node fix-objectid.js
 */

import fs from 'fs';
import path from 'path';

const files = [
  'src/core/dataset/data/controller.ts',
  'src/core/dataset/collection/controller.ts',
  'src/core/dataset/search/controller.ts'
];

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add imports at the top if not present
    if (!content.includes('import { safeObjectId, isValidObjectId }')) {
      content = content.replace(
        "import { Types } from 'mongoose';",
        "import { Types } from 'mongoose';\nimport { safeObjectId, isValidObjectId } from '@/utils/objectId.js';"
      );
    }
    
    // Replace all remaining unsafe ObjectId conversions
    content = content.replace(
      /new Types\.ObjectId\(authContext\.teamId\)/g,
      'safeObjectId(authContext.teamId)'
    );
    
    content = content.replace(
      /new Types\.ObjectId\(authContext\.tmbId\)/g,
      'safeObjectId(authContext.tmbId)'
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to fix ${filePath}:`, error.message);
  }
});

console.log('🎉 ObjectId fixes completed!');
