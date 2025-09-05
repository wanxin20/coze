# FastGPT RAG 测试套件

这是一个完整的 FastGPT RAG API 测试套件，包含前端可视化测试界面、API测试脚本和示例文档。

## 🚀 快速开始

### 1. 确保服务运行

首先确保你的 FastGPT RAG 服务正在运行：

```bash
cd FastGPTRAG
npm start
# 服务应该在 http://localhost:3001 启动
```

### 2. 运行测试

```bash
# 进入测试目录
cd test

# 运行完整API测试
npm run test

# 或者运行不同类型的测试
npm run test api           # API功能测试
npm run test comprehensive # 综合测试
npm run test simple        # 简单测试
npm run test frontend      # 启动前端测试页面
```

### 3. 前端可视化测试

启动前端测试界面：

```bash
npm run test frontend
```

然后在浏览器中访问 `http://localhost:8080`

## 📁 文件结构

```
test/
├── README.md                    # 测试说明文档（本文件）
├── run-tests.js                 # 测试启动器
├── frontend-test.html           # 前端可视化测试界面
├── api.test.js                  # 完整API功能测试
├── comprehensive-test.js        # 综合性能测试
├── simple-test.js               # 简单快速测试
├── sample-documents/            # 示例测试文档
│   ├── sample.txt              # 文本示例文档
│   ├── api-guide.md            # API指南文档
│   └── test-document.txt       # 基础测试文档
└── temp-docs/                  # 临时测试文档（自动生成和清理）
```

## 🧪 测试类型

### 1. API功能测试 (`api.test.js`)

完整的API功能测试，包括：
- ✅ 系统健康检查
- ✅ 知识库CRUD操作
- ✅ 集合管理（文本、文件上传）
- ✅ 数据管理（增删改查）
- ✅ 搜索功能（向量、混合、高级搜索）
- ✅ 文件上传和处理
- ✅ 监控功能
- ✅ 性能测试
- ✅ 错误处理测试

**运行方式：**
```bash
npm run test api
# 或
node test/api.test.js
```

### 2. 综合测试 (`comprehensive-test.js`)

深入的综合性测试，包含：
- 📚 全面的知识库管理测试
- 📁 多种集合类型测试
- 📝 数据管理和批量操作
- 🔍 多种搜索模式验证
- ⚡ 并发性能压力测试
- 🚫 边界条件和错误处理
- 📊 详细的测试报告生成

**运行方式：**
```bash
npm run test comprehensive
# 或
node test/comprehensive-test.js
```

### 3. 简单测试 (`simple-test.js`)

快速验证基本功能：
- 🔍 健康检查
- 📚 基础知识库操作
- 🔍 简单搜索测试

**运行方式：**
```bash
npm run test simple
# 或
node test/simple-test.js
```

### 4. 前端可视化测试 (`frontend-test.html`)

图形化测试界面，支持：
- 🎛️ 可视化API配置
- 📊 实时操作和结果显示
- 📤 拖拽文件上传
- 🔍 交互式搜索测试
- 📈 操作日志和错误提示
- 📱 响应式设计，支持移动端

**运行方式：**
```bash
npm run test frontend
# 然后访问 http://localhost:8080
```

## 🔧 配置说明

### API配置

所有测试脚本使用以下默认配置：

```javascript
const config = {
  baseURL: 'http://localhost:3001',     // API服务地址
  teamId: '507f1f77bcf86cd799439011',   // 团队ID
  userId: '507f1f77bcf86cd799439012',   // 用户ID
  timeout: 30000                        // 请求超时时间
};
```

### 环境变量

你可以通过环境变量覆盖默认配置：

```bash
export FASTGPT_API_URL=http://localhost:3001
export FASTGPT_TEAM_ID=your-team-id
export FASTGPT_USER_ID=your-user-id
```

## 📊 测试流程

### 完整测试流程

1. **健康检查** - 验证服务状态
2. **知识库管理** - 创建、查询、更新知识库
3. **集合管理** - 创建文本和文件集合
4. **数据管理** - 添加、更新、删除数据
5. **搜索测试** - 验证各种搜索功能
6. **文件上传** - 测试文档处理能力
7. **性能测试** - 并发和响应时间测试
8. **错误处理** - 边界条件和异常测试
9. **数据清理** - 清理测试数据

### 前端测试流程

