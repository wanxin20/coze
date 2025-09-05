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

import { TreeIndentWidth } from '../constants';

interface ColumnsStyle {
  name: React.CSSProperties;
  type: React.CSSProperties;
}

export function useColumnsStyle(columnsRatio = '3:2', level = 0): ColumnsStyle {
  const [nameWidth, typeWidth] = columnsRatio.split(':').map(Number);

  return {
    name: {
      flex: `${nameWidth} ${nameWidth} 0`,
    },
    type: {
      flex: `${typeWidth} ${typeWidth} ${
        (level * TreeIndentWidth * typeWidth) / nameWidth
      }px`,
      minWidth: '80px',
      maxWidth: '135px',
    },
  };
}
