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

import { EditorProvider, createRenderer } from '@coze-editor/editor/react';
import preset, {
  languages,
  createTheme,
  tags,
} from '@coze-editor/editor/preset-code';
import { json } from '@coze-editor/editor/language-json';
import { EditorView, tooltips } from '@codemirror/view';

const colors = {
  background: '#F7F7FC',
  // syntax
  comment: '#000A298A',
  key: '#00818C',
  string: '#D1009D',
  number: '#C74200',
  boolean: '#2B57D9',
  null: '#2B57D9',
  separator: '#0F1529D1',
};

languages.register('json', json);

const JSONEditor: any = createRenderer(preset, [
  EditorView.theme({
    '&': {
      borderRadius: '8px',
    },
    '.cm-scroller': {
      transition: 'height .3s ease',
    },
    '.cm-content': {
      paddingTop: '6px',
      paddingBottom: '6px',
    },
    '.cm-completionIcon-property': {
      backgroundImage:
        'url("' +
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMi4zNTc2IDguMTAzNTVDMTIuMTYyMyA3LjkwODI5IDExLjg0NTcgNy45MDgyOSAxMS42NTA1IDguMTAzNTVMOC4xMDM1NSAxMS42NTA1QzcuOTA4MjkgMTEuODQ1NyA3LjkwODI5IDEyLjE2MjMgOC4xMDM1NSAxMi4zNTc2TDExLjY1MDUgMTUuOTA0NUMxMS44NDU3IDE2LjA5OTggMTIuMTYyMyAxNi4wOTk4IDEyLjM1NzYgMTUuOTA0NUwxNS45MDQ1IDEyLjM1NzZDMTYuMDk5OCAxMi4xNjIzIDE2LjA5OTggMTEuODQ1NyAxNS45MDQ1IDExLjY1MDVMMTIuMzU3NiA4LjEwMzU1WiIgZmlsbD0iIzA2MDcwOUNDIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMS4wMDI2IDEuNDU1NDVDMTEuNjIxNCAxLjA5ODE4IDEyLjM4MzggMS4wOTgxOCAxMy4wMDI2IDEuNDU1NDVMMjAuNjM4IDUuODYzNzRDMjEuMjU2OCA2LjIyMSAyMS42MzggNi44ODEyNiAyMS42MzggNy41OTU3OVYxNi40MTI0QzIxLjYzOCAxNy4xMjY5IDIxLjI1NjggMTcuNzg3MiAyMC42MzggMTguMTQ0NEwxMy4wMDI2IDIyLjU1MjdDMTIuMzgzOCAyMi45MSAxMS42MjE0IDIyLjkxIDExLjAwMjYgMjIuNTUyN0wzLjM2NzE5IDE4LjE0NDRDMi43NDgzOSAxNy43ODcyIDIuMzY3MTkgMTcuMTI2OSAyLjM2NzE5IDE2LjQxMjRWNy41OTU3OUMyLjM2NzE5IDYuODgxMjYgMi43NDgzOSA2LjIyMTAxIDMuMzY3MTkgNS44NjM3NEwxMS4wMDI2IDEuNDU1NDVaTTEyLjAwMjYgMy4xODc1TDE5LjYzOCA3LjU5NTc5VjE2LjQxMjRMMTIuMDAyNiAyMC44MjA3TDQuMzY3MTkgMTYuNDEyNEw0LjM2NzE5IDcuNTk1NzlMMTIuMDAyNiAzLjE4NzVaIiBmaWxsPSIjMDYwNzA5Q0MiLz48L3N2Zz4=' +
        '")',
      backgroundSize: '11px 11px',
      backgroundRepeat: 'no-repeat',
      width: '11px',
      height: '11px',
    },
    '.cm-completionIcon-property::after': {
      content: '""',
    },
    '.cm-selectionBackground': {
      borderRadius: '4px',
    },
    '.cm-activeLineGutter': {
      borderRadius: '4px 0 0 4px',
    },
    '.cm-activeLine': {
      borderRadius: '0 4px 4px 0',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '& *': {
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    },
    '.cm-tooltip': {
      wordBreak: 'break-all',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      transform: 'translate(0, 1px)',
    },
    '.cm-foldGutter .cm-gutterElement > div': {
      display: 'flex',
      alignItems: 'center',
    },
    '.cm-completionIcon': {
      fontSize: '11px',
    },
  }),
  createTheme({
    variant: 'light',
    settings: {
      background: colors.background,
      foreground: '#4D4D4C',
      caret: '#AEAFAD',
      selection: '#52649A21',
      gutterBackground: colors.background,
      gutterForeground: '#000A298A',
      gutterBorderColor: 'transparent',
      gutterBorderWidth: 0,
      lineHighlight: '#efefef78',
      bracketColors: ['#E4D129', '#AC05FF', '#2B57D9'],
      tooltip: {
        backgroundColor: 'var(--coz-bg-max)',
        color: 'var(--coz-fg-primary)',
        border: 'solid 1px var(--coz-stroke-plus)',
        boxShadow: 'var(--coz-shadow-default)',
        borderRadius: '8px',
      },
      tooltipCompletion: {
        backgroundColor: '#FFFFFF',
        color: '#060709CC',
      },
      completionItemHover: {
        backgroundColor: '#5768A114',
      },
      completionItemSelected: {
        backgroundColor: '#52649A21',
      },
      completionItemIcon: {
        color: '#060709CC',
      },
      completionItemLabel: {
        color: '#060709CC',
      },
      completionItemDetail: {
        color: '#2029459E',
      },
    },
    styles: [
      // JSON
      {
        tag: tags.comment,
        color: colors.comment,
      },
      {
        tag: [tags.propertyName],
        color: colors.key,
      },
      {
        tag: [tags.string],
        color: colors.string,
      },
      {
        tag: [tags.number],
        color: colors.number,
      },
      {
        tag: [tags.bool],
        color: colors.boolean,
      },
      {
        tag: [tags.null],
        color: colors.null,
      },
      {
        tag: [tags.separator],
        color: colors.separator,
      },
    ],
  }),
  tooltips({
    parent: document.body,
    tooltipSpace() {
      return {
        left: 16,
        top: 16,
        right: window.innerWidth - 16,
        bottom: window.innerHeight - 16,
      };
    },
  }),
]);

export { JSONEditor, EditorProvider };
