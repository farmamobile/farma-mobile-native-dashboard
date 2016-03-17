'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
const app = electron.app;
const nativeImage = electron.nativeImage;
const appMenu = require('./menu');
const storage = require('./storage');
const createTray = require('./tray');
const utils = require('./utils');

require('electron-debug')();
require('electron-dl')();

let mainWindow;
let appTray;
let isQuitting = false;

function updateBadge(title) {
	if (!app.dock) {
		return;
	}

	let messageCountMatcher = (/^\(([0-9]+)\)/).exec(title);
	app.messageCount = +(messageCountMatcher ? messageCountMatcher[1] : 0);
	setBadgeCounter(app.messageCount);

	if (appTray) {
		let trayImgs = (app.messageCount > 0) ? utils.ICONS.trayNew : utils.ICONS.tray;
		let trayImgPath = path.join(__dirname, 'media', trayImgs[process.platform]);
		appTray.setImage(nativeImage.createFromPath(trayImgPath));
	}
}

function setBadgeCounter(count) {
	var text = (count > 0) ? count.toString() : '';

	if (process.platform === 'darwin') {
		app.dock.setBadge(text);
	} else if (process.platform === 'win32') {
		var win = remote.getCurrentWindow();

    if (text === '') {
      win.setOverlayIcon(null, '');
      return;
    }

    // Create badge
    var canvas = document.createElement('canvas');
    canvas.height = 140;
    canvas.width = 140;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.ellipse(70, 70, 70, 70, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    if (text.length > 2) {
      ctx.font = '75px sans-serif';
      ctx.fillText(text, 70, 98);
    } else if (text.length > 1) {
      ctx.font = '100px sans-serif';
      ctx.fillText(text, 70, 105);
    } else {
      ctx.font = '125px sans-serif';
      ctx.fillText(text, 70, 112);
    }

    var badgeDataURL = canvas.toDataURL();
    var img = nativeImage.createFromDataUrl(badgeDataURL);

    win.setOverlayIcon(img, text);
	}
}

function createMainWindow() {
	const lastWindowState = storage.get('lastWindowState') || {width: 1200, height: 900};

	const win = new electron.BrowserWindow({
		title: app.getName(),
		show: false,
		x: lastWindowState.x,
		y: lastWindowState.y,
		width: lastWindowState.width,
		height: lastWindowState.height,
		icon: process.platform === 'linux' && path.join(__dirname, 'media', 'Icon.png'),
		minWidth: 800,
		minHeight: 600,
		titleBarStyle: 'hidden-inset',
		webPreferences: {
			// fails without this because of CommonJS script detection
			nodeIntegration: false,
			preload: path.join(__dirname, 'browser.js'),
			// required for Facebook active ping thingy
			webSecurity: false,
			plugins: true
		}
	});

	win.loadURL('http://painel.farmamobile.com.br/');

	win.on('close', e => {
		if (!isQuitting) {
			e.preventDefault();

			if (process.platform === 'darwin') {
				app.hide();
			} else {
				win.hide();
			}
		}
	});

	win.on('page-title-updated', (e, title) => updateBadge(title));

	return win;
}

app.on('ready', () => {
	electron.Menu.setApplicationMenu(appMenu);
	mainWindow = createMainWindow();
	appTray = createTray(mainWindow);

	const page = mainWindow.webContents;

	page.on('dom-ready', () => {
		page.insertCSS(fs.readFileSync(path.join(__dirname, 'browser.css'), 'utf8'));
		mainWindow.show();
	});

	page.on('new-window', (e, url) => {
		e.preventDefault();
		electron.shell.openExternal(url);
	});
});

app.on('activate', () => {
	mainWindow.show();
});

app.on('before-quit', () => {
	isQuitting = true;

	if (!mainWindow.isFullScreen()) {
		storage.set('lastWindowState', mainWindow.getBounds());
	}
});
