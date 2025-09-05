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

import { RushConfiguration } from '@rushstack/rush-sdk';

const getRushConfiguration = (() => {
  let rushConfig: RushConfiguration;
  return () => {
    if (!rushConfig) {
      rushConfig = RushConfiguration.loadFromDefaultLocation({});
    }
    return rushConfig;
  };
})();

import OriginPkgRootWebpackPlugin from '@coze-arch/pkg-root-webpack-plugin-origin';

type PkgRootWebpackPluginOptions = Record<string, unknown>;

class PkgRootWebpackPlugin extends OriginPkgRootWebpackPlugin {
  constructor(options?: Partial<PkgRootWebpackPluginOptions>) {
    const rushJson = getRushConfiguration();
    const rushJsonPackagesDir = rushJson.projects.map(
      item => item.projectFolder,
    );
    // .filter(item => !item.includes('/apps/'));

    const mergedOptions = Object.assign({}, options || {}, {
      root: '@',
      packagesDirs: rushJsonPackagesDir,
      // Exclude apps/* to reduce processing time
      excludeFolders: [],
    });
    super(mergedOptions);
  }
}

export default PkgRootWebpackPlugin;

export { PkgRootWebpackPlugin };
