import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standaloneDir = resolve(root, ".next", "standalone");
const standaloneNextDir = resolve(standaloneDir, ".next");
const staticSourceDir = resolve(root, ".next", "static");
const staticTargetDir = resolve(standaloneNextDir, "static");
const publicSourceDir = resolve(root, "public");
const publicTargetDir = resolve(standaloneDir, "public");

if (!existsSync(standaloneDir)) {
  throw new Error("No existe .next/standalone. Ejecuta next build antes de preparar el bundle.");
}

mkdirSync(standaloneNextDir, { recursive: true });

if (existsSync(staticSourceDir)) {
  cpSync(staticSourceDir, staticTargetDir, { recursive: true });
}

if (existsSync(publicSourceDir)) {
  cpSync(publicSourceDir, publicTargetDir, { recursive: true });
}

console.log("Standalone assets preparados correctamente");
