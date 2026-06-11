const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  minimize: () => ipcRenderer.send('app:minimize'),
  maximize: () => ipcRenderer.send('app:maximize'),
  close: () => ipcRenderer.send('app:close'),

  getLocalApiConfig: () => ipcRenderer.invoke('local-api:get-config'),
  setLocalApiConfig: (config) => ipcRenderer.invoke('local-api:set-config', config),
  generateLocalApiKey: () => ipcRenderer.invoke('local-api:generate-key'),
  onLocalApiCredential: (callback) => {
    const listener = (_event, request) => {
      callback(request)
    }

    ipcRenderer.on('local-api:credential-request', listener)
    return () => ipcRenderer.removeListener('local-api:credential-request', listener)
  },
  sendLocalApiCredentialResult: (result) => {
    ipcRenderer.send('local-api:credential-result', result)
  },

  onLock: (callback) => {
    ipcRenderer.on('app:lock', callback)
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  },
})
