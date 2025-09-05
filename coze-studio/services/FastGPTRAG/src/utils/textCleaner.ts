import { logger } from './logger.js';

/**
 * 文本清理工具类
 * 专门处理文档解析后的文本清理，确保数据库存储正确
 */
export class TextCleaner {
  
  /**
   * 检测文本是否包含二进制数据或乱码
   */
  static isBinaryOrCorrupted(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    
    // 检查是否包含常见的二进制文件标识符
    const binaryPatterns = [
      /PK\u0003\u0004/, // ZIP文件头
      /\u00ff\u00d8\u00ff/, // JPEG文件头
      /\u0089PNG/, // PNG文件头
      /%PDF-/, // PDF文件头
      /word\/_rels\//, // DOCX内部结构
      /\[Content_Types\]\.xml/ // Office文档类型定义
    ];
    
    for (const pattern of binaryPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    // 检查连续的非ASCII字符比例
    const nonAsciiChars = text.match(/[\u0080-\u00ff]/g) || [];
    const nonAsciiRatio = nonAsciiChars.length / text.length;
    
    if (nonAsciiRatio > 0.7) {
      return true;
    }
    
    // 检查可读字符比例
    const readableChars = text.match(/[\u0020-\u007e\u4e00-\u9fff\u00a0-\u00ff]/g) || [];
    const readableRatio = readableChars.length / text.length;
    
    return readableRatio < 0.3;
  }
  
  /**
   * 深度清理文本，移除所有可能的二进制数据和乱码
   */
  static deepClean(text: string): string {
    if (!text) return '';
    
    try {
      let cleaned = String(text);
      
      // 第一阶段：移除明确的二进制数据标识符
      cleaned = cleaned
        .replace(/PK\u0003\u0004[\s\S]*?PK\u0005\u0006/g, '') // 完整的ZIP数据块
        .replace(/word\/_rels\/[\s\S]*?\.xml\.rels/g, '') // DOCX关系文件
        .replace(/docProps\/[\s\S]*?\.xml/g, '') // 文档属性
        .replace(/\[Content_Types\]\.xml[\s\S]*?>/g, '') // 内容类型定义
        .replace(/word\/document\.xml[\s\S]*?<\/w:document>/g, '') // Word文档XML
        .replace(/word\/styles\.xml[\s\S]*?<\/w:styles>/g, '') // 样式XML
        .replace(/word\/fontTable\.xml[\s\S]*?<\/w:fonts>/g, '') // 字体表XML
        .replace(/word\/settings\.xml[\s\S]*?<\/w:settings>/g, ''); // 设置XML
      
      // 第二阶段：移除XML命名空间和标签
      cleaned = cleaned
        .replace(/<\?xml[^>]*\?>/g, '') // XML声明
        .replace(/xmlns[^=]*="[^"]*"/g, '') // XML命名空间
        .replace(/<[^>]*>/g, ' ') // 所有XML/HTML标签
        .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, ' '); // HTML实体
      
      // 第三阶段：移除控制字符和特殊字符
      cleaned = cleaned
        .replace(/[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '') // 控制字符
        .replace(/[\ufeff\ufffe]/g, '') // BOM标记
        .replace(/[\u00ff\u00fe\u00ef\u00bb\u00bf]/g, ''); // 其他特殊标记
      
      // 第四阶段：移除看起来像编码错误的模式
      cleaned = cleaned
        .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '') // 可能的base64数据
        .replace(/[\u0080-\u00ff]{8,}/g, '') // 连续的高位字符
        .replace(/[^\u0020-\u007e\u4e00-\u9fff\u00a0-\u024f\s]/g, ''); // 只保留可读字符
      
      // 第五阶段：标准化空白字符
      cleaned = cleaned
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/[ \u00a0]+/g, ' ') // 合并空格和不间断空格
        .replace(/\n\s*\n\s*\n/g, '\n\n') // 最多保留两个连续换行
        .trim();
      
      // 最终验证
      if (cleaned.length < 10) {
        logger.warn('Cleaned text too short, might be corrupted');
        return '';
      }
      
      if (this.isBinaryOrCorrupted(cleaned)) {
        logger.warn('Text still appears to be corrupted after cleaning');
        return '';
      }
      
      return cleaned;
      
    } catch (error) {
      logger.error('Error in deep text cleaning:', error);
      return '';
    }
  }
  
  /**
   * 轻量级清理，保留更多原始内容
   */
  static lightClean(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\u0000/g, '') // 移除NULL字符
      .replace(/[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '') // 移除控制字符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * 智能清理：先尝试轻量级清理，如果仍有问题则使用深度清理
   */
  static smartClean(text: string): string {
    if (!text) return '';
    
    // 首先尝试轻量级清理
    const lightCleaned = this.lightClean(text);
    
    // 检查是否仍然有问题
    if (!this.isBinaryOrCorrupted(lightCleaned) && lightCleaned.length > 10) {
      return lightCleaned;
    }
    
    // 如果仍有问题，使用深度清理
    logger.info('Light cleaning insufficient, applying deep clean');
    return this.deepClean(text);
  }
  
  /**
   * 验证文本质量
   */
  static validateTextQuality(text: string): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;
    
    if (!text || text.length === 0) {
      return { isValid: false, score: 0, issues: ['Empty text'] };
    }
    
    // 检查长度
    if (text.length < 10) {
      issues.push('Text too short');
      score -= 30;
    }
    
    // 检查可读字符比例
    const readableChars = text.match(/[\u0020-\u007e\u4e00-\u9fff\u00a0-\u024f]/g) || [];
    const readableRatio = readableChars.length / text.length;
    
    if (readableRatio < 0.5) {
      issues.push('Low readable character ratio');
      score -= 40;
    } else if (readableRatio < 0.8) {
      issues.push('Moderate readable character ratio');
      score -= 20;
    }
    
    // 检查是否包含二进制数据
    if (this.isBinaryOrCorrupted(text)) {
      issues.push('Contains binary or corrupted data');
      score -= 50;
    }
    
    // 检查连续空白
    if (/\s{50,}/.test(text)) {
      issues.push('Excessive whitespace');
      score -= 10;
    }
    
    return {
      isValid: score >= 50,
      score: Math.max(0, score),
      issues
    };
  }
}

export default TextCleaner;
