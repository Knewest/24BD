const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, '24BDICO.ico')
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/*
# Version 1.1 of 24BD
# Copyright (Boost Software License 1.0) 2023-2023 Knew
# Link to software: https://github.com/Knewest/24BD
*/