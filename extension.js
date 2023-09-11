const vscode = require('vscode');

const Uri = vscode.Uri;
const vsfs = vscode.workspace.fs;

async function newProject() {
	try {
		let filePath = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			message: 'Select an EMPTY or NEW folder'
		});
		if (!filePath) return;

		const dest = Uri.file(filePath[0].path);
		const src = Uri.joinPath(Uri.file(__dirname), 'p5play-template');

		const success = await copyDirectory(src, dest);
		if (!success) {
			vscode.window.showErrorMessage('Error copying directory.');
		}

		// open a workspace folder in a new window
		await vscode.commands.executeCommand('vscode.openFolder', dest, true);

		// hacky way to actually open the sketch file...
		if (process.platform !== 'win32') {
			let sketchFile = Uri.joinPath(dest, 'sketch.js').path;
			sketchFile = Uri.parse('vscode://file' + sketchFile);
			await vscode.env.openExternal(sketchFile);
		}
	} catch (e) {
		console.error(e);
		vscode.window.showErrorMessage(e.message);
	}
}

async function copyDirectory(srcDir, destDir) {
	try {
		const entries = await vsfs.readDirectory(srcDir);

		for (const [entryName, entryType] of entries) {
			const src = Uri.joinPath(srcDir, entryName);
			const dest = Uri.joinPath(destDir, entryName);

			if (entryType === vscode.FileType.File) {
				// Copy a file
				const sourceFileData = await vsfs.readFile(src);
				await vsfs.writeFile(dest, sourceFileData);
			} else if (entryType === vscode.FileType.Directory) {
				// Recursively copy a directory
				await copyDirectory(src, dest);
			}
		}

		return true;
	} catch (error) {
		return false;
	}
}

function activate(context) {
	let cmd = vscode.commands.registerCommand('p5play-vscode.newProject', newProject);
	context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
