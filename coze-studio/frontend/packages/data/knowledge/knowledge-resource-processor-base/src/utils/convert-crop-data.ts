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

import type Cropper from 'cropperjs';

import { type CropperSizePercent } from '@/features/knowledge-type/text/interface';

const fixPrecision = (value: number) => parseFloat(value.toFixed(2));

export const convertCropDataToPercentSize = ({
  data,
  pdfSize: { naturalHeight, naturalWidth },
}: {
  data: Cropper.Data;
  pdfSize: {
    naturalHeight: number;
    naturalWidth: number;
  };
}): CropperSizePercent => {
  const topPixel = data.y;
  const bottomPixel = data.y + data.height;
  const leftPixel = data.x;
  const rightPixel = data.x + data.width;
  return {
    topPercent: fixPrecision(topPixel / naturalHeight),
    bottomPercent: fixPrecision((naturalHeight - bottomPixel) / naturalHeight),
    leftPercent: fixPrecision(leftPixel / naturalWidth),
    rightPercent: fixPrecision((naturalWidth - rightPixel) / naturalWidth),
  };
};

export const convertPercentSizeToCropData = ({
  cropSizePercent: { topPercent, bottomPercent, rightPercent, leftPercent },
  pdfSize: { naturalHeight, naturalWidth },
}: {
  cropSizePercent: CropperSizePercent;
  pdfSize: {
    naturalHeight: number;
    naturalWidth: number;
  };
}): Cropper.Data => {
  const x = leftPercent * naturalWidth;
  const y = topPercent * naturalHeight;
  const width = naturalWidth - x - naturalWidth * rightPercent;
  const height = naturalHeight - y - naturalHeight * bottomPercent;
  return {
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    x,
    y,
    width,
    height,
  };
};
