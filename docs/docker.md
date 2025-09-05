docker compose up -d coze-server

docker compose up --build -d coze-server

docker compose ps

docker compose -f docker-compose.yml -f docker-compose.rag.yml up -d fastgpt-rag rag-mongo rag-redis rag-postgres

docker compose up -d nsqlookupd nsqd nsqadmin

docker compose -f docker-compose.yml -f docker-compose.rag.yml up -d --force-recreate fastgpt-rag rag-mongo rag-redis rag-postgres



docker compose up -d mysql redis elasticsearch minio etcd milvus nsqlookupd nsqd nsqadmin


coze-server:
    docker compose -f docker-compose.yml restart coze-server
    docker compose logs -f coze-server  
FastGPTRAG:
    docker compose -f docker-compose.rag.yml down
    docker compose -f docker-compose.rag.yml up --build -d
coze-web:

# 启动完整开发环境
docker-compose up -d

docker-compose up --build coze-web
