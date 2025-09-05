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

import { I18n } from '@coze-arch/i18n';

import { ValueExpressionService } from '@/services';

export function createSelectAndSetFieldsValidator() {
  return {
    ['inputs.*.fieldInfo.*.fieldValue']: ({ value, context }) => {
      const valueExpressionService = context.node.getService(
        ValueExpressionService,
      );

      // Check if the reference variable has been deleted
      if (
        valueExpressionService.isRefExpression(value) &&
        !valueExpressionService.isRefExpressionVariableExists(
          value,
          context.node,
        )
      ) {
        return I18n.t('workflow_detail_variable_referenced_error');
      }
    },
  };
}
