import { spawnSync } from "node:child_process";

const compose = "docker compose -f docker-compose.e2e.yml";

function run(command) {
  const result = spawnSync(command, { shell: true, stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`命令执行失败：${command}`);
}

try {
  run(`${compose} down -v --remove-orphans`);
  run(`${compose} up -d --build`);
  run("npx playwright test");
} finally {
  spawnSync(`${compose} down -v --remove-orphans`, { shell: true, stdio: "inherit", env: process.env });
}
