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

import { useRef, useEffect } from 'react';

import clsx from 'clsx';
import BigNumber, { type BigNumber as IBigNumber } from 'bignumber.js';
import {
  IconCozArrowDownFill,
  IconCozArrowUpFill,
} from '@coze-arch/coze-design/icons';
import { Input, type InputProps } from '@coze-arch/coze-design';

import css from './input-number.module.less';

export interface InputNumberProps {
  value?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  validateStatus?: InputProps['validateStatus'];
  disabled?: boolean;
  onChange: (v?: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  /** integer */
  int?: boolean;
}

/** Is it a legal numeric string? */
function isValidNumber(str: string) {
  try {
    const value = new BigNumber(str);
    return !value.isNaN();
  } catch {
    return false;
  }
}

function normalizeNumber(str?: string) {
  if (!str || !isValidNumber(str)) {
    return;
  }
  return new BigNumber(str);
}

export const InputNumber: React.FC<InputNumberProps> = ({
  int,
  onChange,
  onBlur,
  ...props
}) => {
  const verifiedRef = useRef<undefined | IBigNumber>(
    normalizeNumber(props.value),
  );

  const fixed = (num: IBigNumber, innerInt?: boolean) =>
    innerInt ? num.toFixed(0, BigNumber.ROUND_DOWN) : num.toFixed();

  const handleBlur = () => {
    if (props.value === '' || props.value === undefined) {
      /** If the value is empty when out of focus, the verification value is also cleared */
      verifiedRef.current = undefined;
      if (props.value === '') {
        onChange(undefined);
      }
    } else {
      /** If the value is not empty when out of focus, you need to verify the legitimacy of the value */
      /**
       * 1. If the value itself is legal, format the value
       * 2. If the value is not legal, the most recent legal value is adopted
       * 3. If none, return undefined
       */
      let next: undefined | string;
      const nextBig = normalizeNumber(props.value) || verifiedRef.current;
      if (nextBig) {
        next = fixed(nextBig, int);
      }
      if (next !== props.value) {
        onChange(next);
      }
    }
    onBlur();
  };

  const handlePlus = () => {
    let next = '1';
    if (verifiedRef.current) {
      const nextNum = verifiedRef.current.plus('1');
      next = fixed(nextNum, int);
    }
    onChange(next);
  };

  const handleMinus = () => {
    let next = '0';
    if (verifiedRef.current) {
      const nextNum = verifiedRef.current.minus('1');
      next = fixed(nextNum, int);
    }
    onChange(next);
  };

  /** When the value changes, you need to synchronize the value to a legal number */
  useEffect(() => {
    if (props.value === '' || props.value === undefined) {
      verifiedRef.current = undefined;
    }
    const next = normalizeNumber(props.value);
    if (next) {
      verifiedRef.current = normalizeNumber(props.value);
    }
  }, [props.value]);

  return (
    <Input
      onChange={onChange}
      onBlur={handleBlur}
      size="small"
      suffix={
        props.disabled ? null : (
          <div className={css.buttons}>
            <div className={clsx(css.button, css.up)} onClick={handlePlus}>
              <IconCozArrowUpFill />
            </div>
            <div className={clsx(css.button, css.down)} onClick={handleMinus}>
              <IconCozArrowDownFill />
            </div>
          </div>
        )
      }
      {...props}
    />
  );
};
