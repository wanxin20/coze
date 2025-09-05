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

import {
  FlowMinimapService,
  MinimapRender,
} from '@flowgram-adapter/free-layout-editor';
import { useService } from '@flowgram-adapter/free-layout-editor';

import type { ToolbarHandlers } from '../type';

interface IMinimap {
  handlers: ToolbarHandlers;
}

export const Minimap = (props: IMinimap) => {
  const { handlers } = props;
  const { minimapVisible } = handlers;
  const minimapService = useService(FlowMinimapService);
  if (!minimapVisible) {
    return <></>;
  }
  return (
    <div
      className="workflow-toolbar-minimap flex mb-2"
      data-testid="workflow.detail.toolbar.minimap"
    >
      <MinimapRender
        service={minimapService}
        panelStyles={{}}
        containerStyles={{
          pointerEvents: 'auto',
          position: 'relative',
          top: 'unset',
          right: 'unset',
          bottom: 'unset',
          left: 'unset',
        }}
        inactiveStyle={{
          opacity: 1,
          scale: 1,
          translateX: 0,
          translateY: 0,
        }}
      />
    </div>
  );
};
