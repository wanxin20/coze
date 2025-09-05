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

import { useParams } from 'react-router-dom';
import React, { type FC, type PropsWithChildren } from 'react';

import { useCreation } from 'ahooks';
import { logger as rawLogger, LoggerContext } from '@coze-arch/logger';
import { type DynamicParams } from '@coze-arch/bot-typings/teamspace';

const botDebugLogger = rawLogger.createLoggerWith({
  ctx: {
    meta: {},
    namespace: 'bot_debug',
  },
});

const BotEditorLoggerContextProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const params = useParams<DynamicParams>();

  const loggerWithId = useCreation(
    () =>
      botDebugLogger.createLoggerWith({
        ctx: {
          meta: {
            bot_id: params.bot_id,
          },
        },
      }),
    [],
  );

  return (
    <LoggerContext.Provider value={loggerWithId}>
      {children}
    </LoggerContext.Provider>
  );
};

export { BotEditorLoggerContextProvider };
