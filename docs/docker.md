docker compose up -d coze-server

docker compose up --build -d coze-server

docker compose ps

docker compose -f docker-compose.yml -f docker-compose.rag.yml up -d fastgpt-rag rag-mongo rag-redis rag-postgres

docker compose up -d nsqlookupd nsqd nsqadmin

docker compose -f docker-compose.yml -f docker-compose.rag.yml up -d --force-recreate fastgpt-rag rag-mongo rag-redis rag-postgres



docker compose up -d mysql redis elasticsearch minio etcd milvus nsqlookupd nsqd nsqadmin


coze-server:
    docker compose restart coze-server
    docker compose logs -f coze-server  
FastGPTRAG:
    docker compose -f docker-compose.rag.yml down
    docker compose -f docker-compose.rag.yml up --build -d
coze-web:

docker-compose up --build coze-web-dev 

docker exec -it --user root coze-web-dev sh  

rush update
   rush install --bypass-policy
   rush link

   DEBUG=* VERBOSE_LOGGING=true npm run dev

   docker-compose --profile development stop coze-web-dev
   docker-compose --profile development up -d coze-web-dev
   docker-compose --profile development restart coze-web-dev

