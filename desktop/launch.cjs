const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const electronBin = require("electron");

const port = process.env.ATTENTION_LOOP_PORT || "5174";
const host = "127.0.0.1";
const url = process.env.ATTENTION_LOOP_URL || `http://${host}:${port}/?desktop=mini`;
const viteBin = path.join(__dirname, "..", "node_modules", "vite", "bin", "vite.js");

let devServer;
let electronApp;

function isUp() {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(700, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    if (await isUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`AttentionLoop did not start on ${host}:${port}`);
}

async function start() {
  const alreadyRunning = await isUp();
  if (!alreadyRunning) {
    devServer = spawn(process.execPath, [viteBin, "--host", host, "--port", port], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: false,
    });
    await waitForServer();
  }

  electronApp = spawn(electronBin, [path.join(__dirname, "main.cjs")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ATTENTION_LOOP_URL: url },
    stdio: "ignore",
    shell: false,
  });

  electronApp.on("exit", (code) => {
    if (devServer) devServer.kill();
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  if (electronApp) electronApp.kill();
  if (devServer) devServer.kill();
  process.exit(0);
});

start().catch((error) => {
  console.error(error.message);
  if (devServer) devServer.kill();
  process.exit(1);
});
