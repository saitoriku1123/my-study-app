const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openPath: (filePath) => ipcRenderer.send('shell:openPath', filePath),
  // AI関連の処理にapiKeyを渡せるように変更
  getAIChatResponse: (apiKey, message) => ipcRenderer.invoke('ai:chat', { apiKey, message }),
  summarizeFile: (apiKey, filePath) => ipcRenderer.invoke('ai:summarizeFile', { apiKey, filePath }),
  showNotification: (options) => ipcRenderer.send('show-notification', options),
  // 新しいIPCを追加
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
});