# Dependencies cache stage
FROM node:22-alpine AS deps-cache

WORKDIR /app

# 设置环境变量以优化包管理器性能
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NPM_CONFIG_CACHE="/root/.npm"
ENV PNPM_STORE_DIR="/pnpm-store"

# if you located in China, you can use aliyun mirror to speed up
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install bash git dos2unix for TypeScript compiler
RUN apk add --no-cache bash git dos2unix

# if you located in China, you can use aliyun mirror to speed up
RUN npm config set registry https://registry.npmmirror.com

# Install pnpm and rush globally first (this layer rarely changes)
RUN npm install -g pnpm @microsoft/rush

# Initialize a git repository to avoid git-related errors during build
RUN git init && \
    git config user.email "docker@coze.com" && \
    git config user.name "Docker Build" && \
    touch .gitkeep && \
    git add . && \
    git commit -m "Initial commit for Docker build"

# Copy only dependency-related files first for better caching
COPY rush.json ./
COPY common/ ./common/
COPY scripts/ ./scripts/

# Convert line endings for shell scripts in scripts directory to Unix format
RUN find . -name "*.sh" -type f -exec dos2unix {} \;

# Copy all frontend files first to extract package.json files
COPY frontend/ ./frontend-temp/

# Create frontend directory and copy only package.json files for dependency caching
RUN mkdir -p ./frontend && \
    find ./frontend-temp -name "package.json" -exec sh -c 'mkdir -p "./frontend/$(dirname "$1" | sed "s|^\./frontend-temp/||")" && cp "$1" "./frontend/$(echo "$1" | sed "s|^\./frontend-temp/||")"' _ {} \; && \
    if [ -f ./frontend-temp/package-lock.json ]; then cp ./frontend-temp/package-lock.json ./frontend/; fi && \
    rm -rf ./frontend-temp

# Install dependencies with persistent caching
RUN --mount=type=cache,target=/pnpm-store,id=pnpm-store,sharing=locked \
    --mount=type=cache,target=/pnpm-cache,id=pnpm-cache,sharing=locked \
    --mount=type=cache,target=/root/.rush,id=rush-cache,sharing=locked \
    --mount=type=cache,target=/root/.npm,id=npm-cache,sharing=locked \
    --mount=type=cache,target=/app/common/temp,id=rush-temp-cache,sharing=locked \
    chmod +x scripts/hooks/post-rush-install.sh && \
    # Configure pnpm for better performance and persistent caching
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 3 && \
    # Set up pnpm store for persistent caching
    pnpm config set store-dir /pnpm-store && \
    pnpm config set cache-dir /pnpm-cache && \
    # Use rush install with persistent cache - with retry mechanism
    rush install || (echo "First rush install failed, retrying..." && rush install)

# Ensure TypeScript compiler and other build dependencies are available globally
RUN --mount=type=cache,target=/root/.npm,id=npm-cache \
    npm install -g typescript sucrase @types/node

# Build stage - inherits from deps-cache
FROM deps-cache AS builder

# Now copy all source code (this will not invalidate the dependency cache above)
COPY frontend/ ./frontend/

# Note: rush link is not needed when using workspaces

# Set environment variables to avoid warnings
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV CI=true

# Ensure node_modules/.bin is in PATH for local executables
ENV PATH="/app/node_modules/.bin:$PATH"

# Use rush build to build the specific project with verbose output and retry mechanism
RUN echo "Starting rush build..." && \
    rush build --to @coze-studio/app --verbose || \
    (echo "First build failed, cleaning and retrying..." && \
     rush purge && \
     rush update && \
     rush build --to @coze-studio/app --verbose)

# Production image stage
FROM nginx:1.25-alpine


# if you located in China, you can use aliyun mirror to speed up
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
# Install necessary tools for SSL configuration
RUN apk add --no-cache bash

# Copy build artifacts to nginx static directory
COPY --from=builder /app/frontend/apps/coze-studio/dist /usr/share/nginx/html

EXPOSE 8888

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
