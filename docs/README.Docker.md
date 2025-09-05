# 前端 Docker 开发指南

## 环境配置

现在项目支持两种前端Docker环境：

### 1. 生产环境 (Production)
- **用途**: 生产部署
- **特点**: 静态文件构建，nginx服务，优化性能
- **Dockerfile**: `frontend/Dockerfile`
- **服务名**: `coze-web`

### 2. 开发环境 (Development) 
- **用途**: 本地开发
- **特点**: 热重载，源码挂载，开发服务器
- **Dockerfile**: `frontend/Dockerfile.dev`
- **服务名**: `coze-web-dev`

## 使用方法

### 启动开发环境

```bash
# 进入docker目录
cd coze-studio/docker

# 启动开发环境（包括后端服务）
docker-compose --profile development up

# 或者只启动前端开发环境
docker-compose up coze-web-dev

# 构建并启动开发环境
docker-compose up --build coze-web-dev
```

### 启动生产环境

```bash
# 启动生产环境
docker-compose --profile production up

# 或者只启动前端生产环境
docker-compose up coze-web

# 构建并启动生产环境
docker-compose up --build coze-web
```

## 端口配置

### 开发环境
- **前端开发服务器**: `http://localhost:3001` (可通过 `DEV_WEB_PORT` 环境变量修改)
- **热重载端口**: `8080` (可通过 `DEV_HMR_PORT` 环境变量修改)

### 生产环境
- **前端服务**: `http://localhost:3000` (可通过 `WEB_LISTEN_ADDR` 环境变量修改)

## 开发环境特性

### ✅ 热重载
- 代码修改后自动刷新浏览器
- 支持CSS热替换
- 支持React Fast Refresh

### ✅ 源码挂载
- 本地源码直接挂载到容器
- 无需重新构建镜像
- 支持实时代码编辑

### ✅ 依赖缓存
- 持久化 pnpm 缓存
- 持久化 rush 缓存
- 容器重启不会重新下载依赖

### ✅ 开发工具
- 支持调试工具
- 详细的错误信息
- 开发友好的环境变量

## 环境变量配置

在 `docker/.env` 文件中配置以下变量：

```bash
# 前端端口配置
WEB_LISTEN_ADDR=3000      # 生产环境端口
DEV_WEB_PORT=3001         # 开发环境端口
DEV_HMR_PORT=8080         # 热重载端口
```

## 缓存管理

### 查看缓存卷
```bash
docker volume ls | grep coze-web
```

### 清理开发环境缓存
```bash
docker volume rm coze-studio_coze-web-dev-pnpm-store
docker volume rm coze-studio_coze-web-dev-pnpm-cache
docker volume rm coze-studio_coze-web-dev-rush-cache
docker volume rm coze-studio_coze-web-dev-npm-cache
docker volume rm coze-studio_coze-web-dev-rush-temp
```

### 清理生产环境缓存
```bash
docker volume rm coze-studio_coze-web-pnpm-store
docker volume rm coze-studio_coze-web-pnpm-cache
docker volume rm coze-studio_coze-web-rush-cache
docker volume rm coze-studio_coze-web-npm-cache
docker volume rm coze-studio_coze-web-rush-temp
```

## 故障排除

### 1. 端口冲突
如果端口被占用，修改 `.env` 文件中的端口配置。

### 2. 热重载不工作
确保以下环境变量已设置：
```bash
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
FAST_REFRESH=true
```

### 3. 依赖安装失败
清理缓存卷并重新构建：
```bash
docker-compose down
docker volume prune
docker-compose up --build coze-web-dev
```

### 4. 文件权限问题
如果遇到文件权限问题，可以调整文件权限：
```bash
chmod -R 755 frontend/
```

## 开发工作流

1. **首次启动**:
   ```bash
   cd coze-studio/docker
   docker-compose up --build coze-web-dev
   ```

2. **日常开发**:
   ```bash
   docker-compose up coze-web-dev
   ```
   然后直接编辑源码，浏览器会自动刷新。

3. **添加依赖**:
   需要重新构建容器：
   ```bash
   docker-compose up --build coze-web-dev
   ```

4. **切换到生产环境测试**:
   ```bash
   docker-compose down
   docker-compose up --build coze-web
   ```

## 最佳实践

1. **使用开发环境进行日常开发**
2. **定期测试生产环境构建**
3. **保持依赖缓存以提高构建速度**
4. **使用环境变量管理不同环境的配置**
