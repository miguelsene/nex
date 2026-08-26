const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0A0D16",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "public", "nex-512.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
