const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// AIのセットアップ (APIキーはIPC経由で受け取るため、ここでは初期化しない)
let genAI;
let model;

function initializeAI(apiKey) {
    if (!apiKey) {
        console.log('APIキーが提供されていないため、AIの初期化をスキップします。');
        return;
    }
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        console.log('AIの初期化が完了しました。');
    } catch (error) {
        console.error('AIの初期化中にエラー:', error);
        genAI = null;
        model = null;
    }
}

// --- IPCハンドラ ---
ipcMain.handle('ai:chat', async (event, { apiKey, message }) => {
    initializeAI(apiKey || process.env.GOOGLE_API_KEY);
    if (!model) return 'エラー: AIが初期化されていません。設定画面で有効なAPIキーを登録してください。';
    
    try {
        const result = await model.generateContent(message);
        return (await result.response).text();
    } catch (error) {
        console.error("AIとの通信でエラー:", error);
        return 'AIとの通信中にエラーが発生しました。APIキーが正しいか確認してください。';
    }
});

ipcMain.handle('ai:summarizeFile', async (event, { apiKey, filePath }) => {
    initializeAI(apiKey || process.env.GOOGLE_API_KEY);
    if (!model) return 'エラー: AIが初期化されていません。設定画面で有効なAPIキーを登録してください。';

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const prompt = `以下の文章を日本語で3行程度に要約してください。\n\n---\n${content}`;
        const result = await model.generateContent(prompt);
        return (await result.response).text();
    } catch (error) {
        console.error('ファイルの要約中にエラー:', error);
        return 'ファイルの要約中にエラーが発生しました。';
    }
});

ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
        new Notification({ title, body, icon: path.join(__dirname, 'assets/icon.png') }).show();
    }
});

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (!canceled && filePaths.length > 0) {
        return { path: filePaths[0], name: path.basename(filePaths[0]) };
    }
    return null;
});

ipcMain.on('shell:openPath', (event, filePath) => {
    shell.openPath(filePath).catch(err => console.error("Failed to open path:", err));
});

ipcMain.handle('data:export', async (event, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'データをエクスポート',
        defaultPath: `study-app-backup-${Date.now()}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!canceled && filePath) {
        try {
            fs.writeFileSync(filePath, data);
            return { success: true, path: filePath };
        } catch (error) {
            console.error('エクスポートエラー:', error);
            return { success: false, error: error.message };
        }
    }
    return { success: false };
});

ipcMain.handle('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'データをインポート',
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!canceled && filePaths.length > 0) {
        try {
            const data = fs.readFileSync(filePaths[0], 'utf-8');
            return { success: true, data: data };
        } catch (error) {
            console.error('インポートエラー:', error);
            return { success: false, error: error.message };
        }
    }
    return { success: false };
});

// --- ウィンドウ作成とアプリのライフサイクル ---
const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    win.loadFile('index.html');
};

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});