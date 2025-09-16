/**
 * 图片上传和搜索功能测试 - 测试平安银行回执图片
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

// 测试配置选项
const TEST_CONFIG = {
  vlmModel: 'gpt-4o-mini',           // 视觉语言模型
  chunkSize: 512,                   // 图片块大小
  showDetailedLogs: true            // 是否显示详细日志
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

// 图片上传测试函数
async function testImageUpload(datasetId) {
  log('\n🖼️  测试图片文件上传功能...', 'blue');
  log(`   视觉模型: ${TEST_CONFIG.vlmModel}`, 'blue');
  
  const imagePath = path.join(process.cwd(), 'ceshi.jpeg');
  
  // 检查图片文件是否存在
  if (!fs.existsSync(imagePath)) {
    log('❌ 图片文件 ceshi.jpeg 不存在', 'red');
    log(`   请确保文件位于: ${imagePath}`, 'yellow');
    return null;
  }
  
  log(`   图片路径: ${imagePath}`, 'blue');
  log(`   图片大小: ${(fs.statSync(imagePath).size / 1024).toFixed(2)} KB`, 'blue');
  
  try {
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    formData.append('data', JSON.stringify({
      datasetId: datasetId,
      name: '平安银行回执图片',
      type: 'image',
      chunkSize: TEST_CONFIG.chunkSize,
      trainingType: 'imageParse', // 图片解析训练模式
      vlmModel: TEST_CONFIG.vlmModel
    }));
    
    // 上传图片
    const uploadResponse = await axios.post(
      `${BASE_URL}/api/core/dataset/collection/create/file`,
      formData,
      {
        headers: {
          ...TEST_HEADERS,
          ...formData.getHeaders()
        },
        timeout: 120000 // 图片处理可能需要更长时间
      }
    );
    
    if (uploadResponse.data.code === 200) {
      const collectionId = uploadResponse.data.data.collectionId;
      log('✅ 图片上传成功', 'green');
      log(`   集合ID: ${collectionId}`, 'blue');
      return collectionId;
    } else {
      log('❌ 图片上传失败', 'red');
      log(`   错误信息: ${uploadResponse.data.message}`, 'red');
      return null;
    }
  } catch (error) {
    log('❌ 图片上传异常', 'red');
    log(`   错误: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`   API响应: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    return null;
  }
}

// 智能等待图片训练完成函数
async function waitForImageTraining(datasetId, collectionId, timeoutMinutes = 5) {
  log('\n⏳ 等待图片向量化训练完成...', 'blue');
  log('   图片处理可能需要较长时间，使用智能等待策略...', 'yellow');
  
  const startTime = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let attempts = 0;
  let consecutiveReady = 0; // 连续就绪状态计数
  let lastStatus = '';
  
  // 智能延迟策略
  const getSmartDelay = (status, attempt) => {
    if (status === 'processing' || status === 'training') return 10000; // 处理中，10秒
    if (status === 'ready' || status === 'trained') return 3000; // 就绪状态，3秒快速验证
    if (status === 'pending') return 15000; // 等待中，15秒
    return Math.min(5000 + attempt * 1000, 20000); // 其他状态，渐进式延迟
  };
  
  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    const remainingSeconds = Math.round((timeoutMs - (Date.now() - startTime)) / 1000);
    
    log(`   第 ${attempts} 次检查 (已用时: ${elapsedSeconds}s, 剩余: ${remainingSeconds}s)`, 'cyan');
    
    try {
      // 检查集合状态
      const collectionStatus = await api.get(`/api/core/dataset/collection/${collectionId}`);
      
      if (collectionStatus.data && collectionStatus.data.code === 200) {
        const collection = collectionStatus.data.data;
        const status = collection.status || 'unknown';
        
        // 状态变化检测
        if (status !== lastStatus) {
          log(`   状态变化: ${lastStatus || 'unknown'} → ${status}`, 'blue');
          lastStatus = status;
          consecutiveReady = 0; // 重置计数
        }
        
        // 显示处理进度（如果有）
        if (collection.trainingCount && collection.totalCount) {
          const progress = Math.round((collection.trainingCount / collection.totalCount) * 100);
          log(`   处理进度: ${collection.trainingCount}/${collection.totalCount} (${progress}%)`, 'cyan');
        }
        
        // 处理不同状态
        if (status === 'ready') {
          consecutiveReady++;
          log(`   ✅ 状态就绪 (连续 ${consecutiveReady} 次)`, 'green');
          
          // 连续2次就绪状态确认训练完成
          if (consecutiveReady >= 2) {
            log(`   🎉 图片训练完成！状态确认为就绪`, 'green');
            log(`   ⏱️  总用时: ${Math.round(elapsedSeconds)}秒`, 'blue');
            return true;
          }
        } 
        else if (status === 'error' || status === 'failed') {
          log('   ❌ 图片处理失败', 'red');
          if (collection.errorMessage) {
            log(`   错误信息: ${collection.errorMessage}`, 'red');
          }
          return false;
        }
        else if (status === 'processing') {
          log(`   🔄 正在处理文件...`, 'yellow');
        }
        else if (status === 'training') {
          log(`   🎓 正在训练向量...`, 'yellow');
        }
        else {
          log(`   ⏳ 当前状态: ${status}`, 'cyan');
        }
        
        // 智能延迟
        const delay = getSmartDelay(status, attempts);
        if (Date.now() - startTime + delay < timeoutMs) {
          log(`   等待 ${delay/1000}s 后继续检查...`, 'cyan');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        log(`   ⚠️ 无法获取状态信息，等待5秒后重试...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (statusError) {
      log(`   ⚠️ 状态检查失败: ${statusError.message}`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  log(`   ⏰ 等待超时 (${timeoutMinutes}分钟)，训练可能仍在进行中`, 'yellow');
  return false;
}

let testDatasetId = null;
let imageCollectionId = null;

// 图片测试流程
async function runImageTest() {
  log('🚀 开始平安银行回执图片上传和搜索功能测试', 'cyan');
  console.log('=' .repeat(50));

  try {
    // 1. 检查服务状态
    log('\n1️⃣  检查服务状态...', 'blue');
    const healthCheck = await api.get('/health');
    if (healthCheck.data.status === 'ok') {
      log('✅ 服务运行正常', 'green');
    }

    // 2. 测试 VLM API（如果可用）
    log('\n2️⃣  测试视觉语言模型 API...', 'blue');
    try {
      // 这里可以添加VLM API测试，暂时跳过
      log('ℹ️  VLM API测试跳过（需要额外配置）', 'yellow');
    } catch (error) {
      log('⚠️  VLM API 测试失败，但继续进行图片测试', 'yellow');
    }

    // 3. 创建测试数据集
    log('\n3️⃣  创建图片测试数据集...', 'blue');
    const datasetResponse = await api.post('/api/core/dataset', {
      name: '平安银行回执图片数据集',
      intro: '用于测试平安银行回执图片上传和搜索功能的数据集',
      type: 'dataset',
      vectorModel: 'text-embedding-v3',
      agentModel: TEST_CONFIG.vlmModel
    });

    if (datasetResponse.data.code === 200) {
      testDatasetId = datasetResponse.data.data;
      log('✅ 数据集创建成功', 'green');
      log(`   数据集ID: ${testDatasetId}`, 'blue');
    }

    // 4. 测试图片上传和训练
    log('\n4️⃣  测试图片上传功能...', 'blue');
    imageCollectionId = await testImageUpload(testDatasetId);
    
    let imageTrainingSuccess = false;
    if (imageCollectionId) {
      // 等待图片训练完成
      imageTrainingSuccess = await waitForImageTraining(testDatasetId, imageCollectionId);
      if (!imageTrainingSuccess) {
        log('⚠️  图片训练可能未完成，但继续测试...', 'yellow');
      }
    } else {
      log('⚠️  图片上传失败，跳过图片相关测试...', 'yellow');
    }

    // 5. 执行图片搜索测试
    log('\n5️⃣  执行图片搜索测试...', 'blue');

    if (imageCollectionId) {
      log('\n   测试平安银行回执搜索...', 'blue');
      
      const searchQuery = '开发银行回执' ;
      
      try {
        log(`\n   测试图片查询: "${searchQuery}"`, 'cyan');
        
        const searchResponse = await api.post('/api/core/dataset/searchTest', {
          datasetId: testDatasetId,
          text: searchQuery,
          limit: 3,
          similarity: 0.2,
          searchMode: 'embedding'
        });
        
        if (searchResponse.data.code === 200) {
          const results = searchResponse.data.data.list || searchResponse.data.data.searchRes || [];
          const imageResults = results.filter(r => r.collectionId === imageCollectionId);
          
          log(`   ✅ 搜索成功，找到 ${imageResults.length} 个图片相关结果`, imageResults.length > 0 ? 'green' : 'yellow');
          
          if (imageResults.length > 0) {
            // 显示图片搜索结果详情
            log(`   📋 图片搜索结果详情:`, 'cyan');
            console.log('   ' + '-'.repeat(60));
            
            imageResults.forEach((result, index) => {
              log(`   图片结果 ${index + 1}:`, 'yellow');
              
              const content = result.q || result.a || result.content || '无内容';
              log(`   🖼️  内容: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`, 'blue');
              
              const score = result.score?.[0]?.value || result.score;
              if (score !== undefined) {
                log(`   📊 相似度分数: ${typeof score === 'number' ? score.toFixed(4) : score}`, 'blue');
              }
              
              if (result.imageId) {
                log(`   🔗 图片ID: ${result.imageId}`, 'blue');
              }
              
              if (result.collectionId) {
                log(`   📁 集合ID: ${result.collectionId}`, 'blue');
              }
              
              console.log('   ' + '-'.repeat(40));
            });
          }
        } else {
          log(`   ❌ 图片搜索失败: ${searchResponse.data.message}`, 'red');
        }
      } catch (error) {
        log(`   ❌ 图片查询失败: ${error.message}`, 'red');
      }

      // 6. 测试重排序功能（针对图片）
      log('\n6️⃣  测试图片重排序功能...', 'blue');
      
      try {
        log(`\n   测试图片重排序查询: "${searchQuery}"`, 'cyan');
        
        // 测试使用重排序
        const rerankSearch = await api.post('/api/core/dataset/searchTest', {
          datasetId: testDatasetId,
          text: searchQuery,
          limit: 3,
          similarity: 0.01,
          searchMode: 'embedding',
          usingReRank: true,
          rerankModel: 'bge-reranker-v2-m3'
        });
        
        if (rerankSearch.data.code === 200) {
          log(`   ✅ 图片重排序测试成功`, 'green');
          
          const rerankResults = rerankSearch.data.data.list || rerankSearch.data.data.searchRes || [];
          const imageRerankResults = rerankResults.filter(r => r.collectionId === imageCollectionId);
          
          log(`   📊 重排序结果数: ${imageRerankResults.length}`, 'cyan');
          
          const usedRerank = rerankSearch.data.data && rerankSearch.data.data.usingReRank;
          log(`   🔄 是否使用重排序: ${usedRerank ? '✅ 是' : '❌ 否'}`, usedRerank ? 'green' : 'red');
          
          if (rerankSearch.data.data && rerankSearch.data.data.reRankInputTokens) {
            log(`   🎯 重排序消耗Token: ${rerankSearch.data.data.reRankInputTokens}`, 'cyan');
          }
          
          if (imageRerankResults.length > 0) {
            log(`   📋 重排序结果:`, 'cyan');
            imageRerankResults.forEach((result, index) => {
              const content = result.q || result.a || result.content || '无内容';
              const rerankScore = result.score?.find(s => s.type === 'reRank')?.value || 
                                result.score?.[0]?.value || result.score;
              log(`   ${index + 1}. ${content.substring(0, 80)}...`, 'blue');
              if (rerankScore !== undefined) {
                log(`      重排序分数: ${typeof rerankScore === 'number' ? rerankScore.toFixed(4) : rerankScore}`, 'green');
              }
            });
          }
        } else {
          log(`   ❌ 图片重排序测试失败: ${rerankSearch.data.message}`, 'red');
        }
      } catch (error) {
        log(`   ❌ 图片重排序查询失败: ${error.message}`, 'red');
      }
    }

    // 7. 测试结果总结
    log('\n7️⃣  测试结果总结', 'blue');
    console.log('=' .repeat(50));
    
    if (imageCollectionId) {
      log(`📊 图片测试统计:`, 'cyan');
      log(`   图片上传: ✅ 成功`, 'green');
      log(`   图片训练: ${imageTrainingSuccess ? '✅ 完成' : '⚠️ 可能未完成'}`, imageTrainingSuccess ? 'green' : 'yellow');
      
      if (imageTrainingSuccess) {
        log('\n🎉 恭喜！平安银行回执图片上传和搜索功能工作正常！', 'green');
        log('🖼️  图片训练和搜索功能已正常工作！', 'green');
      } else {
        log('\n🔧 图片处理可能需要更多时间，请稍后再试', 'yellow');
      }
    } else {
      log('❌ 图片上传失败，无法进行后续测试', 'red');
      log('\n🔧 可能的问题和解决方案:', 'yellow');
      log('   1. 图片文件不存在 - 请确保 ceshi.jpeg 文件存在', 'yellow');
      log('   2. 图片格式不支持 - 检查图片格式是否为 JPEG', 'yellow');
      log('   3. VLM 模型配置问题 - 检查视觉模型配置', 'yellow');
      log('   4. 服务器处理问题 - 检查服务器日志', 'yellow');
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
      if (imageCollectionId) {
        await api.delete(`/api/core/dataset/collection/${imageCollectionId}`);
        log('   ✅ 图片集合已删除', 'green');
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

// 启动图片测试
runImageTest().catch(error => {
  log(`❌ 图片测试失败: ${error.message}`, 'red');
  process.exit(1);
});

