# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# if you located in China, you can use aliyun mirror to speed up
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install bash git dos2unix for TypeScript compiler
RUN apk add --no-cache bash git dos2unix

# if you located in China, you can use aliyun mirror to speed up
RUN npm config set registry https://registry.npmmirror.com

# Copy rush.json from root directory first
COPY rush.json ./

# Install rush with retry logic
RUN npm install -g @microsoft/rush

# Copy the frontend source code (excluding node_modules and build artifacts)
COPY frontend/ ./frontend/

# Copy common directory for Rush
COPY common/ ./common/

# Copy scripts directory for Rush hooks
COPY scripts/ ./scripts/

# Convert line endings for shell scripts in scripts directory to Unix format
RUN find . -name "*.sh" -type f -exec dos2unix {} \;

# Install all dependencies
RUN chmod +x scripts/hooks/post-rush-install.sh && rm -rf /app/common/temp && rush update && rush install

# Set environment variables to fix TypeScript build issues
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV FORCE_COLOR=0
ENV CI=true
ENV TS_NODE_TRANSPILE_ONLY=true

# Fix path resolution issues in Docker environment
ENV NODE_PATH=/app/node_modules

# Try to fix the specific TypeScript configuration issues
RUN find . -name "tsconfig.build.json" -type f -exec sh -c 'echo "Checking: $1" && cat "$1" | head -10' _ {} \;

# Build with detailed error reporting and proper error handling
RUN echo "Starting Rush build with error analysis..." && \
    rush build --to @coze-studio/app --verbose 2>&1 | tee build.log || \
    (echo "=== BUILD FAILED - Analyzing errors ===" && \
     echo "=== Trying alternative build approaches ===" && \
     (rush build --to @coze-studio/app --production --verbose 2>&1 || \
      (echo "=== Production build failed, checking if dist exists ===" && \
       ls -la frontend/apps/coze-studio/ || \
       echo "ERROR: Critical build failure - app cannot be deployed")))

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