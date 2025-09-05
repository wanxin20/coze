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

import { useShallow } from 'zustand/react/shallow';
import { WithRuleImgBackground } from '@coze-common/chat-uikit';
import {
  type CustomComponent,
  useReadonlyPlugin,
  PluginName,
} from '@coze-common/chat-area';

import { type BackgroundPluginBizContext } from '../../types/biz-context';

import styles from './index.module.less';

export const ChatBackgroundUI: CustomComponent['MessageListFloatSlot'] = ({
  headerNode,
}) => {
  const plugin = useReadonlyPlugin<BackgroundPluginBizContext>(
    PluginName.ChatBackground,
  );
  const { useChatBackgroundContext } = plugin.pluginBizContext.storeSet;
  const backgroundImageInfo = useChatBackgroundContext(
    useShallow(state => state.backgroundImageInfo),
  );
  const isBackgroundMode =
    !!backgroundImageInfo?.mobile_background_image?.origin_image_url;

  return isBackgroundMode ? (
    <>
      {headerNode ? <div className={styles.mask}></div> : null}
      <WithRuleImgBackground backgroundInfo={backgroundImageInfo} />
    </>
  ) : null;
};
