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

import { useEffect } from 'react';

import { useService } from '@flowgram-adapter/free-layout-editor';
import { useCurrentEntity } from '@flowgram-adapter/free-layout-editor';

import { type RenameInfo } from '../core/types';
import { WorkflowVariableFacadeService } from '../core';

interface HooksParams {
  keyPath?: string[];
  onRename?: (params: RenameInfo) => void;
}

export function useVariableRename({ keyPath, onRename }: HooksParams) {
  const node = useCurrentEntity();
  const facadeService: WorkflowVariableFacadeService = useService(
    WorkflowVariableFacadeService,
  );

  useEffect(() => {
    if (!keyPath) {
      return;
    }

    const variable = facadeService.getVariableFacadeByKeyPath(keyPath, {
      node,
    });
    const disposable = variable?.onRename(_params => {
      onRename?.(_params);
    });

    return () => disposable?.dispose();
  }, [keyPath?.join('.')]);

  return;
}
