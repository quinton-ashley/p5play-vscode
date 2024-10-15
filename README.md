# <img src="assets/p5play_icon.png" height="32px"> p5play-vscode

Use this extension to easily create and run p5play projects in Visual Studio Code.

![p5play-vscode](assets/p5play-vscode.png)

## Create a new p5play project

1. Open a new window in Visual Studio Code
2. Find "p5play" in the bottom status bar and click it.
3. When the p5play tab opens, click "Create a new p5play project"
4. Enter the name of the project and then select the destination folder.
5. Happy coding! 🎉😃🎮

The [p5play-template](https://github.com/quinton-ashley/p5play-template) folder contains a basic p5play project that you can run offline.

## Run your project

If you have a p5play project folder open in VSCode, simply click "p5play" in the bottom status bar. A live server will start and your project will run inside the p5play tab.

Click the play icon in the nav or save any changes to your project files to re-run your project.

## Debug

Click the debug icon in the nav to open the VSCode Dev Tools panel, which is just like the one in Chrome.

## View on Mobile

Click the mobile icon in nav to generate a QR code. Scan it with your phone camera's to run your project with your phone's web browser!

## View in Browser

Click the browser icon in the nav to open your project in your default web browser.

## Command Palette Usage

Alternatively, you can use the VSCode command palette, open with `Ctrl+Shift+P` or `Cmd+Shift+P`, and start by typing `p5play`.

Available commands:

- "p5play: New Project"

## Development

Run and debug the extension using Visual Studio Code.

To package the extension, run `vsce package` and then `vsce publish` in the terminal.
