const { app, BrowserWindow, globalShortcut, ipcMain, Menu, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_URL = "http://127.0.0.1:5174/?desktop=mini";
const deckUrl = process.env.ATTENTION_LOOP_URL || DEFAULT_URL;
const dataDir = path.join(__dirname, "..", ".attention-loop");
const dataFile = path.join(dataDir, "deck.json");

let win;

app.setName("AttentionLoop");

async function readDeckFile() {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeDeckFile(deck) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  return true;
}

async function clearDeckFile() {
  await fs.rm(dataFile, { force: true });
  return true;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 430,
    height: 720,
    minWidth: 340,
    minHeight: 420,
    title: "AttentionLoop",
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f5",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(deckUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) {
    win.hide();
    return;
  }
  win.show();
  win.focus();
}

app.whenReady().then(() => {
  ipcMain.handle("attention-loop:load", readDeckFile);
  ipcMain.handle("attention-loop:save", (_event, deck) => writeDeckFile(deck));
  ipcMain.handle("attention-loop:clear", clearDeckFile);

  createWindow();

  globalShortcut.register("CommandOrControl+Alt+D", toggleWindow);
  globalShortcut.register("CommandOrControl+Alt+F", () => {
    if (!win) return;
    win.show();
    win.focus();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
