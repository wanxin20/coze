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

import React, { type FC } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const workflowQueryClient = new QueryClient();

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
export function withQueryClient<T extends FC<any>>(Component: T): T {
  return function WrappedComponent(props) {
    return (
      <QueryClientProvider client={workflowQueryClient}>
        <Component {...props} />
      </QueryClientProvider>
    );
  } as T;
}
