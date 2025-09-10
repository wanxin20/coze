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

import React from 'react';

import classNames from 'classnames';
import { IconCozAddNode } from '@coze-arch/coze-design/icons';
import { IconButton, type ButtonProps } from '@coze-arch/coze-design';
import { IconAdd } from '@coze-arch/bot-icons';

import styles from './index.module.less';

type AddOperationProps = React.PropsWithChildren<{
  readonly?: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  subitem?: boolean;
  size?: ButtonProps['size'];
  color?: ButtonProps['color'];
}>;

export default function AddOperation({
  readonly,
  onClick,
  className,
  style,
  disabled,
  subitem = false,
  size,
  color,
  ...restProps
}: AddOperationProps) {
  if (readonly) {
    return null;
  }
  return (
    <IconButton
      data-testid={restProps['data-testid']}
      onClick={onClick}
      className={classNames(
        styles.container,
        disabled ? styles.disabled : null,
        className,
      )}
      style={style}
      icon={subitem ? <IconCozAddNode /> : <IconAdd className={styles.icon} />}
      disabled={disabled}
      size={size}
      color={color}
    />
  );
}
