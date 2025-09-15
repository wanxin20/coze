/**
 * 毕马威抗衰老产业报告上传和搜索功能测试 - 测试PDF文件处理和银发经济相关内容搜索
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const TEST_HEADERS = {
  'x-team-id': '000000000000000000000001',
  'x-user-id': '000000000000000000000002',
  'Content-Type': 'application/json'
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: TEST_HEADERS,
  timeout: 30000
});

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 文件上传测试函数
async function testFileUpload(datasetId) {
  log('\n🔼 测试文件上传功能...', 'blue');
  
  const filePath = path.join(process.cwd(), '毕马威：2025抗衰老产业报告.pdf');
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    log('❌ 文件 毕马威：2025抗衰老产业报告.pdf 不存在', 'red');
    return null;
  }
  
  log(`   文件路径: ${filePath}`, 'blue');
  log(`   文件大小: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB`, 'blue');
  
  try {
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
          formData.append('data', JSON.stringify({
        datasetId: datasetId,
        name: '毕马威抗衰老产业报告',
        type: 'file',
        chunkSize: 512,
        chunkSplitter: '\\n\\n',
        trainingType: 'chunk'
      }));
    
    // 上传文件
    const uploadResponse = await axios.post(
      `${BASE_URL}/api/core/dataset/collection/create/file`,
      formData,
      {
        headers: {
          ...TEST_HEADERS,
          ...formData.getHeaders()
        },
        timeout: 60000
      }
    );
    
    if (uploadResponse.data.code === 200) {
      const collectionId = uploadResponse.data.data.collectionId;
      log('✅ 文件上传成功', 'green');
      log(`   集合ID: ${collectionId}`, 'blue');
      return collectionId;
    } else {
      log('❌ 文件上传失败', 'red');
      log(`   错误信息: ${uploadResponse.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log('❌ 文件上传异常', 'red');
    log(`   错误: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`   API响应: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    return null;
  }
}

// 等待文件训练完成函数
async function waitForFileTraining(datasetId, collectionId, maxAttempts = 30) {
  log('\n⏳ 等待文件向量化训练完成...', 'blue');
  log('   这可能需要较长时间，请耐心等待...', 'yellow');
  
  let processingComplete = false;
  let attempts = 0;
  let backoffDelay = 5000; // 初始延迟5秒
  
  while (!processingComplete && attempts < maxAttempts) {
    attempts++;
    log(`   检查处理状态 (${attempts}/${maxAttempts})...`, 'cyan');
    
    try {
      // 直接检查集合状态
      const collectionStatus = await api.get(`/api/core/dataset/collection/${collectionId}`);
      
      if (collectionStatus.data && collectionStatus.data.code === 200) {
        const collection = collectionStatus.data.data;
        const status = collection.status || 'unknown';
        log(`   当前状态: ${status}`, 'cyan');
        
        // 完成状态
        if (status === 'ready' || status === 'trained' || status === 'completed') {
          processingComplete = true;
          log('   ✅ 文件处理完成', 'green');
          
          // 验证搜索功能
          try {
            const testSearch = await api.post('/api/core/dataset/searchTest', {
              datasetId: datasetId,
              text: '银发经济',
              limit: 3,
              similarity: 0.3,
              searchMode: 'embedding'
            });
            
            if (testSearch.data.code === 200) {
              const results = testSearch.data.data.searchRes || [];
              const fileResults = results.filter(r => r.collectionId === collectionId);
              if (fileResults.length > 0) {
                log(`   📋 搜索验证成功：找到 ${fileResults.length} 个相关结果`, 'cyan');
                fileResults.slice(0, 2).forEach((result, index) => {
                  const content = result.q || result.a || '无内容';
                  const score = result.score?.[0]?.value || result.score;
                  log(`   ${index + 1}. ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`, 'blue');
                  if (score !== undefined) {
                    log(`      相似度: ${typeof score === 'number' ? score.toFixed(4) : score}`, 'blue');
                  }
                });
              }
            }
          } catch (searchError) {
            log('   ⚠️ 搜索验证失败，但训练已完成', 'yellow');
          }
          
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
          backoffDelay = Math.min(backoffDelay * 1.2, 20000); // 最大延迟20秒
        }
      } else {
        log(`   ⚠️ 无法获取状态信息，等待 ${backoffDelay/1000} 秒后重试...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay = Math.min(backoffDelay * 1.2, 20000);
      }
    } catch (statusError) {
      log(`   ⚠️ 状态检查失败: ${statusError.message}`, 'yellow');
      // 错误情况下也使用退避延迟
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      backoffDelay = Math.min(backoffDelay * 1.2, 20000);
    }
  }
  
  if (!processingComplete) {
    log('   ⚠️ 文件处理超时，但可能训练仍在进行中', 'yellow');
  }
  
  return processingComplete;
}

let testDatasetId = null;
let fileCollectionId = null;

// 测试流程
async function runSimpleTest() {
  log('🚀 开始毕马威抗衰老产业报告上传和搜索功能测试', 'cyan');
  console.log('=' .repeat(50));

  try {
    // 1. 检查服务状态
    log('\n1️⃣  检查服务状态...', 'blue');
    const healthCheck = await api.get('/health');
    if (healthCheck.data.status === 'ok') {
      log('✅ 服务运行正常', 'green');
    }

    // 2. 测试embedding API
    log('\n2️⃣  测试 Embedding API...', 'blue');
    try {
      const embeddingTest = await api.post('/api/test/embedding', {
        text: 'FastGPT测试文本',
        model: 'text-embedding-v3'
      });
      
      if (embeddingTest.data.code === 200) {
        log('✅ Embedding API 工作正常', 'green');
        log(`   模型: ${embeddingTest.data.data.model}`, 'blue');
        log(`   提供商: ${embeddingTest.data.data.provider}`, 'blue');
        log(`   向量维度: ${embeddingTest.data.data.vectors[0].length}`, 'blue');
        log(`   Token消耗: ${embeddingTest.data.data.tokens}`, 'blue');
      }
    } catch (error) {
      log('❌ Embedding API 测试失败', 'red');
      log(`   错误: ${error.message}`, 'red');
      if (error.response?.data) {
        log(`   API响应: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
      }
      log('🔧 请检查 API 配置和网络连接', 'yellow');
      return;
    }

    // 3. 创建测试数据集
    log('\n3️⃣  创建测试数据集...', 'blue');
    const datasetResponse = await api.post('/api/core/dataset', {
      name: '毕马威抗衰老产业报告数据集',
      intro: '用于测试毕马威抗衰老产业报告上传和搜索功能的数据集',
      type: 'dataset',
      vectorModel: 'text-embedding-v3',
      agentModel: 'qwen-max'
    });

    if (datasetResponse.data.code === 200) {
      testDatasetId = datasetResponse.data.data;
      log('✅ 数据集创建成功', 'green');
      log(`   数据集ID: ${testDatasetId}`, 'blue');
    }

    // 4. 测试文件上传和训练
    log('\n4️⃣  测试文件上传功能...', 'blue');
    fileCollectionId = await testFileUpload(testDatasetId);
    
    let fileTrainingSuccess = false;
    if (fileCollectionId) {
      // 等待文件训练完成
      fileTrainingSuccess = await waitForFileTraining(testDatasetId, fileCollectionId);
      if (!fileTrainingSuccess) {
        log('⚠️  文件训练可能未完成，但继续测试...', 'yellow');
      }
    } else {
      log('⚠️  文件上传失败，跳过文件相关测试...', 'yellow');
    }

    // 5. 手动触发重新训练
    log('\n5️⃣  手动触发重新训练...', 'blue');
    try {
      const retrainResponse = await api.post('/api/core/dataset/retrain', {
        datasetId: testDatasetId
      });
      
      if (retrainResponse.data.code === 200) {
        log('✅ 重新训练已启动', 'green');
        log(`   训练任务数: ${retrainResponse.data.data.collectionsCount}`, 'blue');
        
        // 等待训练完成
        log('   等待重新训练完成...', 'yellow');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      log('⚠️  重新训练可能失败，继续测试...', 'yellow');
    }

    // 6. 执行文件搜索测试
    log('\n6️⃣  执行文件搜索测试...', 'blue');

    // 7. 测试银发经济相关内容搜索
    let fileSuccessCount = 0;
    if (fileCollectionId) {
      log('\n7️⃣  测试银发经济相关内容搜索...', 'blue');
      
      const fileSearchQueries = [
        '银发经济',
        '抗衰老',
        '健康管理',
        '养老服务',
        '医疗保健',
        '消费升级',
        '产业趋势'
      ];
      
      for (const query of fileSearchQueries) {
        try {
          log(`\n   测试文件查询: "${query}"`, 'cyan');
          
          const searchResponse = await api.post('/api/core/dataset/searchTest', {
            datasetId: testDatasetId,
            text: query,
            limit: 5,
            similarity: 0.2,
            searchMode: 'embedding'
          });
          
          if (searchResponse.data.code === 200) {
            const results = searchResponse.data.data.searchRes || [];
            const fileResults = results.filter(r => r.collectionId === fileCollectionId);
            
            log(`   ✅ 搜索成功，找到 ${fileResults.length} 个文件相关结果`, fileResults.length > 0 ? 'green' : 'yellow');
            
            if (fileResults.length > 0) {
              fileSuccessCount++;
              
              // 显示文件搜索结果详情
              log(`   📋 文件搜索结果详情:`, 'cyan');
              console.log('   ' + '-'.repeat(60));
              
              fileResults.forEach((result, index) => {
                log(`   文件结果 ${index + 1}:`, 'yellow');
                
                const content = result.q || result.a || '无内容';
                log(`   📄 内容: ${content}`, 'blue');
                
                const score = result.score?.[0]?.value || result.score;
                if (score !== undefined) {
                  log(`   📊 相似度分数: ${typeof score === 'number' ? score.toFixed(4) : score}`, 'blue');
                }
                
                if (result.dataId) {
                  log(`   🔗 数据ID: ${result.dataId}`, 'blue');
                }
                
                console.log('   ' + '-'.repeat(40));
              });
            }
          } else {
            log(`   ❌ 文件搜索失败: ${searchResponse.data.message}`, 'red');
          }
        } catch (error) {
          log(`   ❌ 文件查询失败: ${error.message}`, 'red');
        }
      }
      
      log(`\n📊 文件搜索统计:`, 'cyan');
      log(`   文件查询总数: ${fileSearchQueries.length}`, 'blue');
      log(`   文件成功查询: ${fileSuccessCount}`, fileSuccessCount > 0 ? 'green' : 'red');
      log(`   文件搜索成功率: ${((fileSuccessCount / fileSearchQueries.length) * 100).toFixed(1)}%`, 
          fileSuccessCount > 0 ? 'green' : 'red');
    }

    // 8. 测试结果总结
    log('\n8️⃣ 测试结果总结', 'blue');
    console.log('=' .repeat(50));
    
    if (fileCollectionId) {
      log(`📊 文件测试统计:`, 'cyan');
      log(`   文件上传: ✅ 成功`, 'green');
      log(`   文件训练: ${fileTrainingSuccess ? '✅ 完成' : '⚠️ 可能未完成'}`, fileTrainingSuccess ? 'green' : 'yellow');
      log(`   文件搜索: ${fileSuccessCount > 0 ? '✅ 可用' : '❌ 不可用'}`, fileSuccessCount > 0 ? 'green' : 'red');
      
      if (fileSuccessCount === 0) {
        log('\n🔧 可能的问题和解决方案:', 'yellow');
        log('   1. PDF文件上传失败 - 检查文件格式和大小', 'yellow');
        log('   2. PDF文件解析失败 - 检查文件内容是否损坏', 'yellow');
        log('   3. 向量化失败 - 检查 Embedding API 配置', 'yellow');
        log('   4. 训练进程问题 - 检查服务器日志', 'yellow');
        log('   5. 银发经济内容识别失败 - 检查PDF文本提取是否正确', 'yellow');
      } else {
        log('\n🎉 恭喜！毕马威抗衰老产业报告上传和搜索功能工作正常！', 'green');
      }
    } else {
      log('❌ 文件上传失败，无法进行后续测试', 'red');
    }

  } catch (error) {
    log(`❌ 测试过程发生错误: ${error.message}`, 'red');
    if (error.response?.data) {
      console.log('错误详情:', error.response.data);
    }
  } finally {
    // 清理测试数据
    log('\n🧹 清理测试数据...', 'cyan');
    try {
      if (fileCollectionId) {
        await api.delete(`/api/core/dataset/collection/${fileCollectionId}`);
        log('   ✅ 文件集合已删除', 'green');
      }
      if (testDatasetId) {
        await api.delete(`/api/core/dataset/${testDatasetId}`);
        log('   ✅ 数据集已删除', 'green');
      }
      log('✅ 清理完成', 'green');
    } catch (error) {
      log('⚠️  清理可能不完整', 'yellow');
    }
  }
}

// 启动测试
runSimpleTest().catch(error => {
  log(`❌ 测试失败: ${error.message}`, 'red');
  process.exit(1);
});
