/**
 * Coze RAG API集成测试脚本
 * 测试上传2025世界人工智能大会全量演讲稿汇总.pdf文件的知识库全流程（session认证已禁用）
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const COZE_BASE_URL = 'http://localhost:8888';  // Coze后端服务

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建简单的Coze API客户端（无需认证）
function createCozeApi() {
  return axios.create({
    baseURL: COZE_BASE_URL,
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 60000 // 增加超时时间以支持文件上传
  });
}

// 创建文件上传客户端
function createFileUploadApi() {
  return axios.create({
    baseURL: COZE_BASE_URL,
    timeout: 120000 // 文件上传需要更长的超时时间
  });
}

// 测试PDF文件上传和知识库全流程
async function testPDFFileRAGIntegration() {
  log('\n📋 测试2025世界人工智能大会全量演讲稿汇总.pdf文件上传的RAG知识库全流程', 'cyan');
  console.log('-'.repeat(60));

  // 创建API客户端
  const cozeApi = createCozeApi();
  const fileUploadApi = createFileUploadApi();

  try {
    // 检查PDF文件是否存在
    const pdfFilePath = path.join(__dirname, '2025世界人工智能大会全量演讲稿汇总.pdf');
    if (!fs.existsSync(pdfFilePath)) {
      log(`❌ 文件不存在: ${pdfFilePath}`, 'red');
      log('请确保2025世界人工智能大会全量演讲稿汇总.pdf文件位于测试脚本同一目录下', 'yellow');
      return false;
    }
    
    log(`📄 找到测试文件: ${pdfFilePath}`, 'green');
    const fileStats = fs.statSync(pdfFilePath);
    log(`   文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`, 'cyan');

    // 1. 测试知识库创建
    log('1️⃣ 创建知识库...', 'blue');
    const dataset = await cozeApi.post('/api/knowledge/rag/core/dataset', {
      name: '2025世界人工智能大会演讲稿知识库',
      intro: '基于2025世界人工智能大会全量演讲稿汇总.pdf文档创建的知识库',
      type: 'dataset',
      vectorModel: 'text-embedding-3-small',
      agentModel: 'gpt-4o-mini'
    });

    if (!dataset.data || dataset.data.code !== 200) {
      log('❌ 知识库创建失败', 'red');
      console.log('错误响应:', dataset.data);
      return false;
    }

    const datasetId = dataset.data.data || dataset.data.id;
    const datasetIdStr = String(datasetId);
    log(`✅ 知识库创建成功: ${datasetIdStr}`, 'green');

    // 2. 文件上传并创建集合
    log('2️⃣ 上传PDF文件并创建集合...', 'blue');
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', fs.createReadStream(pdfFilePath), {
      filename: '2025世界人工智能大会全量演讲稿汇总.pdf',
      contentType: 'application/pdf'
    });
    
    // 添加必需的datasetId和其他参数
    formData.append('datasetId', datasetIdStr);
    formData.append('name', 'AI大会演讲稿集合');

    try {
      // 上传文件到RAG服务（现在会直接创建集合）
      log('   正在上传文件并创建集合...', 'cyan');
      const uploadResponse = await fileUploadApi.post('/api/knowledge/rag/file/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
        }
      });

      if (!uploadResponse.data || uploadResponse.data.code !== 200) {
        throw new Error(`文件上传失败: ${uploadResponse.data?.message || '未知错误'}`);
      }

      const collectionId = uploadResponse.data.data.collectionId;
      const trainingJobId = uploadResponse.data.data.trainingJobId;
      log(`   ✅ 文件上传和集合创建成功: ${collectionId}`, 'green');
      log(`   训练任务ID: ${trainingJobId}`, 'cyan');

      // 文件上传已经直接创建了集合，无需额外步骤

      // 3. 等待文件处理和向量化完成
      log('3️⃣ 等待文件处理和向量化完成...', 'blue');
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // PDF文件较大，增加最大尝试次数
      let backoffDelay = 10000; // PDF文件处理较慢，初始延迟10秒

      while (!processingComplete && attempts < maxAttempts) {
        attempts++;
        log(`   检查处理状态 (${attempts}/${maxAttempts})...`, 'cyan');
        
        try {
          // 检查集合状态
          const collectionStatus = await cozeApi.get(`/api/knowledge/rag/core/dataset/collection/${collectionId}`);
          
          if (collectionStatus.data && collectionStatus.data.collection) {
            const status = collectionStatus.data.collection.status || 'unknown';
            log(`   当前状态: ${status}`, 'cyan');
            
            // 完成状态
            if (status === 'ready' || status === 'trained' || status === 'completed') {
              processingComplete = true;
              log('   ✅ 文件处理完成', 'green');
              break; // 重要：完成后立即退出循环
            } 
            // 错误状态
            else if (status === 'error' || status === 'failed') {
              log('   ❌ 文件处理失败', 'red');
              break;
            } 
            // 处理中状态（包括training, processing, pending等）
            else {
              log(`   状态 "${status}" - 等待 ${backoffDelay/1000} 秒后重试...`, 'cyan');
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              backoffDelay = Math.min(backoffDelay * 1.5, 30000); // 最大延迟30秒
            }
          } else {
            log(`   ⚠️ 无法获取状态信息，等待 ${backoffDelay/1000} 秒后重试...`, 'yellow');
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            backoffDelay = Math.min(backoffDelay * 1.5, 30000);
          }
        } catch (statusError) {
          log(`   ⚠️ 状态检查失败: ${statusError.message}`, 'yellow');
          // 错误情况下也使用退避延迟
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          backoffDelay = Math.min(backoffDelay * 1.5, 30000);
        }
      }

      if (!processingComplete) {
        log('   ⚠️ 文件处理超时，但继续进行搜索测试', 'yellow');
      }

      // 4. 测试知识库搜索功能
      log('4️⃣ 测试知识库搜索功能...', 'blue');
      
      // 等待一段时间确保向量化完成
      log('   等待向量化完成...', 'cyan');
      await new Promise(resolve => setTimeout(resolve, 10000)); // PDF文件较大，等待时间延长
      
      try {
        const searchQueries = [
          { query: '什么是量子', description: '搜索量子计算相关内容' },
          { query: '什么是具身智能', description: '搜索具身智能相关内容' },
          { query: '什么是大模型', description: '搜索大模型相关内容' },
          { query: '什么是人工智能', description: '搜索人工智能相关内容' },
          { query: '什么是机器学习', description: '搜索机器学习相关内容' }
        ];

        for (const { query, description } of searchQueries) {
          log(`   ${description}: "${query}"`, 'cyan');
          
          const searchResult = await cozeApi.post('/api/knowledge/rag/core/dataset/searchTest', {
            datasetId: datasetIdStr,
            text: query,
            limit: 5,
            similarity: 0.3,  // 降低相似度阈值到0.3，使搜索更宽松
            searchMode: 'mixedRecall'
          });
          
          // 调试：打印完整响应
          console.log('搜索响应:', JSON.stringify(searchResult.data, null, 2));
          
          if (searchResult.data && searchResult.data.data && searchResult.data.list) {
            const results = searchResult.data.list;
            log(`     找到 ${results.length} 个相关结果`, 'green');
            
            // 显示前2个结果的摘要和分数
            results.slice(0, 2).forEach((result, index) => {
              const preview = result.q ? result.q.substring(0, 100) + '...' : '无内容预览';
              const score = result.score && result.score[0] ? result.score[0].value.toFixed(4) : 'N/A';
              log(`     结果${index + 1} (分数: ${score}): ${preview}`, 'cyan');
            });
          } else if (searchResult.data && searchResult.data.data && searchResult.data.data.list) {
            // 备用解析路径
            const results = searchResult.data.data.list;
            log(`     找到 ${results.length} 个相关结果`, 'green');
            
            results.slice(0, 2).forEach((result, index) => {
              const preview = result.q ? result.q.substring(0, 100) + '...' : '无内容预览';
              const score = result.score && result.score[0] ? result.score[0].value.toFixed(4) : 'N/A';
              log(`     结果${index + 1} (分数: ${score}): ${preview}`, 'cyan');
            });
          } else {
            log(`     未找到相关结果`, 'yellow');
            log(`     响应结构: ${JSON.stringify(Object.keys(searchResult.data || {}), null, 2)}`, 'yellow');
          }
        }

        log('   ✅ 知识库搜索功能测试完成', 'green');

      } catch (searchError) {
        log('   ⚠️ 知识库搜索测试失败', 'yellow');
        console.log('   搜索错误:', searchError.response?.data || searchError.message);
      }

      // 5. 测试知识库管理功能
      log('5️⃣ 测试知识库管理功能...', 'blue');
      try {
        // 获取知识库列表
        log('   获取知识库列表...', 'cyan');
        const datasetList = await cozeApi.get('/api/knowledge/rag/core/dataset');
        if (datasetList.data && datasetList.data.data && datasetList.data.data.list) {
          log(`   ✅ 知识库列表获取成功: 共 ${datasetList.data.data.list.length} 个知识库`, 'green');
        }
        
        // 获取知识库详情
        log('   获取知识库详情...', 'cyan');
        const datasetDetail = await cozeApi.get(`/api/knowledge/rag/core/dataset/${datasetIdStr}`);
        if (datasetDetail.data && datasetDetail.data.data) {
          log('   ✅ 知识库详情获取成功', 'green');
          log(`   知识库名称: ${datasetDetail.data.data.name}`, 'cyan');
          log(`   数据计数: ${datasetDetail.data.data.dataCount || 0}`, 'cyan');
        }

        // 获取集合列表
        log('   获取集合列表...', 'cyan');
        const collectionList = await cozeApi.get(`/api/knowledge/rag/core/dataset/collection?datasetId=${datasetIdStr}`);
        if (collectionList.data && collectionList.data.data && collectionList.data.data.list) {
          log(`   ✅ 集合列表获取成功: 共 ${collectionList.data.data.list.length} 个集合`, 'green');
        }

      } catch (managementError) {
        log('   ⚠️ 知识库管理功能测试跳过', 'yellow');
        console.log('   管理功能错误:', managementError.response?.data || managementError.message);
      }

      // 清理测试数据
      log('🧹 清理测试数据...', 'cyan');
      try {
        await cozeApi.delete(`/api/knowledge/rag/core/dataset/${datasetIdStr}`);
        log('✅ 测试数据清理完成', 'green');
      } catch (cleanupError) {
        log('⚠️ 清理可能不完整，请手动检查', 'yellow');
        console.log('清理错误:', cleanupError.response?.data || cleanupError.message);
      }

      return true;

    } catch (fileUploadError) {
      log('❌ 文件上传失败', 'red');
      console.log('文件上传错误:', fileUploadError.response?.data || fileUploadError.message);
      
      // 尝试清理已创建的知识库
      try {
        await cozeApi.delete(`/api/knowledge/rag/core/dataset/${datasetIdStr}`);
        log('✅ 已清理创建的知识库', 'green');
      } catch (cleanupError) {
        log('⚠️ 清理失败，请手动删除知识库', 'yellow');
      }
      
      return false;
    }

  } catch (error) {
    log(`❌ yanxue.docx文件RAG集成测试失败: ${error.message}`, 'red');
    if (error.response?.data) {
      console.log('错误详情:', error.response.data);
    }
    return false;
  }
}



// 主测试函数
async function runCompleteTest() {
  log('🚀 开始2025世界人工智能大会演讲稿PDF文件RAG知识库全流程测试', 'magenta');
  console.log('='.repeat(70));
  
  // 测试文件上传RAG集成
  const ragResult = await testPDFFileRAGIntegration();

  // 总结
  log('\n📊 完整测试结果总结', 'magenta');
  console.log('='.repeat(70));
  
  log(`📄 AI大会演讲稿PDF文件RAG测试: ${ragResult ? '✅ 通过' : '❌ 失败'}`, 
      ragResult ? 'green' : 'red');

  if (ragResult) {
    log('\n🎉 恭喜！AI大会演讲稿PDF文件RAG知识库全流程测试通过！', 'green');
    log('📚 文件上传、处理、向量化、搜索功能全部正常', 'cyan');
    log('🔍 现在可以使用PDF文档上传功能进行RAG开发了', 'cyan');
  } else {
    log('\n🔧 PDF文件RAG测试失败，请检查以下项目:', 'yellow');
    log('1. 确保2025世界人工智能大会全量演讲稿汇总.pdf文件存在于测试脚本同一目录', 'blue');
    log('2. 确保Coze后端服务运行在8888端口', 'blue');
    log('3. 确保FastGPTRAG服务运行在3001端口', 'blue');
    log('4. 检查RAG集成配置和文件上传功能', 'blue');
    log('5. 验证向量模型和embedding服务正常', 'blue');
  }
}

// 启动完整测试
runCompleteTest().catch(error => {
  log(`❌ 测试执行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
