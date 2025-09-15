/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package coze

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/coze-dev/coze-studio/backend/api/model/data/knowledge/rag"
	"github.com/coze-dev/coze-studio/backend/application/knowledge"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

// GetTrainingStatus 获取训练状态
func GetTrainingStatus(ctx context.Context, c *app.RequestContext) {
	jobId := c.Param("jobId")
	if jobId == "" {
		logs.CtxErrorf(ctx, "Training job ID is required")
		c.JSON(400, rag.BaseResponse{
			Code: 400,
			Msg:  "Training job ID is required",
		})
		return
	}

	logs.CtxInfof(ctx, "Getting training status for job: %s", jobId)

	// 构建请求
	req := &rag.GetRagTrainingStatusRequest{
		TrainingJobId: jobId,
	}

	// 调用服务
	resp, err := knowledge.RAGApp.GetRagTrainingStatus(ctx, req)
	if err != nil {
		logs.CtxErrorf(ctx, "Get training status failed: %v", err)
		c.JSON(500, rag.BaseResponse{
			Code: 500,
			Msg:  "Internal server error",
		})
		return
	}

	c.JSON(200, resp)
}
