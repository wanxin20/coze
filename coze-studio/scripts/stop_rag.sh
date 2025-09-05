#!/bin/bash

# Coze Studio with FastGPTRAG Integration Stop Script
# 停止Coze Studio和FastGPTRAG微服务

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

# 停止服务
stop_services() {
    log_step "停止所有服务..."
    
    cd docker
    
    # 停止Coze服务
    log_info "停止Coze服务..."
    docker-compose down
    
    # 停止RAG服务
    log_info "停止FastGPTRAG服务..."
    docker-compose -f docker-compose.rag.yml down
    
    cd ..
    
    log_info "所有服务已停止"
}

# 清理资源
cleanup_resources() {
    log_step "清理Docker资源..."
    
    # 清理未使用的镜像
    log_info "清理未使用的镜像..."
    docker image prune -f
    
    # 清理未使用的网络
    log_info "清理未使用的网络..."
    docker network prune -f
    
    log_info "资源清理完成"
}

# 显示停止信息
show_stop_info() {
    log_info "=== 服务已停止 ==="
    log_info "所有Coze Studio和FastGPTRAG服务已停止"
    
    echo ""
    log_info "=== 重新启动命令 ==="
    log_info "启动所有服务: ./scripts/deploy_with_rag.sh"
    log_info "只启动RAG服务: docker-compose -f docker/docker-compose.rag.yml up -d"
    log_info "只启动Coze服务: docker-compose -f docker/docker-compose.yml up -d"
    
    echo ""
    log_info "=== 数据保留说明 ==="
    log_info "数据卷已保留，重新启动时数据不会丢失"
    log_info "如需完全清理数据，请运行: docker-compose -f docker/docker-compose.yml -f docker/docker-compose.rag.yml down -v"
}

# 主函数
main() {
    log_info "停止Coze Studio with FastGPTRAG服务..."
    
    # 检查是否在项目根目录
    if [ ! -f "PROJECT_STRUCTURE.md" ] || [ ! -d "backend" ] || [ ! -d "docker" ]; then
        log_error "请在Coze Studio项目根目录下运行此脚本"
        exit 1
    fi
    
    # 询问是否清理资源
    read -p "是否清理未使用的Docker资源？(y/N): " -n 1 -r
    echo
    
    stop_services
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_resources
    fi
    
    show_stop_info
    
    log_info "停止完成！"
}

# 执行主函数
main "$@"
