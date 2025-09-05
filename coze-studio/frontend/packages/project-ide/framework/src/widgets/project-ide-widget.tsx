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

import { type interfaces } from 'inversify';
import { Emitter, ReactWidget } from '@coze-project-ide/client';

import { type WidgetContext } from '@/context/widget-context';

export class ProjectIDEWidget extends ReactWidget {
  context: WidgetContext;

  container: interfaces.Container;

  private onRefreshEmitter = new Emitter<void>();

  onRefresh = this.onRefreshEmitter.event;

  refresh() {
    this.onRefreshEmitter.fire();
  }

  constructor(props) {
    super(props);
    this.scrollOptions = {
      minScrollbarLength: 35,
    };
  }

  render(): any {
    return null;
  }
}
