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

/* eslint-disable @coze-arch/no-deep-relative-import */
import { useExecStateEntity } from '../../../../../hooks';
import { type NodeError } from '../../../../../entities/workflow-exec-state-entity';

export const useLineErrorList = () => {
  const { nodeErrors } = useExecStateEntity();

  const lineErrorList = Object.keys(nodeErrors).reduce(
    (list, nodeId: string) => {
      const lineErrors = nodeErrors[nodeId].filter(
        item => item.errorType === 'line',
      );

      return [...list, ...lineErrors];
    },
    [] as NodeError[],
  );

  return {
    lineErrorList,
    hasLineError: lineErrorList.length > 0,
  };
};
