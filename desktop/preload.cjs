const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("attentionLoopStorage", {
  load: () => ipcRenderer.invoke("attention-loop:load"),
  save: (deck) => ipcRenderer.invoke("attention-loop:save", deck),
  clear: () => ipcRenderer.invoke("attention-loop:clear"),
});