1. **配置API连接** - 设置服务地址和认证信息
2. **测试连接** - 验证API可达性
3. **选择功能模块** - 知识库、集合、数据、搜索
4. **执行操作** - 通过可视化界面操作
5. **查看结果** - 实时查看操作结果和日志

## 🎯 使用场景

### 开发调试

```bash
# 快速验证功能
npm run test simple

# 启动可视化界面进行调试
npm run test frontend
```

### 功能验证

```bash
# 完整功能测试
npm run test api
```

### 性能测试

```bash
# 综合性能和压力测试
npm run test comprehensive
```

### 集成测试

```bash
# 在CI/CD流水线中运行
npm run test api
```

## 📝 测试数据

### 自动生成的测试数据

测试脚本会自动创建以下测试数据：
- 测试知识库
- 文本集合和文件集合
- 问答对数据
- 测试文档

### 示例文档

`sample-documents/` 目录包含：
- `sample.txt` - FastGPT系统介绍文档
- `api-guide.md` - API使用指南
- `test-document.txt` - 基础测试文档

### 数据清理

所有测试都会在完成后自动清理测试数据，包括：
- 删除创建的知识库
- 删除集合和数据
- 清理临时文件

## 🔍 故障排除

### 常见问题

**Q: 测试连接失败？**
```
A: 1. 检查服务是否在 http://localhost:3001 运行
   2. 确认防火墙没有阻止连接
   3. 检查服务日志是否有错误
```

**Q: 文件上传失败？**
```
A: 1. 检查文件大小限制
   2. 确认文件格式支持
   3. 检查服务器磁盘空间
```

**Q: 搜索结果为空？**
```
A: 1. 确认数据已完成向量化训练
   2. 调整相似度阈值
   3. 检查搜索关键词
```

**Q: 前端页面无法访问？**
```
A: 1. 确认前端服务已启动
   2. 检查端口8080是否被占用
   3. 尝试清除浏览器缓存
```

### 调试技巧

1. **查看详细日志**
   ```bash
   DEBUG=* npm run test api
   ```

2. **使用单个测试**
   ```javascript
   // 在测试文件中注释掉其他测试，只运行特定功能
   ```

3. **手动测试**
   ```bash
   # 使用curl测试单个接口
   curl -X GET http://localhost:3001/health
   ```

## 📈 测试报告

### 控制台输出

测试会在控制台输出详细的执行过程：
- ✅ 成功操作（绿色）
- ❌ 失败操作（红色）
- ⚠️ 警告信息（黄色）
- ℹ️ 信息提示（蓝色）

### 测试统计

comprehensive-test.js 会生成详细的测试报告：
```
📋 测试报告
==================================================
📅 测试时间: 2024-01-01 12:00:00
⏱️ 总耗时: 45.2 秒
📊 知识库数量: 1
📊 集合数量: 2
📊 数据条数: 8
📊 搜索结果: 5 条
📄 测试文件: 2 个
==================================================
```

### 性能指标

- 响应时间统计
- 并发请求成功率
- 资源使用情况
- 错误率分析

## 🛠️ 扩展测试

### 添加新的测试用例

1. **在现有文件中添加**
   ```javascript
   // 在 api.test.js 中添加新的测试函数
   async function testNewFeature() {
     log('测试新功能...', 'blue');
     // 测试逻辑
   }
   ```

2. **创建新的测试文件**
   ```javascript
   // test/feature-test.js
   import { testData, config } from './api.test.js';
   // 新的测试逻辑
   ```

3. **更新启动器**
   ```javascript
   // 在 run-tests.js 中添加新的测试类型
   case 'feature':
     await runTest(path.join(__dirname, 'feature-test.js'));
     break;
   ```

### 自定义配置

创建 `test/config.local.js` 文件：
```javascript
export const localConfig = {
  baseURL: 'http://your-server:3001',
  teamId: 'your-team-id',
  userId: 'your-user-id',
  // 其他自定义配置
};
```

## 🤝 贡献指南

### 提交测试用例

1. Fork项目
2. 创建功能分支
3. 添加测试用例
4. 提交Pull Request

### 报告Bug

1. 在GitHub Issues中报告
2. 提供详细的错误信息
3. 包含复现步骤
4. 附加相关日志

## 📞 技术支持

如果你在使用测试套件时遇到问题：

1. 查看本文档的故障排除部分
2. 检查项目的GitHub Issues
3. 提交新的Issue描述问题

---

**快乐测试！** 🎉
