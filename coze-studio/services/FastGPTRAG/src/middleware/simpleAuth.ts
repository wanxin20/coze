import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger.js';

// 简化的认证上下文
export interface SimpleAuthContext {
  teamId: string;
  tmbId: string;
  userId: string;
}

// 简化的认证中间件 - 移除复杂的权限检查
export function simpleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // 从头部获取基本信息，如果没有则使用默认值
    const teamId = req.headers['x-team-id'] as string || '000000000000000000000001';
    const userId = req.headers['x-user-id'] as string || 'default-user';
    
    // 简化：所有用户都有相同的权限
    req.authContext = {
      teamId,
      tmbId: userId, // 简化：tmbId 就是 userId
      userId
    };

    logger.debug('Simple auth context set:', req.authContext);
    next();
  } catch (error) {
    logger.error('Simple auth failed:', error);
    res.status(401).json({
      code: 401,
      message: 'Authentication failed',
      data: null
    });
  }
}

// 验证数据集访问权限 - 简化版本
export async function validateDatasetAccess(
  datasetId: string,
  authContext: SimpleAuthContext
): Promise<boolean> {
  // 简化：暂时允许所有访问
  // 实际应用中可以根据需要添加更严格的权限检查
  return true;
}

// 验证集合访问权限 - 简化版本
export async function validateCollectionAccess(
  collectionId: string,
  authContext: SimpleAuthContext
): Promise<boolean> {
  // 简化：暂时允许所有访问
  return true;
}

// 获取用户的团队ID
export function getUserTeamId(authContext: SimpleAuthContext): string {
  return authContext.teamId;
}

// 检查是否为管理员 - 简化版本
export function isAdmin(authContext: SimpleAuthContext): boolean {
  // 简化：所有用户都是管理员
  return true;
}

// 扩展Express的Request类型
declare global {
  namespace Express {
    interface Request {
      authContext?: SimpleAuthContext;
    }
  }
}
