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

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowDocument,
  type WorkflowNodeEntity,
} from '@flowgram-adapter/free-layout-editor';

import { complexMock } from '../workflow.mock';
import { createContainer } from '../create-container';
import {
  EncapsulateValidateErrorCode,
  EncapsulateValidateService,
} from '../../src/validate';

describe('ports', () => {
  let encapsulateValidateService: EncapsulateValidateService;
  let workflowDocument: WorkflowDocument;
  beforeEach(async () => {
    const container = createContainer();
    encapsulateValidateService = container.get<EncapsulateValidateService>(
      EncapsulateValidateService,
    );
    workflowDocument = container.get<WorkflowDocument>(WorkflowDocument);
    await workflowDocument.fromJSON(complexMock);
  });

  it('should validate no input ports return error', async () => {
    const nodes = ['100001', '177547'].map(id =>
      workflowDocument.getNode(id),
    ) as WorkflowNodeEntity[];
    const res = await encapsulateValidateService.validate(nodes);
    expect(
      res.hasErrorCode(EncapsulateValidateErrorCode.INVALID_PORTS),
    ).toBeTruthy();
  });

  it('should validate no output ports return error', async () => {
    const nodes = ['109408', '156471'].map(id =>
      workflowDocument.getNode(id),
    ) as WorkflowNodeEntity[];
    const res = await encapsulateValidateService.validate(nodes);
    expect(
      res.hasErrorCode(EncapsulateValidateErrorCode.INVALID_PORTS),
    ).toBeTruthy();
  });
});
