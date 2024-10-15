const vscode = require('vscode');
const Uri = vscode.Uri;
const vsfs = vscode.workspace.fs;

const os = require('os');
const liveServer = require('live-server');

let port = 5555;

const log = console.log;

let panel;

function getLocalNetworkIPAddress() {
	const interfaces = os.networkInterfaces();

	// Prioritize local network Ethernet and Wi-Fi interfaces
	const preferredInterfaces = ['en0', 'en1', 'en2', 'eth0', 'eth1', 'eth2'];

	for (const connection of preferredInterfaces) {
		if (interfaces[connection]) {
			for (const iface of interfaces[connection]) {
				if (iface.family === 'IPv4' && !iface.internal) {
					return iface.address;
				}
			}
		}
	}

	// Fallback to any other active interface
	for (const connection in interfaces) {
		for (const iface of interfaces[connection]) {
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
		return;
	}

	const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

	const maxAttempts = 10; // Maximum number of ports to try
	let attempts = 0;

	function tryStartServer(port) {
		return new Promise((resolve, reject) => {
			const params = {
				port,
				root: workspaceFolder,
				open: false, // don't open in the browser
				ignore: 'node_modules',
				file: 'index.html',
				wait: 0 // wait time before reloading
			};

			liveServer
				.start(params)
				.on('listening', () => {
					resolve(port);
				})
				.on('error', (err) => {
					reject(err);
				});
		});
	}

	while (attempts < maxAttempts) {
		try {
			await tryStartServer(port);
			return;
		} catch (err) {
			attempts++;
			port++;
		}
	}

	vscode.window.showErrorMessage('Failed to start live server on any port.');
}

async function openTab() {
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
		// 'android',
		// 'app-store-ios',
		// 'apple',
		// 'book-open',
		'bug-report',
		'create-new-folder',
		'display',
		// 'folder-open',
		// 'google-play',
		// 'hammer',
		// 'language',
		'mobile-screen-button',
		'play',
		// 'share-from-square',
		// 'stop'
		'refresh'
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
			case 'openInBrowser':
				// open the live server link in the default browser
				const url = 'http://127.0.0.1:' + port;
				await vscode.env.openExternal(vscode.Uri.parse(url));
				break;
			case 'openDevTools':
				vscode.commands.executeCommand('workbench.action.toggleDevTools');
				break;
		}
	});

	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
		panel.webview.postMessage({ command: 'workspaceIsEmpty' });
	}
}

function activate(context) {
	let cmd = vscode.commands.registerCommand('p5play-vscode.newProject', newProject);
	context.subscriptions.push(cmd);

	cmd = vscode.commands.registerCommand('p5play-vscode.openEditor', openTab);
	context.subscriptions.push(cmd);

	// for testing, remove this line to disable auto-open
	// vscode.commands.executeCommand('p5play-vscode.openEditor');

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
	statusBar.text = '$(game) p5play';
	statusBar.tooltip = 'Click to open the p5play sidebar.';
	statusBar.command = 'p5play-vscode.openEditor';
	statusBar.show();

	context.subscriptions.push(statusBar);
}

function deactivate() {
	if (panel) panel.dispose();
	if (serverStarted) liveServer.shutdown();
}

module.exports = {
	activate,
	deactivate
};
