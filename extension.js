const vscode = require('vscode');
const Uri = vscode.Uri;
const vsfs = vscode.workspace.fs;

const log = console.log;

let panel;

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

async function openEditor() {
	panel = vscode.window.createWebviewPanel('p5play', 'p5play Editor', vscode.ViewColumn.Two, {});

	const htmlPath = Uri.file(__dirname + '/editor/index.html');
	let html = await vsfs.readFile(htmlPath);
	html = Buffer.from(html).toString('utf8');

	const cssPath = Uri.file(__dirname + '/editor/editor.css');
	let style = await vsfs.readFile(cssPath);
	style = Buffer.from(style).toString('utf8');

	// get sandboxed file path
	function getSource(file) {
		const path = Uri.file(__dirname + '/editor/' + file);
		return panel.webview.asWebviewUri(path);
	}
	function importHTML(file, fileToReplace) {
		html = html.replace(fileToReplace || file, getSource(file));
	}

	function importStyle(file, fileToReplace) {
		style = style.replace(fileToReplace || file, getSource(file));
	}

	importHTML('../icon.png', '../assets/favicon.png');
	importHTML('../assets/p5play_logo.svg');

	let svgFiles = [
		'android',
		'book-open',
		'google-play',
		'mobile-screen-button',
		'stop',
		'app-store-ios',
		'display',
		'hammer',
		'play',
		'apple',
		'folder-open',
		'language',
		'share-from-square'
	];

	for (const file of svgFiles) {
		importStyle('icons/' + file + '.svg');
	}

	const startOfHead = html.indexOf('<head>') + 6;
	html = html.slice(0, startOfHead) + '<style>' + style + '</style>' + html.slice(startOfHead);

	panel.webview.html = html;
}

function activate(context) {
	let cmd = vscode.commands.registerCommand('p5play-vscode.newProject', newProject);
	context.subscriptions.push(cmd);

	cmd = vscode.commands.registerCommand('p5play-vscode.openEditor', openEditor);
	context.subscriptions.push(cmd);

	// TODO: remove this line to disable auto-open
	vscode.commands.executeCommand('p5play-vscode.openEditor'); // Remove this line to disable auto-open

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
	statusBar.text = 'p5play';
	statusBar.tooltip = 'Edit your p5play project.';
	statusBar.command = 'p5play-vscode.openEditor';
	statusBar.show();

	context.subscriptions.push(statusBar);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
