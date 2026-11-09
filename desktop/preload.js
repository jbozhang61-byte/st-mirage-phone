const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mpDesktop', {
  isDesktop: true,
  onBridgeState(callback) {
    ipcRenderer.on('mp-bridge-state', (_event, state) => callback(state));
  },
  requestBridgeState() {
    ipcRenderer.send('mp-bridge-request');
  },
});
