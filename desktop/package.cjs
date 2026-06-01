const path = require("node:path");
const { packager } = require("@electron/packager");

const root = path.join(__dirname, "..");

packager({
  dir: root,
  name: "AttentionLoop",
  platform: "win32",
  arch: "x64",
  out: path.join(root, "release"),
  overwrite: true,
  prune: true,
  asar: true,
  ignore: [
    /^\/\.attention-loop($|\/)/,
    /^\/\.git($|\/)/,
    /^\/release($|\/)/,
  ],
})
  .then((paths) => {
    for (const outputPath of paths) console.log(outputPath);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
