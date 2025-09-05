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

import { Suspense, lazy } from 'react';

import { useInputVariables } from '@/hooks';
import { withField } from '@/form';

const CanvasLazy = lazy(async () => {
  const { Canvas: CanvasNode } = await import('./canvas/components/canvas');
  return {
    default: CanvasNode,
  };
});

export const Canvas = withField(props => {
  /**
   * useInputVariables internally uses useContext
   * lazyLoad will cause context changes that cannot be monitored
   * Get the variables in advance
   */
  const variables = useInputVariables({
    needNullType: true,
    needNullName: true,
  });

  return (
    <Suspense fallback={<div>canvas loading...</div>}>
      <CanvasLazy {...props} variables={variables} />
    </Suspense>
  );
});
