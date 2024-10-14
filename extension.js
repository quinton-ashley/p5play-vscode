const vscode = require('vscode');
const Uri = vscode.Uri;
const vsfs = vscode.workspace.fs;

const os = require('os');
const liveServer = require('live-server');

const log = console.log;

let panel;

function getLocalNetworkIPAddress() {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
	return '0.0.0.0';
}

async function newProject() {
	try {
		// Prompt the user for a new folder name
		const folderName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the new p5play project folder',
			validateInput: (text) => (text.trim() === '' ? 'Folder name cannot be empty' : null)
		});
		if (!folderName) return;

		// Prompt the user to select a folder
		let filePath = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			message: 'Select a destination folder for the new project'
		});
		if (!filePath) return;

		const dest = Uri.joinPath(Uri.file(filePath[0].path), folderName);
		await vscode.workspace.fs.createDirectory(dest);

		const src = Uri.joinPath(Uri.file(__dirname), 'p5play-template');

		const success = await copyDirectory(src, dest);
		if (!success) {
			vscode.window.showErrorMessage('Error copying directory.');
		}

		// Open the new project folder in a new window
		await vscode.commands.executeCommand('vscode.openFolder', dest, true);

		// Hacky way to actually open the sketch file...
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

let serverStarted = false;

async function startLiveServer() {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder is open.');
		return;
	}

	const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

	const params = {
		port: 5555,
		root: workspaceFolder,
		open: false, // don't open in the browser
		ignore: 'node_modules',
		file: 'index.html',
		wait: 0 // wait time before reloading
	};

	liveServer.start(params);
	vscode.window.showInformationMessage(`Live server started at ${workspaceFolder}`);
}

async function openEditor() {
	if (!serverStarted) await startLiveServer();

	panel = vscode.window.createWebviewPanel('p5play', 'p5play', vscode.ViewColumn.Two, {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.file(__dirname)]
	});

	const htmlPath = Uri.file(__dirname + '/editor/index.html');
	let html = await vsfs.readFile(htmlPath);
	html = Buffer.from(html).toString('utf8');

	// get sandboxed file path
	function getSource(file) {
		const path = Uri.file(__dirname + '/editor/' + file);
		return panel.webview.asWebviewUri(path);
	}
	function importHTML(file, fileToReplace) {
		html = html.replaceAll(fileToReplace || file, getSource(file));
	}

	html = html.replace('<link rel="stylesheet" href="icons.css">', '');

	importHTML('editor.css');
	importHTML('editor.js');
	importHTML('../node_modules/@bitjson/qr-code/dist/qr-code.js');
	importHTML('../assets/p5play_icon.png');
	importHTML('../assets/p5play_logo.svg');

	const cssPath = Uri.file(__dirname + '/editor/icons.css');
	let style = await vsfs.readFile(cssPath);
	style = Buffer.from(style).toString('utf8');
	function importStyle(file, fileToReplace) {
		style = style.replace(fileToReplace || file, getSource(file));
	}

	let svgFiles = [
		'create-new-folder',
		// 'android',
		// 'book-open',
		// 'google-play',
		'mobile-screen-button',
		// 'stop',
		// 'app-store-ios',
		// 'display',
		// 'hammer',
		'play'
		// 'apple',
		// 'folder-open',
		// 'language',
		// 'share-from-square'
	];

	for (const file of svgFiles) {
		importStyle('icons/' + file + '.svg');
	}

	let globals = `
<script>
window.ipAddress = '${getLocalNetworkIPAddress()}';
</script>`;

	const startOfHead = html.indexOf('<head>') + 6;
	html = html.slice(0, startOfHead) + '<style>' + style + '</style>' + globals + html.slice(startOfHead);

	panel.webview.html = html;

	// Listen for messages from the webview
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case 'newProject':
				await newProject();
				break;
		}
	});

	if (vscode.workspace.workspaceFolders?.length == 0) {
		panel.webview.postMessage({ command: 'workspaceIsEmpty' });

		// Listen for workspace folder changes
		vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			if (vscode.workspace.workspaceFolders?.length > 0) {
				panel.webview.postMessage({ command: 'workspaceHasFolder' });
			}
		});
	}
}

function activate(context) {
	let cmd = vscode.commands.registerCommand('p5play-vscode.newProject', newProject);
	context.subscriptions.push(cmd);

	cmd = vscode.commands.registerCommand('p5play-vscode.openEditor', openEditor);
	context.subscriptions.push(cmd);

	// TODO: remove this line to disable auto-open
	vscode.commands.executeCommand('p5play-vscode.openEditor');

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
	statusBar.text = '$(game) p5play';
	statusBar.tooltip = 'Click to open the p5play sidebar.';
	statusBar.command = 'p5play-vscode.openEditor';
	statusBar.show();

	context.subscriptions.push(statusBar);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
