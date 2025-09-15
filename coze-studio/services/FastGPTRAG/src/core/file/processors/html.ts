import { logger } from '../../../utils/logger.js';
import { FileProcessResult, ImageType } from '../types.js';

/**
 * HTML文件处理器 - 复刻FastGPT-2的实现
 * 将HTML转换为Markdown格式并提取图片
 */
export class HtmlProcessor {

  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    try {
      logger.info('Starting HTML processing');
      
      const html = buffer.toString('utf-8');
      const result = await this.html2md(html);
      
      logger.info(`HTML processed successfully: ${result.rawText.length} characters, ${result.imageList?.length || 0} images`);

      return {
        rawText: result.rawText,
        imageList: result.imageList || [],
        metadata: {
          format: 'html',
          imageCount: result.imageList?.length || 0,
          contentLength: result.rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process HTML file:', error);
      throw new Error('Cannot read HTML file, please check the file format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      return this.processFromBuffer(buffer);
    } catch (error) {
      logger.error('Failed to read HTML file from path:', error);
      throw error;
    }
  }

  /**
   * HTML转Markdown - 复刻FastGPT-2的html2md功能
   */
  private async html2md(html: string): Promise<{ rawText: string; imageList?: ImageType[] }> {
    try {
      // 使用cheerio解析HTML
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      
      const imageList: ImageType[] = [];
      
      // 处理图片
      $('img').each((index, element) => {
        const src = $(element).attr('src');
        const alt = $(element).attr('alt') || '';
        
        if (src) {
          // 如果是base64图片
          if (src.startsWith('data:image/')) {
            const matches = src.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (matches) {
              const mime = `image/${matches[1]}`;
              const base64 = matches[2];
              const uuid = crypto.randomUUID();
              
              imageList.push({
                uuid,
                base64,
                mime
              });
              
              // 替换为占位符
              $(element).replaceWith(`[图片: ${alt || uuid}]`);
            }
          } else {
            // 外部链接图片
            $(element).replaceWith(`[图片链接: ${src}${alt ? ' - ' + alt : ''}]`);
          }
        }
      });

      // 移除脚本和样式
      $('script, style, noscript').remove();
      
      // 处理标题
      $('h1, h2, h3, h4, h5, h6').each((index, element) => {
        const level = parseInt(element.tagName.substring(1));
        const text = $(element).text().trim();
        $(element).replaceWith(`\n${'#'.repeat(level)} ${text}\n`);
      });
      
      // 处理段落
      $('p').each((index, element) => {
        const text = $(element).text().trim();
        if (text) {
          $(element).replaceWith(`\n${text}\n`);
        }
      });
      
      // 处理列表
      $('ul li, ol li').each((index, element) => {
        const text = $(element).text().trim();
        if (text) {
          $(element).replaceWith(`\n- ${text}\n`);
        }
      });
      
      // 处理换行
      $('br').replaceWith('\n');
      
      // 处理链接
      $('a').each((index, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href && text) {
          $(element).replaceWith(`[${text}](${href})`);
        } else if (text) {
          $(element).replaceWith(text);
        }
      });
      
      // 处理表格
      $('table').each((index, element) => {
        let tableText = '\n';
        
        $(element).find('tr').each((rowIndex, row) => {
          const cells: string[] = [];
          $(row).find('td, th').each((cellIndex, cell) => {
            cells.push($(cell).text().trim());
          });
          
          if (cells.length > 0) {
            tableText += `| ${cells.join(' | ')} |\n`;
            
            // 添加表头分隔符
            if (rowIndex === 0 && $(row).find('th').length > 0) {
              tableText += `| ${cells.map(() => '---').join(' | ')} |\n`;
            }
          }
        });
        
        $(element).replaceWith(tableText);
      });
      
      // 处理强调
      $('strong, b').each((index, element) => {
        const text = $(element).text().trim();
        $(element).replaceWith(`**${text}**`);
      });
      
      $('em, i').each((index, element) => {
        const text = $(element).text().trim();
        $(element).replaceWith(`*${text}*`);
      });
      
      // 处理代码
      $('code').each((index, element) => {
        const text = $(element).text();
        $(element).replaceWith(`\`${text}\``);
      });
      
      $('pre').each((index, element) => {
        const text = $(element).text();
        $(element).replaceWith(`\n\`\`\`\n${text}\n\`\`\`\n`);
      });
      
      // 获取最终文本
      let rawText = $.root().text();
      
      // 清理文本
      rawText = rawText
        .replace(/\n\s*\n\s*\n/g, '\n\n') // 合并多个换行
        .replace(/\s+/g, ' ') // 合并多个空格
        .replace(/\n /g, '\n') // 移除行首空格
        .trim();
      
      return {
        rawText,
        imageList: imageList.length > 0 ? imageList : undefined
      };
      
    } catch (error) {
      logger.warn('Failed to convert HTML to Markdown, using fallback method:', error);
      // 回退方法：简单移除HTML标签
      return {
        rawText: this.simpleHtmlToText(html)
      };
    }
  }
  
  /**
   * 简单的HTML到文本转换（回退方法）
   */
  private simpleHtmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除脚本
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // 移除样式
      .replace(/<[^>]+>/g, ' ') // 移除所有HTML标签
      .replace(/&nbsp;/g, ' ') // 转换HTML实体
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // 合并空格
      .trim();
  }
}

export const htmlProcessor = new HtmlProcessor();
