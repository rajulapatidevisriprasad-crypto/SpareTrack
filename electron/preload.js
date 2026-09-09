const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:     ()    => ipcRenderer.invoke('get-version'),
  getFlaskStatus: ()    => ipcRenderer.invoke('get-flask-status'),
  openExternal:   (url) => ipcRenderer.send('open-external', url),
  platform:       process.platform,
});
