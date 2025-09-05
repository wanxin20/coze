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

import { useMemo } from 'react';

import { isBoolean, isNull, isNumber, isObject, isString } from 'lodash-es';

import { isBigNumber, bigNumbertoString } from '../utils/big-number';
import { generateStrAvoidEscape } from '../utils';
import { type Field } from '../types';
import { LogValueStyleType } from '../constants';
import { LongStrValue, MAX_LENGTH } from '../components/long-str-value';

export const useValue = (value: Field['value']) => {
  const v = useMemo(() => {
    if (isNull(value)) {
      return {
        value: 'null',
        type: LogValueStyleType.Default,
      };
    } else if (isObject(value)) {
      // Large number Returns the numeric type, and the value is a string.
      if (isBigNumber(value)) {
        return {
          value: bigNumbertoString(value),
          type: LogValueStyleType.Number,
        };
      }

      return {
        value: '',
        type: LogValueStyleType.Default,
      };
    } else if (isBoolean(value)) {
      return {
        value: value.toString(),
        type: LogValueStyleType.Boolean,
      };
    } else if (isString(value)) {
      if (value === '') {
        return {
          value: '""',
          type: LogValueStyleType.Default,
        };
      }
      if (value.length > MAX_LENGTH) {
        return {
          value: <LongStrValue str={value} />,
          type: LogValueStyleType.Default,
        };
      }
      return {
        value: generateStrAvoidEscape(value),
        // Value: generateStr2Link (value, avoidEscape), cancel the link parsing first
        type: LogValueStyleType.Default,
      };
    } else if (isNumber(value)) {
      return {
        value,
        type: LogValueStyleType.Number,
      };
    }
    return {
      value,
      type: LogValueStyleType.Default,
    };
  }, [value]);
  return v;
};
