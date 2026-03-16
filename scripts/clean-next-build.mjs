import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const nextDir = ".next";

if (!existsSync(nextDir)) {
  process.exit(0);
}

const keep = new Set(["cache", "dev"]);

for (const entry of readdirSync(nextDir)) {
  if (keep.has(entry)) {
    continue;
  }

  rmSync(join(nextDir, entry), {
    recursive: true,
    force: true,
  });
}
