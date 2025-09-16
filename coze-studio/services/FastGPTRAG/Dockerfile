# FastGPT RAG Service Dockerfile
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

# 复制源代码（先复制所有内容）
COPY . .

# 设置 npm 镜像源（如果在中国）
RUN npm config set registry https://registry.npmmirror.com

# 安装所有依赖（包括开发依赖用于构建）
RUN npm ci

# 构建应用
RUN npm run build

# 清理开发依赖，只保留生产依赖
RUN npm ci --only=production && npm cache clean --force

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 创建必要的目录并设置权限
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# 启动应用
CMD ["npm", "start"]
