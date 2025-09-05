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

package logs

import (
	"context"
	"fmt"
	"io"
	"os"
)

// FormatLogger is a logs interface that output logs with a format.
type FormatLogger interface {
	Tracef(format string, v ...interface{})
	Debugf(format string, v ...interface{})
	Infof(format string, v ...interface{})
	Noticef(format string, v ...interface{})
	Warnf(format string, v ...interface{})
	Errorf(format string, v ...interface{})
	Fatalf(format string, v ...interface{})
}

// Logger is a logs interface that provides logging function with levels.
type Logger interface {
	Trace(v ...interface{})
	Debug(v ...interface{})
	Info(v ...interface{})
	Notice(v ...interface{})
	Warn(v ...interface{})
	Error(v ...interface{})
	Fatal(v ...interface{})
}

// CtxLogger is a logs interface that accepts a context argument and output
// logs with a format.
type CtxLogger interface {
	CtxTracef(ctx context.Context, format string, v ...interface{})
	CtxDebugf(ctx context.Context, format string, v ...interface{})
	CtxInfof(ctx context.Context, format string, v ...interface{})
	CtxNoticef(ctx context.Context, format string, v ...interface{})
	CtxWarnf(ctx context.Context, format string, v ...interface{})
	CtxErrorf(ctx context.Context, format string, v ...interface{})
	CtxFatalf(ctx context.Context, format string, v ...interface{})
}

// Control provides methods to config a logs.
type Control interface {
	SetLevel(Level)
	SetOutput(io.Writer)
}

// FullLogger is the combination of Logger, FormatLogger, CtxLogger and Control.
type FullLogger interface {
	Logger
	FormatLogger
	CtxLogger
	Control
}

// Level defines the priority of a log message.
// When a logs is configured with a level, any log message with a lower
// log level (smaller by integer comparison) will not be output.
type Level int

// The levels of logs.
const (
	LevelTrace Level = iota
	LevelDebug
	LevelInfo
	LevelNotice
	LevelWarn
	LevelError
	LevelFatal
)

// ANSI color codes
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorGray   = "\033[37m"
	colorWhite  = "\033[97m"
)

var strs = []string{
	colorGray + "[Trace] " + colorReset,
	colorCyan + "[Debug] " + colorReset,
	colorWhite + "[Info] " + colorReset,
	colorBlue + "[Notice] " + colorReset,
	colorYellow + "[Warn] " + colorReset,
	colorRed + "[Error] " + colorReset,
	colorRed + "[Fatal] " + colorReset,
}

var plainStrs = []string{
	"[Trace] ",
	"[Debug] ",
	"[Info] ",
	"[Notice] ",
	"[Warn] ",
	"[Error] ",
	"[Fatal] ",
}

// isColorEnabled checks if color output is enabled
func isColorEnabled() bool {
	// Check if explicitly disabled
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	
	// Check if explicitly enabled
	if os.Getenv("FORCE_COLOR") != "" {
		return true
	}
	
	// Enable color for development environments or when ENABLE_COLOR_LOGS is set
	return os.Getenv("ENABLE_COLOR_LOGS") == "true" || 
		   os.Getenv("NODE_ENV") == "development" ||
		   os.Getenv("LOG_LEVEL") == "debug"
}

func (lv Level) toString() string {
	if lv >= LevelTrace && lv <= LevelFatal {
		if isColorEnabled() {
			return strs[lv]
		}
		return plainStrs[lv]
	}
	return fmt.Sprintf("[?%d] ", lv)
}
