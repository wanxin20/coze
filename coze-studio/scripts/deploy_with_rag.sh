#!/bin/bash

# Coze Studio with FastGPTRAG Integration Deployment Script
# 部署Coze Studio并集成FastGPTRAG微服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_step "检查系统依赖..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Git
    if ! command -v git &> /dev/null; then
        log_error "Git未安装，请先安装Git"
        exit 1
    fi
    
    log_info "系统依赖检查通过"
}

# 初始化环境配置
init_environment() {
    log_step "初始化环境配置..."
    
    cd docker
    
    # 复制环境变量配置文件
    if [ ! -f .env.rag ]; then
        if [ -f env.rag.example ]; then
            cp env.rag.example .env.rag
            log_info "已创建RAG环境配置文件 .env.rag"
        else
            log_error "找不到环境配置模板文件 env.rag.example"
            exit 1
        fi
    fi
    
    # 检查主环境配置
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log_info "已创建主环境配置文件 .env"
        else
            log_warn "找不到主环境配置模板文件，请手动创建 .env"
        fi
    fi
    
    cd ..
}

# 生成随机密钥
generate_secrets() {
    log_step "生成安全密钥..."
    
    # 生成RAG认证令牌
    RAG_AUTH_TOKEN=$(openssl rand -hex 32)
    RAG_JWT_SECRET=$(openssl rand -hex 32)
    RAG_ENCRYPT_KEY=$(openssl rand -hex 32)
    
    # 生成数据库密码
    RAG_MONGO_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    RAG_REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    RAG_POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # 更新环境配置文件
    cd docker
    sed -i.bak "s/your-rag-auth-token-here/${RAG_AUTH_TOKEN}/g" .env.rag
    sed -i.bak "s/your-rag-jwt-secret-here/${RAG_JWT_SECRET}/g" .env.rag
    sed -i.bak "s/your-rag-encrypt-key-here/${RAG_ENCRYPT_KEY}/g" .env.rag
    sed -i.bak "s/your-mongo-password-here/${RAG_MONGO_PASSWORD}/g" .env.rag
    sed -i.bak "s/your-redis-password-here/${RAG_REDIS_PASSWORD}/g" .env.rag
    sed -i.bak "s/your-postgres-password-here/${RAG_POSTGRES_PASSWORD}/g" .env.rag
    
    # 删除备份文件
    rm -f .env.rag.bak
    
    cd ..
    
    log_info "安全密钥已生成并配置"
}

# 构建服务
build_services() {
    log_step "构建服务镜像..."
    
    cd docker
    
    # 注意：Coze服务使用预构建镜像，无需本地构建
    log_info "Coze服务使用预构建镜像，跳过构建步骤"
    
    # 构建FastGPTRAG服务
    log_info "构建FastGPTRAG服务..."
    docker-compose --env-file .env.rag -f docker-compose.rag.yml build fastgpt-rag
    
    cd ..
    
    log_info "服务镜像构建完成"
}

# 启动数据库服务
start_databases() {
    log_step "启动数据库服务..."
    
    cd docker
    
    # 启动RAG数据库服务
    log_info "启动RAG数据库服务..."
    docker-compose --env-file .env.rag -f docker-compose.rag.yml up -d rag-mongo rag-redis rag-postgres
    
    # 启动主数据库服务
    log_info "启动主数据库服务..."
    docker-compose up -d mysql redis
    
    # 等待数据库服务就绪
    log_info "等待数据库服务启动..."
    sleep 30
    
    cd ..
    
    log_info "数据库服务已启动"
}

# 初始化数据库
init_databases() {
    log_step "初始化数据库..."
    
    cd docker
    
    # 检查RAG数据库连接
    log_info "检查RAG数据库连接..."
    
    # 等待MongoDB就绪
    timeout=60
    while ! docker-compose --env-file .env.rag -f docker-compose.rag.yml exec -T rag-mongo mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "MongoDB启动超时"
            exit 1
        fi
        sleep 1
    done
    log_info "MongoDB已就绪"
    
    # 等待PostgreSQL就绪
    timeout=60
    while ! docker-compose --env-file .env.rag -f docker-compose.rag.yml exec -T rag-postgres pg_isready -U postgres -d coze_rag &> /dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "PostgreSQL启动超时"
            exit 1
        fi
        sleep 1
    done
    log_info "PostgreSQL已就绪"
    
    # 等待Redis就绪
    timeout=60
    while ! docker-compose --env-file .env.rag -f docker-compose.rag.yml exec -T rag-redis redis-cli ping &> /dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "Redis启动超时"
            exit 1
        fi
        sleep 1
    done
    log_info "Redis已就绪"
    
    cd ..
    
    log_info "数据库初始化完成"
}

