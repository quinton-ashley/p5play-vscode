import * as vscode from "vscode";
import { existsSync, writeFileSync, readFileSync } from "fs";
import * as path from "path";


const Uri = vscode.Uri;
const vsfs = vscode.workspace.fs;

export async function activate(context: vscode.ExtensionContext) {
  updateJSConfig(context);

  let createProject = vscode.commands.registerCommand(
    "p5play-vscode.setupProject",
    async () => {
      try {
        let filePath = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
        });
        if (filePath) {
          const dest = filePath[0].path;
          await copyTemplate(dest);
          const destUri = Uri.file(dest);

          // open a workspace folder in a new window
          await vscode.commands.executeCommand("vscode.openFolder", destUri, true);

          // hacky way to actually open the sketch file...
          if (process.platform !== "win32") {
            const sketchFile = Uri.parse(
              `vscode://file${Uri.joinPath(destUri, "sketch.js").path}`
            );
            await vscode.env.openExternal(sketchFile);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  );
context.subscriptions.push(createProject);
  }

async function copyTemplate(dest: string) {
  const paths: string[] = [
    "index.html",
    "style.css",
    "sketch.js",
    "libraries/p5.min.js",
    "libraries/p5.sound.min.js",
  ];

  const baseSrc = Uri.joinPath(Uri.file(__dirname), "../template");

  const baseDest = Uri.file(dest);
  vsfs.createDirectory(baseDest);

  // create the libraries directory
  const librariesPath = Uri.joinPath(baseDest, "libraries");
  vsfs.createDirectory(librariesPath);

  // copy over all the files
  for (const p of paths) {
    const src = Uri.joinPath(baseSrc, p);
    const dest = Uri.joinPath(baseDest, p);

    if (existsSync(dest.path)) {
      continue;
    }

    try {
      await vsfs.copy(src, dest, { overwrite: false });
    } catch (e) {
      console.error(e);
    }
  }

  // creates a jsonconfig that tells vscode where to find the types file
  const jsconfig = {
    "compilerOptions": {
      "target": "es6",
    },
    include: [
      "*.js",
      "**/*.js",
      Uri.joinPath(Uri.file(__dirname), "../p5types", "global.d.ts").fsPath,
    ],
  };
  const jsconfigPath = Uri.joinPath(baseDest, "jsconfig.json");
  writeFileSync(jsconfigPath.fsPath, JSON.stringify(jsconfig, null, 2));
}

async function updateJSConfig(context: vscode.ExtensionContext) {
  const workspacePath = vscode.workspace.rootPath;
  if (!workspacePath) {
    return false;
  }
  const jsconfigPath = path.join(workspacePath, "jsconfig.json");
  if (!existsSync(jsconfigPath)) {
    return false;
  }
  let jsconfigContents = readFileSync(jsconfigPath, "utf-8");
  const extensionName = context.extension.id;
  const currentName = extensionName + "-" + context.extension.packageJSON.version;
  const regex = new RegExp(extensionName + "-[0-9.]+", "m");
  if (regex.test(jsconfigContents)) {
    jsconfigContents = jsconfigContents.replace(regex, currentName);
    writeFileSync(jsconfigPath, jsconfigContents);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {

}
