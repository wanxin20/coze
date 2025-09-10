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

package httputil

import (
	"context"
	"errors"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"

	"github.com/coze-dev/coze-studio/backend/pkg/errorx"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
	"github.com/coze-dev/coze-studio/backend/types/errno"
)

type data struct {
	Code int32  `json:"code"`
	Msg  string `json:"msg"`
}

func BadRequest(c *app.RequestContext, errMsg string) {
	c.AbortWithStatusJSON(http.StatusBadRequest, data{Code: http.StatusBadRequest, Msg: errMsg})
}

func InternalError(ctx context.Context, c *app.RequestContext, err error) {
	var customErr errorx.StatusError

	if errors.As(err, &customErr) && customErr.Code() != 0 {
		logs.CtxWarnf(ctx, "[ErrorX] error:  %v %v \n", customErr.Code(), err)
		
		// 检查是否是认证失败错误，返回正确的HTTP状态码
		statusCode := http.StatusOK
		if customErr.Code() == errno.ErrUserAuthenticationFailed {
			statusCode = http.StatusUnauthorized
		}
		
		c.AbortWithStatusJSON(statusCode, data{Code: customErr.Code(), Msg: customErr.Msg()})
		return
	}

	logs.CtxErrorf(ctx, "[InternalError]  error: %v \n", err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, data{Code: 500, Msg: "internal server error"})
}
