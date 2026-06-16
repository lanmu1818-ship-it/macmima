const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  isWindowFocused: () => ipcRenderer.invoke('app:is-window-focused'),
  showNotification: (payload) => ipcRenderer.invoke('app:show-notification', payload),
  getLatestRelease: () => ipcRenderer.invoke('app:getLatestRelease'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getBackendConfig: () => ipcRenderer.invoke('backend-config:get'),
  setBackendConfig: (config) => ipcRenderer.invoke('backend-config:set', config),
  clearBackendConfig: () => ipcRenderer.invoke('backend-config:clear'),
  getCryptoProfile: () => ipcRenderer.invoke('crypto-profile:get'),
  setCryptoProfile: (config) => ipcRenderer.invoke('crypto-profile:set', config),
  generateCryptoSecret: () => ipcRenderer.invoke('crypto-profile:generate-secret'),
  exportCryptoProfileBackup: (config) =>
    ipcRenderer.invoke('crypto-profile:export-backup', config),
  importCryptoProfileBackup: () => ipcRenderer.invoke('crypto-profile:import-backup'),
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
  onNavigate: (callback) => {
    const listener = (_event, route) => {
      callback(route)
    }

    ipcRenderer.on('app:navigate', listener)
    return () => ipcRenderer.removeListener('app:navigate', listener)
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  },
})
