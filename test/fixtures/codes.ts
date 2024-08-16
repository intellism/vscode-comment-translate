
export const codeData = [

  {
    name: 'spaceInHead comment',
    multiLineMerge: true,
   languageId:'typescript',
    code: `// This is the theme of your application
        //
        // Try running your application with "flutter run". You'll see the
        // application has a blue toolbar. Then, without quitting the app, try
        // changing the primarySwatch below to Colors.green and then invoke
        // "hot reload" (press "r" in the console where you ran "flutter run",
        // or simply save your changes to "hot reload" in a Flutter IDE).
        // Notice that the counter didn't reset back to zero; the application
        // is not restarted.

let x = 1;

        /// This is the theme of your application
        ///
        /// Try running your application with "flutter run". You'll see the
        /// application has a blue toolbar. Then, without quitting the app, try
        /// changing the primarySwatch below to Colors.green and then invoke
        /// "hot reload" (press "r" in the console where you ran "flutter run",
        /// or simply save your changes to "hot reload" in a Flutter IDE).
        /// Notice that the counter didn't reset back to zero; the application
        /// is not restarted.
  `,translated: [
    `表示描述{@link TextEditor.options文本编辑器的选项}中的更改的事件。`,
    `{@link TextEditor.options文本编辑器的选项}的新值。`,
  ]
},
  {
    name: 'head comment',
    code: `// Type definitions for Visual Studio Code 1.68
// Project: https://github.com/microsoft/vscode
// Definitions by: Visual Studio Code Team, Microsoft <https://github.com/microsoft>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/microsoft/vscode/blob/main/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Type Definition for Visual Studio Code 1.68 Extension API
 * See https://code.visualstudio.com/api for more information
 */`,
    translated: [`Visual Studio Code 1.68的类型定义
项目：https://github.com/microsoft/vscode
定义：Microsoft Visual Studio Code Team <https://github.com/microsoft>
定义：https://github.com/DefinitelyTyped/DefinitelyTyped`,
`---------------------------------------------------------------------------------------------
*  版权所有（c）Microsoft Corporation。 All rights reserved.
*  根据MIT许可证授权。
*  有关许可证信息，请参见https://github.com/microsoft/vscode/blob/main/LICENSE.txt。
*--------------------------------------------------------------------------------------------`,
`* Visual Studio Code 1.68扩展API的类型定义
* 有关详细信息，请访问https://code.visualstudio.com/api`],
   multiLineMerge: true,
   languageId:'typescript'
  },
  {
    name: 'function comment',
    code: `/**
	 * Represents an event describing the change in a {@link TextEditor.options text editor's options}.
	 */
	export interface TextEditorOptionsChangeEvent {
		
		readonly textEditor: TextEditor;
		/**
		 * The new value for the {@link TextEditor.options text editor's options}.
		 */
		readonly options: TextEditorOptions;
	}`,
    translated: [
      `表示描述{@link TextEditor.options文本编辑器的选项}中的更改的事件。`,
      `{@link TextEditor.options文本编辑器的选项}的新值。`,
    ],
   multiLineMerge: true,
   languageId:'typescript'
  },
];
