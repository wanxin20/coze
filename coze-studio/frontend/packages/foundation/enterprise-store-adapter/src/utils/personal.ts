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

/**
 * The @file open-source version does not provide enterprise management functions for the time being. The methods exported in this file are for future expansion.
 */

import { PERSONAL_ENTERPRISE_ID } from '../constants';

// Check if the business is a personal version
export const isPersonalEnterprise = (enterpriseId?: string) =>
  enterpriseId === PERSONAL_ENTERPRISE_ID;
