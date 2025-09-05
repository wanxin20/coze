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

import React, { createContext, useContext } from 'react';
import { type PropsWithChildren } from 'react';

import { type PluginName } from '../constants/plugin-name';

interface PluginScopeContextProps {
  pluginName?: PluginName;
}

const PluginScopeContext = createContext<PluginScopeContextProps>({});

export const usePluginScopeContext = () => useContext(PluginScopeContext);

export const PluginScopeContextProvider: React.FC<
  PropsWithChildren<PluginScopeContextProps>
> = ({ children, ...props }) => (
  <PluginScopeContext.Provider value={props}>
    {children}
  </PluginScopeContext.Provider>
);
