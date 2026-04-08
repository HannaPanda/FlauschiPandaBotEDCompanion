import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, EDState } from './types';

contextBridge.exposeInMainWorld('edApi', {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: AppSettings): Promise<void> => ipcRenderer.invoke('settings:set', s),
  testWs: (url: string, secret: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('settings:test-ws', url, secret),
  detectPath: (): Promise<string> => ipcRenderer.invoke('settings:detect-path'),
  verifyPath: (p: string): Promise<boolean> => ipcRenderer.invoke('settings:verify-path', p),

  // Window controls
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),

  // Event listeners
  onStateUpdate: (cb: (state: EDState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: EDState) => cb(state);
    ipcRenderer.on('ed:state-update', handler);
    return () => ipcRenderer.removeListener('ed:state-update', handler);
  },
  onWsStatus: (cb: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => cb(status);
    ipcRenderer.on('ed:ws-status', handler);
    return () => ipcRenderer.removeListener('ed:ws-status', handler);
  },
});
