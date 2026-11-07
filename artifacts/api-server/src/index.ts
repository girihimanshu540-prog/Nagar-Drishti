// Keep the managed API artifact entry point while running the requested FastAPI stack.
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const child = spawn("uv", ["run", "--frozen", "--directory", root, "python", "-m", "api.run"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  process.stderr.write(`FastAPI could not start: ${error.message}\n`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