# 启动应用服务
start_applications() {
    log_step "启动应用服务..."
    
    cd docker
    
    # 启动FastGPTRAG服务
    log_info "启动FastGPTRAG服务..."
    docker-compose --env-file .env.rag -f docker-compose.rag.yml up -d fastgpt-rag
    
    # 等待RAG服务就绪
    log_info "等待FastGPTRAG服务启动..."
    timeout=120
    while ! curl -f http://localhost:3001/health &> /dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            log_error "FastGPTRAG服务启动超时"
            exit 1
        fi
        sleep 1
    done
    log_info "FastGPTRAG服务已就绪"
    
    # 启动Coze后端服务
    log_info "启动Coze后端服务..."
    docker-compose up -d coze-server
    
    # 启动前端服务
    log_info "启动Coze前端服务..."
    docker-compose up -d coze-web
    
    cd ..
    
    log_info "应用服务已启动"
}

# 健康检查
health_check() {
    log_step "执行健康检查..."
    
    # 检查服务状态
    log_info "检查服务状态..."
    
    cd docker
    
    # 检查RAG服务
    if curl -f http://localhost:3001/health &> /dev/null; then
        log_info "✓ FastGPTRAG服务运行正常"
    else
        log_error "✗ FastGPTRAG服务异常"
    fi
    
    # 检查Coze后端
    if curl -f http://localhost:8888/health &> /dev/null; then
        log_info "✓ Coze后端服务运行正常"
    else
        log_warn "✗ Coze后端服务可能未就绪"
    fi
    
    # 检查前端
    if curl -f http://localhost:8888 &> /dev/null; then
        log_info "✓ Coze前端服务运行正常"
    else
        log_warn "✗ Coze前端服务可能未就绪"
    fi
    
    # 显示服务状态
    log_info "Docker服务状态："
    docker-compose ps
    docker-compose --env-file .env.rag -f docker-compose.rag.yml ps
    
    cd ..
}

# 显示部署信息
show_deployment_info() {
    log_step "部署完成！"
    
    echo ""
    log_info "=== 服务访问地址 ==="
    log_info "Coze Studio前端: http://localhost:8888"
    log_info "Coze Studio后端: http://localhost:8888"
    log_info "FastGPTRAG服务: http://localhost:3001"
    log_info "FastGPTRAG健康检查: http://localhost:3001/health"
    
    echo ""
    log_info "=== RAG API接口示例 ==="
    log_info "搜索接口: POST http://localhost:8888/api/knowledge/rag/search"
    log_info "深度搜索: POST http://localhost:8888/api/knowledge/rag/search/deep"
    log_info "健康检查: GET http://localhost:8888/api/knowledge/rag/health"
    log_info "使用统计: GET http://localhost:8888/api/knowledge/rag/usage"
    
    echo ""
    log_info "=== 数据库连接信息 ==="
    log_info "RAG MongoDB: mongodb://localhost:27018/coze-rag"
    log_info "RAG Redis: redis://localhost:6380"
    log_info "RAG PostgreSQL: postgresql://postgres:***@localhost:5433/coze_rag"
    
    echo ""
    log_info "=== 日志查看命令 ==="
    log_info "查看FastGPTRAG日志: docker-compose -f docker/docker-compose.rag.yml logs -f FastGPTRAG"
    log_info "查看Coze后端日志: docker-compose -f docker/docker-compose.yml logs -f coze-server"
    log_info "查看所有服务日志: docker-compose -f docker/docker-compose.yml -f docker/docker-compose.rag.yml logs -f"
    
    echo ""
    log_info "=== 管理命令 ==="
    log_info "停止所有服务: ./scripts/stop_rag.sh"
    log_info "重启RAG服务: docker-compose -f docker/docker-compose.rag.yml restart FastGPTRAG"
    log_info "查看服务状态: docker-compose -f docker/docker-compose.yml -f docker/docker-compose.rag.yml ps"
}

# 主函数
main() {
    log_info "开始部署Coze Studio with FastGPTRAG..."
    
    # 检查是否在项目根目录
    if [ ! -f "PROJECT_STRUCTURE.md" ] || [ ! -d "backend" ] || [ ! -d "docker" ]; then
        log_error "请在Coze Studio项目根目录下运行此脚本"
        exit 1
    fi
    
    # 执行部署步骤
    check_dependencies
    init_environment
    
    # 询问是否生成新的密钥
    read -p "是否生成新的安全密钥？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        generate_secrets
    fi
    
    build_services
    start_databases
    init_databases
    start_applications
    
    # 等待服务完全启动
    log_info "等待服务完全启动..."
    sleep 30
    
    health_check
    show_deployment_info
    
    log_info "部署完成！请根据上述信息访问和使用服务。"
}

# 执行主函数
main "$@"
