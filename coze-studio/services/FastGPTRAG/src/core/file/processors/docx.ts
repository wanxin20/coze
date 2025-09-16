import mammoth, { images } from 'mammoth';
import { logger } from '@/utils/logger.js';
import { FileProcessResult, ImageType } from '../types.js';

/**
 * DOCX文件处理器 - 复刻FastGPT-2的实现
 * 将DOCX转换为HTML再转为Markdown格式
 */
export class DocxProcessor {
  
  async processFromBuffer(buffer: Buffer): Promise<FileProcessResult> {
    const imageList: ImageType[] = [];
    
    try {
      // Processing DOCX file
      
      // 使用mammoth将DOCX转换为HTML，同时提取图片
      const { value: html } = await mammoth.convertToHtml(
        { buffer },
        {
          ignoreEmptyParagraphs: false,
          includeDefaultStyleMap: true,
          convertImage: images.imgElement(async (image) => {
            try {
              const imageBase64 = await image.readAsBase64String();
              const uuid = crypto.randomUUID();
              const mime = image.contentType;
              
              imageList.push({
                uuid,
                base64: imageBase64,
                mime
              });
              
              return {
                src: uuid
              };
            } catch (imageError) {
              logger.warn('Failed to process image in DOCX:', imageError);
              return { src: '' };
            }
          }),
          // 添加样式映射来处理标题和段落
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh"
          ]
        }
      );

      // 将HTML转换为Markdown格式的文本
      const rawText = this.html2md(html);

      logger.info(`DOCX processed successfully: ${rawText.length} characters, ${imageList.length} images`);

      return {
        rawText,
        imageList,
        metadata: {
          format: 'docx',
          imageCount: imageList.length,
          contentLength: rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process DOCX file:', error);
      throw new Error('Cannot read DOCX file, please convert to PDF or try another format');
    }
  }

  async processFromPath(filePath: string): Promise<FileProcessResult> {
    try {
      logger.info(`Processing DOCX file from path: ${filePath}`);
      
      const imageList: ImageType[] = [];
      
      const { value: html } = await mammoth.convertToHtml(
        { path: filePath },
        {
          ignoreEmptyParagraphs: false,
          convertImage: images.imgElement(async (image) => {
            const imageBase64 = await image.readAsBase64String();
            const uuid = crypto.randomUUID();
            const mime = image.contentType;
            
            imageList.push({
              uuid,
              base64: imageBase64,
              mime
            });
            
            return {
              src: uuid
            };
          })
        }
      );

      const rawText = this.html2md(html);

      return {
        rawText,
        imageList,
        metadata: {
          format: 'docx',
          imageCount: imageList.length,
          contentLength: rawText.length
        }
      };
    } catch (error) {
      logger.error('Failed to process DOCX file from path:', error);
      throw error;
    }
  }

  /**
   * 将HTML转换为Markdown格式
   * 完整复刻FastGPT-2的html2md功能
   */
  private html2md(html: string): string {
    try {
      const TurndownService = require('turndown');
      const turndownPluginGfm = require('joplin-turndown-plugin-gfm');
      
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '_',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });

      // 移除不需要的标签
      turndownService.remove(['i', 'script', 'iframe', 'style']);
      
      // 使用GFM插件
      turndownService.use(turndownPluginGfm.gfm);

      // 添加媒体标签处理规则
      turndownService.addRule('media', {
        filter: ['video', 'source', 'audio'],
        replacement: function (content: string, node: any) {
          const src = node.getAttribute('src');
          const sources = node.getElementsByTagName('source');
          const firstSourceSrc = sources.length > 0 ? sources[0].getAttribute('src') : null;
          const mediaSrc = src || firstSourceSrc;

          if (mediaSrc) {
            return `[${mediaSrc}](${mediaSrc}) `;
          }

          return content;
        }
      });

      // 处理Base64图片
      const processedHtml = this.processBase64Images(html);
      
      const markdown = turndownService.turndown(processedHtml);
      
      // 清理多余的空行并确保UTF-8编码
      return markdown
        .replace(/\n{3,}/g, '\n\n')
        .trim();
        
    } catch (error) {
      logger.warn('Failed to convert HTML to Markdown, returning cleaned text:', error);
      // 如果转换失败，返回清理后的纯文本，确保编码正确
      return this.cleanHtmlToText(html);
    }
  }

  /**
   * 处理HTML中的Base64图片
   */
  private processBase64Images(htmlContent: string): string {
    const base64Regex = /src="data:([^;]+);base64,([^"]+)"/g;
    
    return htmlContent.replace(base64Regex, (match, mime, base64Data) => {
      const uuid = crypto.randomUUID();
      return `src="${uuid}"`;
    });
  }

  /**
   * 清理HTML标签并确保文本编码正确
   */
  private cleanHtmlToText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')  // 移除HTML标签
      .replace(/&nbsp;/g, ' ')   // 转换HTML实体
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')      // 合并多个空格
      .replace(/\u0000/g, '')    // 移除NULL字符
      .replace(/[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '') // 移除控制字符
      .trim();
  }
}

export const docxProcessor = new DocxProcessor();
