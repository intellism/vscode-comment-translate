/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/microsoft/vscode/blob/main/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Type Definition for Visual Studio Code 1.91 Extension API
 * See https://code.visualstudio.com/api for more information
 */
export interface Command {
  /**
   * Title of the command, like `save`.
   */
  title: string;

  /**
   * The identifier of the actual command handler.
   * @see {@link commands.registerCommand}
   */
  command: string;

  /**
   * A tooltip for the command, when represented in the UI.
   */
  tooltip?: string;

  /**
   * Arguments that the command handler should be
   * invoked with.
   */
  arguments?: any[];
}

let text = 'hello world';
let mText = `多行文本
Type Definition for ${text} Visual Studio Code 1.91 Extension API
See https://code.visualstudio.com/api for more information`