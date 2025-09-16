/**
 * 2025世界人工智能大会全量演讲稿汇总 PDF文件上传和搜索功能测试
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
  enableParagraphOptimization: false,  // 是否启用段落AI优化（默认关闭以提升性能）
  agentModel: 'qwen-max',              // LLM模型（用于段落优化）
  chunkSize: 800,                      // PDF文档建议使用更大的分块大小
  showDetailedLogs: true               // 是否显示详细日志
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
  log('\n🔼 测试PDF文件上传功能...', 'blue');
  log(`   段落AI优化: ${TEST_CONFIG.enableParagraphOptimization ? '✅ 启用' : '❌ 关闭'}`, 
      TEST_CONFIG.enableParagraphOptimization ? 'green' : 'yellow');
  if (TEST_CONFIG.enableParagraphOptimization) {
    log(`   优化模型: ${TEST_CONFIG.agentModel}`, 'blue');
    log(`   ⚠️  注意：启用AI优化会增加处理时间和API调用成本`, 'yellow');
  }
  
  const filePath = path.join(process.cwd(), '2025世界人工智能大会全量演讲稿汇总.pdf');
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    log('❌ 文件 2025世界人工智能大会全量演讲稿汇总.pdf 不存在', 'red');
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
      name: '2025世界人工智能大会全量演讲稿汇总',
      type: 'file',
      chunkSize: TEST_CONFIG.chunkSize,
      chunkSplitter: '\\n\\n',
      trainingType: 'chunk',
      enableParagraphOptimization: TEST_CONFIG.enableParagraphOptimization,
      agentModel: TEST_CONFIG.agentModel
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

// 智能等待文件训练完成函数
async function waitForFileTraining(datasetId, collectionId, timeoutMinutes = 8) {
  log('\n⏳ 等待文件向量化训练完成...', 'blue');
  log('   PDF文件处理可能需要较长时间，使用智能等待策略...', 'yellow');
  
  const startTime = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let attempts = 0;
  let consecutiveReady = 0; // 连续就绪状态计数
  let lastStatus = '';
  let lastProgress = 0;
  
  // 智能延迟策略 - 针对文档处理优化
  const getSmartDelay = (status, attempt, hasProgress) => {
    if (status === 'processing' || status === 'training') {
      return hasProgress ? 8000 : 12000; // 有进度时8秒，无进度时12秒
    }
    if (status === 'ready' || status === 'trained') return 2000; // 就绪状态，2秒快速验证
    if (status === 'pending') return 10000; // 等待中，10秒
    return Math.min(6000 + attempt * 500, 15000); // 其他状态，渐进式延迟
  };
  
  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    const remainingMinutes = Math.round((timeoutMs - (Date.now() - startTime)) / 60000);
    
    log(`   第 ${attempts} 次检查 (已用时: ${elapsedSeconds}s, 剩余: ${remainingMinutes}min)`, 'cyan');
    
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
        let hasProgress = false;
        if (collection.trainingCount && collection.totalCount) {
          const progress = Math.round((collection.trainingCount / collection.totalCount) * 100);
          if (progress !== lastProgress) {
            log(`   📊 处理进度: ${collection.trainingCount}/${collection.totalCount} (${progress}%)`, 'cyan');
            lastProgress = progress;
          }
          hasProgress = true;
        }
        
        // 显示处理速度（如果状态是processing）
        if (status === 'processing' && hasProgress && attempts > 1) {
          const progressRate = lastProgress / elapsedSeconds;
          const estimatedTotal = lastProgress > 0 ? Math.round((100 - lastProgress) / progressRate) : 0;
          if (estimatedTotal > 0 && estimatedTotal < 600) { // 小于10分钟才显示预估
            log(`   ⏱️  预计还需: ${Math.round(estimatedTotal / 60)}分${estimatedTotal % 60}秒`, 'yellow');
          }
        }
        
        // 处理不同状态
        if (status === 'ready') {
          consecutiveReady++;
          log(`   ✅ 状态就绪 (连续 ${consecutiveReady} 次)`, 'green');
          
          // 连续2次就绪状态确认训练完成
          if (consecutiveReady >= 2) {
            log(`   🎉 文件训练完成！状态确认为就绪`, 'green');
            log(`   ⏱️  总用时: ${Math.round(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒`, 'blue');
            return true;
          }
        } 
        else if (status === 'error' || status === 'failed') {
          log('   ❌ 文件处理失败', 'red');
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
        const delay = getSmartDelay(status, attempts, hasProgress);
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
let fileCollectionId = null;

// 测试流程
async function runSimpleTest() {
  log('🚀 开始2025世界人工智能大会全量演讲稿汇总PDF文件上传和搜索功能测试', 'cyan');
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
      name: '2025世界人工智能大会演讲稿数据集',
      intro: '用于测试2025世界人工智能大会全量演讲稿汇总PDF文件上传和搜索功能的数据集',
      type: 'dataset',
      vectorModel: 'text-embedding-v3',
      agentModel: TEST_CONFIG.agentModel
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

    // 7. 测试人工智能大会相关内容搜索
    let fileSuccessCount = 0;
    let rerankSuccessCount = 0;
    if (fileCollectionId) {
      log('\n7️⃣  测试人工智能大会相关内容搜索...', 'blue');
      
      const fileSearchQueries = [
        '人工智能',
        '大模型',
        '机器学习',
        '深度学习',
        '算法创新',
        '量子',
        '机器人'
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
          
          // 调试：打印完整响应结构
          console.log('🔍 搜索响应调试:', JSON.stringify(searchResponse.data, null, 2));
          
          if (searchResponse.data.code === 200) {
            // 尝试多种可能的响应结构
            let results = [];
            if (searchResponse.data.data && searchResponse.data.data.searchRes) {
              results = searchResponse.data.data.searchRes;
            } else if (searchResponse.data.data && searchResponse.data.data.list) {
              results = searchResponse.data.data.list;
            } else if (searchResponse.data.searchRes) {
              results = searchResponse.data.searchRes;
            } else if (searchResponse.data.list) {
              results = searchResponse.data.list;
            } else if (Array.isArray(searchResponse.data.data)) {
              results = searchResponse.data.data;
            }
            
            log(`   📊 总搜索结果: ${results.length}`, 'cyan');
            const fileResults = results.filter(r => r.collectionId === fileCollectionId);
            
            log(`   ✅ 搜索成功，找到 ${fileResults.length} 个文件相关结果`, fileResults.length > 0 ? 'green' : 'yellow');
            
            if (fileResults.length > 0) {
              fileSuccessCount++;
              
              // 显示文件搜索结果详情
              log(`   📋 文件搜索结果详情:`, 'cyan');
              console.log('   ' + '-'.repeat(60));
              
              fileResults.forEach((result, index) => {
                log(`   文件结果 ${index + 1}:`, 'yellow');
                
                const content = result.q || result.a || result.content || '无内容';
                log(`   📄 内容: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`, 'blue');
                
                const score = result.score?.[0]?.value || result.score;
                if (score !== undefined) {
                  log(`   📊 相似度分数: ${typeof score === 'number' ? score.toFixed(4) : score}`, 'blue');
                }
                
                if (result.dataId) {
                  log(`   🔗 数据ID: ${result.dataId}`, 'blue');
                }
                
                if (result.collectionId) {
                  log(`   📁 集合ID: ${result.collectionId}`, 'blue');
                }
                
                console.log('   ' + '-'.repeat(40));
              });
            } else if (results.length > 0) {
              // 显示所有结果（不过滤集合ID）
              log(`   📋 所有搜索结果:`, 'cyan');
              results.slice(0, 3).forEach((result, index) => {
                const content = result.q || result.a || result.content || '无内容';
                const score = result.score?.[0]?.value || result.score;
                log(`   ${index + 1}. ${content.substring(0, 100)}...`, 'blue');
                log(`      集合ID: ${result.collectionId || '未知'}`, 'blue');
                if (score !== undefined) {
                  log(`      相似度: ${typeof score === 'number' ? score.toFixed(4) : score}`, 'blue');
                }
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
      
      // 8. 测试重排序功能
      log('\n8️⃣  测试重排序功能...', 'blue');
      
      const rerankQueries = [
        '量子',
        '机器人'
      ];
      
      for (const query of rerankQueries) {
        try {
          log(`\n   测试重排序查询: "${query}"`, 'cyan');
          
          // 先测试不使用重排序
          const normalSearch = await api.post('/api/core/dataset/searchTest', {
            datasetId: testDatasetId,
            text: query,
            limit: 5,
            similarity: 0.2,
            searchMode: 'embedding',
            usingReRank: false
          });
          
          // 再测试使用重排序（使用更低的相似度阈值适配重排序分数范围）
          const rerankSearch = await api.post('/api/core/dataset/searchTest', {
            datasetId: testDatasetId,
            text: query,
            limit: 5,
            similarity: 0.01,  // 重排序分数通常较低，使用0.01阈值
            searchMode: 'embedding',
            usingReRank: true,
            rerankModel: 'bge-reranker-v2-m3'
          });
          
          if (normalSearch.data.code === 200 && rerankSearch.data.code === 200) {
            rerankSuccessCount++;
            log(`   ✅ 重排序测试成功`, 'green');
            
            // 解析结果
            let normalResults = [];
            let rerankResults = [];
            
            // 解析普通搜索结果
            if (normalSearch.data.data && normalSearch.data.data.searchRes) {
              normalResults = normalSearch.data.data.searchRes;
            } else if (normalSearch.data.data && normalSearch.data.data.list) {
              normalResults = normalSearch.data.data.list;
            } else if (Array.isArray(normalSearch.data.data)) {
              normalResults = normalSearch.data.data;
            }
            
            // 解析重排序搜索结果
            if (rerankSearch.data.data && rerankSearch.data.data.searchRes) {
              rerankResults = rerankSearch.data.data.searchRes;
            } else if (rerankSearch.data.data && rerankSearch.data.data.list) {
              rerankResults = rerankSearch.data.data.list;
            } else if (Array.isArray(rerankSearch.data.data)) {
              rerankResults = rerankSearch.data.data;
            }
            
            log(`   📊 普通搜索结果数: ${normalResults.length}`, 'cyan');
            log(`   📊 重排序结果数: ${rerankResults.length}`, 'cyan');
            
            // 检查是否使用了重排序
            const usedRerank = rerankSearch.data.data && rerankSearch.data.data.usingReRank;
            log(`   🔄 是否使用重排序: ${usedRerank ? '✅ 是' : '❌ 否'}`, usedRerank ? 'green' : 'red');
            
            if (rerankSearch.data.data && rerankSearch.data.data.reRankInputTokens) {
              log(`   🎯 重排序消耗Token: ${rerankSearch.data.data.reRankInputTokens}`, 'cyan');
            }
            
            // 显示前2个结果的对比
            if (normalResults.length > 0 && rerankResults.length > 0) {
              log(`   📋 结果对比:`, 'cyan');
              console.log('   ' + '-'.repeat(60));
              
              for (let i = 0; i < Math.min(2, normalResults.length, rerankResults.length); i++) {
                const normalResult = normalResults[i];
                const rerankResult = rerankResults[i];
                
                log(`   结果 ${i + 1}:`, 'yellow');
                
                // 普通搜索结果
                const normalContent = normalResult.q || normalResult.a || normalResult.content || '无内容';
                const normalScore = normalResult.score?.[0]?.value || normalResult.score;
                log(`   📄 普通搜索: ${normalContent.substring(0, 80)}...`, 'blue');
                if (normalScore !== undefined) {
                  log(`      相似度: ${typeof normalScore === 'number' ? normalScore.toFixed(4) : normalScore}`, 'blue');
                }
                
                // 重排序结果
                const rerankContent = rerankResult.q || rerankResult.a || rerankResult.content || '无内容';
                const rerankScore = rerankResult.score?.find(s => s.type === 'reRank')?.value || 
                                  rerankResult.score?.[0]?.value || rerankResult.score;
                log(`   🎯 重排序后: ${rerankContent.substring(0, 80)}...`, 'green');
                if (rerankScore !== undefined) {
                  log(`      重排序分数: ${typeof rerankScore === 'number' ? rerankScore.toFixed(4) : rerankScore}`, 'green');
                }
                
                console.log('   ' + '-'.repeat(40));
              }
            }
          } else {
            log(`   ❌ 重排序测试失败`, 'red');
            if (normalSearch.data.code !== 200) {
              log(`      普通搜索失败: ${normalSearch.data.message}`, 'red');
            }
            if (rerankSearch.data.code !== 200) {
              log(`      重排序搜索失败: ${rerankSearch.data.message}`, 'red');
            }
          }
        } catch (error) {
          log(`   ❌ 重排序查询失败: ${error.message}`, 'red');
          if (error.response?.data) {
            console.log('   重排序错误详情:', error.response.data);
          }
        }
      }
      
      log(`\n📊 重排序测试统计:`, 'cyan');
      log(`   重排序查询总数: ${rerankQueries.length}`, 'blue');
      log(`   重排序成功查询: ${rerankSuccessCount}`, rerankSuccessCount > 0 ? 'green' : 'red');
      log(`   重排序成功率: ${((rerankSuccessCount / rerankQueries.length) * 100).toFixed(1)}%`, 
          rerankSuccessCount > 0 ? 'green' : 'red');
    }

    // 9. 测试结果总结
    log('\n9️⃣ 测试结果总结', 'blue');
    console.log('=' .repeat(50));
    
    if (fileCollectionId) {
      log(`📊 文件测试统计:`, 'cyan');
      log(`   文件上传: ✅ 成功`, 'green');
      log(`   文件训练: ${fileTrainingSuccess ? '✅ 完成' : '⚠️ 可能未完成'}`, fileTrainingSuccess ? 'green' : 'yellow');
      log(`   文件搜索: ${fileSuccessCount > 0 ? '✅ 可用' : '❌ 不可用'}`, fileSuccessCount > 0 ? 'green' : 'red');
      log(`   重排序功能: ${rerankSuccessCount > 0 ? '✅ 可用' : '❌ 不可用'}`, rerankSuccessCount > 0 ? 'green' : 'red');
      
      if (fileSuccessCount === 0 && rerankSuccessCount === 0) {
        log('\n🔧 可能的问题和解决方案:', 'yellow');
        log('   1. PDF文件上传失败 - 检查文件格式和大小', 'yellow');
        log('   2. PDF文件解析失败 - 检查文件内容是否损坏', 'yellow');
        log('   3. 向量化失败 - 检查 Embedding API 配置', 'yellow');
        log('   4. 训练进程问题 - 检查服务器日志', 'yellow');
        log('   5. 人工智能大会内容识别失败 - 检查PDF文本提取是否正确', 'yellow');
        log('   6. 重排序服务配置问题 - 检查硅基流动API配置', 'yellow');
      } else {
        log('\n🎉 恭喜！2025世界人工智能大会演讲稿PDF上传和搜索功能工作正常！', 'green');
        if (rerankSuccessCount > 0) {
          log('🎯 重排序功能也已正常工作，搜索结果质量将更优！', 'green');
        }
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

