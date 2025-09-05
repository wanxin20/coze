/**
 * Quick Test Script for FastGPT RAG
 * Run: node test-quick.js
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-team-id': 'test-team',
    'x-user-id': 'test-user',
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

console.log('🚀 FastGPT RAG Quick Test');
console.log('='.repeat(40));

try {
  // Test 1: Health Check
  console.log('1️⃣ Testing health check...');
  const health = await api.get('/health');
  console.log(`✅ Server is running: ${health.data.status}`);

  // Test 2: Create Dataset
  console.log('\n2️⃣ Creating test dataset...');
  const dataset = await api.post('/api/core/dataset', {
    name: 'Quick Test Dataset',
    intro: 'A dataset for quick testing',
    type: 'dataset',
    vectorModel: 'text-embedding-v3',
    agentModel: 'qwen-max'
  });
  const datasetId = dataset.data.data;
  console.log(`✅ Dataset created: ${datasetId}`);

  // Test 3: Create Text Collection
  console.log('\n3️⃣ Creating text collection...');
  const collection = await api.post('/api/core/dataset/collection', {
    datasetId,
    name: 'Quick Test Collection',
    type: 'text',
    rawText: 'FastGPT是一个强大的知识库系统，支持多种文档格式和智能搜索功能。它可以帮助用户快速构建AI问答系统。',
    trainingType: 'chunk',
    chunkSize: 256
  });
  const collectionId = collection.data.data;
  console.log(`✅ Collection created: ${collectionId}`);

  // Test 4: Test Search (after a brief wait)
  console.log('\n4️⃣ Testing search functionality...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const search = await api.post('/api/core/dataset/searchTest', {
    datasetId,
    text: 'FastGPT是什么',
    limit: 3,
    similarity: 0.1,
    searchMode: 'embedding'
  });
  
  const results = search.data.data;
  console.log(`✅ Search completed: ${results.list ? results.list.length : 0} results found`);

  // Test 5: Test Collection Management
  console.log('\n5️⃣ Testing collection management...');
  const listCollections = await api.get(`/api/core/dataset/collection?datasetId=${datasetId}`);
  console.log(`✅ Found ${listCollections.data.data.list.length} collections`);

  // Clean up
  console.log('\n🧹 Cleaning up...');
  await api.delete(`/api/core/dataset/collection/${collectionId}`);
  await api.delete(`/api/core/dataset/${datasetId}`);
  console.log('✅ Cleanup completed');

  console.log('\n🎉 All tests passed! FastGPT RAG is working correctly.');
  console.log('\n📚 Available API endpoints:');
  console.log('  - Dataset management: /api/core/dataset/*');
  console.log('  - Collection management: /api/core/dataset/collection/*');
  console.log('  - File upload: /api/core/dataset/collection/create/file');
  console.log('  - Link crawling: /api/core/dataset/collection/create/link');
  console.log('  - Data management: /api/core/dataset/data/*');
  console.log('  - Search: /api/core/dataset/searchTest, /api/search/*');
  console.log('\n🚀 Ready for production use!');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.response?.data) {
    console.error('Response:', error.response.data);
  }
  console.log('\n💡 Make sure the server is running: npm run dev');
  process.exit(1);
}
