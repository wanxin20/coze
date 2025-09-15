# 如何运行 rag_dataset_id 数据库迁移

## 📋 概述

本文档说明如何在 Coze Studio 的 Docker 环境中运行 `rag_dataset_id` 字段的数据库迁移。

## 🗂️ 迁移文件位置

已创建的迁移文件：
```
/home/wankai/coze/coze-studio/docker/atlas/migrations/20250911111921_add_rag_dataset_id.sql
```

## 🚀 执行步骤

### 1. 启动 Docker 环境
```bash
cd /home/wankai/coze/coze-studio
docker-compose up -d mysql
```

### 2. 等待 MySQL 容器完全启动
```bash
# 检查容器状态
docker ps | grep coze-mysql

# 查看日志确保启动完成
docker logs coze-mysql | tail -20
```

### 3. 执行迁移（三种方法任选其一）

#### 方法一：使用 Atlas CLI（推荐）
```bash
cd /home/wankai/coze/coze-studio/docker/atlas

# 设置数据库连接
export ATLAS_URL="mysql://coze:coze123@localhost:3306/opencoze?charset=utf8mb4&parseTime=True"

# 检查当前迁移状态
atlas migrate status --url $ATLAS_URL --dir "file://migrations"

# 应用迁移
atlas migrate apply --url $ATLAS_URL --dir "file://migrations" --baseline "20250703095335"

# 更新 atlas.sum 文件
atlas migrate hash --dir "file://migrations"
```

#### 方法二：直接在 MySQL 容器中执行
```bash
# 连接到 MySQL 容器
docker exec -it coze-mysql mysql -u coze -pcoze123 opencoze

# 在 MySQL 控制台中执行以下 SQL：
```
```sql
-- 添加 rag_dataset_id 字段
ALTER TABLE `knowledge` ADD COLUMN `rag_dataset_id` varchar(255) NULL COMMENT 'FastGPTRAG Dataset ID for unified management';

-- 创建索引
CREATE INDEX `idx_knowledge_rag_dataset_id` ON `knowledge` (`rag_dataset_id`);

-- 验证字段添加成功
DESCRIBE knowledge;

-- 退出
EXIT;
```

#### 方法三：使用 Docker exec 执行 SQL 文件
```bash
# 复制 SQL 文件到容器
docker cp /home/wankai/coze/coze-studio/docker/atlas/migrations/20250911111921_add_rag_dataset_id.sql coze-mysql:/tmp/

# 执行 SQL 文件
docker exec -i coze-mysql mysql -u coze -pcoze123 opencoze -e "
ALTER TABLE knowledge ADD COLUMN rag_dataset_id varchar(255) NULL COMMENT 'FastGPTRAG Dataset ID for unified management';
CREATE INDEX idx_knowledge_rag_dataset_id ON knowledge (rag_dataset_id);
"
```

### 4. 验证迁移结果
```bash
# 连接数据库验证
docker exec -it coze-mysql mysql -u coze -pcoze123 opencoze -e "
DESCRIBE knowledge;
SHOW INDEX FROM knowledge WHERE Key_name = 'idx_knowledge_rag_dataset_id';
"
```

期望的输出应该包含：
```
| rag_dataset_id | varchar(255) | YES  |     | NULL    | FastGPTRAG Dataset ID for unified management |
```

### 5. 更新最新数据库模式（Atlas 环境）
```bash
cd /home/wankai/coze/coze-studio/docker/atlas

# 更新最新模式文件
atlas schema inspect -u $ATLAS_URL --exclude "atlas_schema_revisions,table_*" > opencoze_latest_schema.hcl
```

## 🔍 验证测试

### 测试字段功能
```sql
-- 连接数据库
docker exec -it coze-mysql mysql -u coze -pcoze123 opencoze

-- 测试插入数据
INSERT INTO knowledge (id, name, app_id, creator_id, space_id, created_at, updated_at, status, format_type, rag_dataset_id) 
VALUES (999999, 'Test FastGPT Knowledge', 1, 1, 1, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000, 1, 0, 'fastgpt-dataset-123');

-- 测试查询
SELECT id, name, rag_dataset_id FROM knowledge WHERE rag_dataset_id IS NOT NULL;

-- 测试索引查询
EXPLAIN SELECT * FROM knowledge WHERE rag_dataset_id = 'fastgpt-dataset-123';

-- 清理测试数据
DELETE FROM knowledge WHERE id = 999999;
```

## 🔧 故障排除

### 1. 连接失败
```bash
# 检查容器状态
docker ps | grep mysql

# 检查端口映射
docker port coze-mysql

# 重启容器
docker-compose restart mysql
```

### 2. 字段已存在错误
```sql
-- 检查字段是否已存在
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'opencoze' 
  AND TABLE_NAME = 'knowledge' 
  AND COLUMN_NAME = 'rag_dataset_id';
```

### 3. 权限问题
```bash
# 使用 root 用户连接
docker exec -it coze-mysql mysql -u root -proot opencoze
```

## 🔄 回滚方案

如果需要回滚迁移：
```sql
-- 连接数据库
docker exec -it coze-mysql mysql -u coze -pcoze123 opencoze

-- 删除索引
DROP INDEX `idx_knowledge_rag_dataset_id` ON `knowledge`;

-- 删除字段
ALTER TABLE `knowledge` DROP COLUMN `rag_dataset_id`;
```

## 📝 执行检查清单

- [ ] Docker 环境已启动
- [ ] MySQL 容器运行正常
- [ ] 迁移文件存在且格式正确
- [ ] 迁移执行成功无错误
- [ ] 字段添加验证成功
- [ ] 索引创建验证成功
- [ ] 测试数据插入查询正常
- [ ] 应用程序启动正常

## 🎯 完成标志

当您看到以下输出时，表示迁移成功：

1. **字段存在**：`DESCRIBE knowledge` 显示 `rag_dataset_id` 字段
2. **索引存在**：`SHOW INDEX FROM knowledge` 显示相应索引
3. **功能正常**：可以正常插入和查询包含 `rag_dataset_id` 的数据

## 📞 需要帮助？

如果遇到问题，请检查：
1. Docker 容器日志：`docker logs coze-mysql`
2. 数据库连接：确认用户名密码正确
3. 权限问题：尝试使用 root 用户
4. 文件路径：确认迁移文件路径正确

执行成功后，您就可以使用新的 FastGPTRAG 统一管理功能了！
