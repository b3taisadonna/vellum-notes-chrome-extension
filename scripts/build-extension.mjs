import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "extension");
const output = resolve(root, "dist/chrome-extension");
const zip = resolve(root, "dist/vellum-notes-chrome.zip");

if (!existsSync(source)) throw new Error("extension/ is missing");
mkdirSync(resolve(root, "dist"), { recursive: true });
rmSync(output, { recursive: true, force: true });
rmSync(zip, { force: true });
cpSync(source, output, { recursive: true });
execFileSync("zip", ["-qr", zip, "."], { cwd: output, stdio: "inherit" });
console.log(`Chrome extension folder: ${output}`);
console.log(`Chrome Web Store package: ${zip}`);
