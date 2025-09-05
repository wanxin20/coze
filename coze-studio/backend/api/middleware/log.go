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

package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/google/uuid"

	"github.com/coze-dev/coze-studio/backend/pkg/i18n"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
)

func AccessLogMW() app.HandlerFunc {
	// 检查是否启用详细API日志
	enableAPILogging := os.Getenv("ENABLE_API_LOGGING") == "true"
	enableRequestLogging := os.Getenv("ENABLE_REQUEST_LOGGING") == "true"
	verboseLogging := os.Getenv("VERBOSE_LOGGING") == "true"
	
	return func(c context.Context, ctx *app.RequestContext) {
		start := time.Now()
		ctx.Next(c)

		status := ctx.Response.StatusCode()
		path := bytesToString(ctx.Request.URI().PathOriginal())
		latency := time.Since(start)
		method := bytesToString(ctx.Request.Header.Method())
		clientIP := ctx.ClientIP()

		handlerPkgPath := strings.Split(ctx.HandlerName(), "/")
		handleName := ""
		if len(handlerPkgPath) > 0 {
			handleName = handlerPkgPath[len(handlerPkgPath)-1]
		}

		requestType := ctx.GetInt32(RequestAuthTypeStr)
		
		// 增强的基础日志格式
		var baseLog string
		if enableAPILogging || verboseLogging {
			baseLog = fmt.Sprintf("API | %s | %s:%s | %d | %v | %s | %s | %s | %d | %s",
				method, ctx.Host(), path, status, latency, clientIP, 
				string(ctx.GetRequest().Scheme()), handleName, requestType, i18n.GetLocale(c))
		} else {
			baseLog = fmt.Sprintf("| %s | %s | %d | %v | %s | %s | %v | %s | %d | %s",
				string(ctx.GetRequest().Scheme()), ctx.Host(), status,
				latency, clientIP, method, path, handleName, requestType, i18n.GetLocale(c))
		}

		switch {
		case status >= http.StatusInternalServerError:
			logs.CtxErrorf(c, "%s", baseLog)
		case status >= http.StatusBadRequest:
			logs.CtxWarnf(c, "%s", baseLog)
		default:
			requestAuthType := ctx.GetInt32(RequestAuthTypeStr)
			if requestAuthType != int32(RequestAuthTypeStaticFile) && filepath.Ext(path) == "" {
				// 总是记录基础API信息
				logs.CtxInfof(c, "%s", baseLog)
				
				// 详细请求/响应日志（仅在启用时）
				if enableRequestLogging || verboseLogging {
					urlQuery := ctx.Request.URI().QueryString()
					reqBody := bytesToString(ctx.Request.Body())
					respBody := bytesToString(ctx.Response.Body())
					maxPrintLen := 3 * 1024
					if len(respBody) > maxPrintLen {
						respBody = respBody[:maxPrintLen] + "...(truncated)"
					}
					if len(reqBody) > maxPrintLen {
						reqBody = reqBody[:maxPrintLen] + "...(truncated)"
					}
					
					// 分别记录请求和响应，便于阅读
					if len(urlQuery) > 0 {
						logs.CtxDebugf(c, "Query: %s", urlQuery)
					}
					if len(reqBody) > 0 {
						logs.CtxDebugf(c, "Request Body: %s", reqBody)
					}
					if len(respBody) > 0 {
						logs.CtxDebugf(c, "Response Body: %s", respBody)
					}
				}
			}
		}
	}
}

func SetLogIDMW() app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		logID := uuid.New().String()
		ctx = context.WithValue(ctx, "log-id", logID)

		c.Header("X-Log-ID", logID)
		c.Next(ctx)
	}
}

func bytesToString(b []byte) string {
	return *(*string)(unsafe.Pointer(&b)) // nolint
}
