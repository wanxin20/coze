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
  bindContributions,
  bindContributionProvider,
} from '@flowgram-adapter/common';

import { definePluginCreator, LifecycleContribution } from '../common';
import { ThemeService } from './theme';
import { StylingService, StylingContribution } from './styling';
import { StylesContribution } from './styles-contribution';
import { ColorService, ColorContribution } from './color';

const createStylesPlugin = definePluginCreator({
  onBind({ bind }) {
    // service
    bind(ThemeService).toSelf().inSingletonScope();
    bind(StylingService).toSelf().inSingletonScope();
    bind(ColorService).toSelf().inSingletonScope();
    // provider
    bindContributionProvider(bind, StylingContribution);
    bindContributionProvider(bind, ColorContribution);
    // contribution
    bindContributions(bind, StylesContribution, [
      LifecycleContribution,
      StylingContribution,
      ColorContribution,
    ]);
  },
});

export { createStylesPlugin };
