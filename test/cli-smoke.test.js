import fs from "fs-extra";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const cliEntry = path.join(repoRoot, "bin", "cc.js");

function runCli(args, envOverrides = {}) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
}

test("CLI smoke: geminiapi --help 可正常显示帮助", () => {
  const result = runCli(["geminiapi", "--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Gemini 配置管理/);
  assert.match(result.stdout, /ccm geminiapi --list/);
});

test("CLI smoke: api --help 可正常显示帮助", () => {
  const result = runCli(["api", "--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Claude Code 配置管理/);
  assert.match(result.stdout, /ccm api --list/);
});

test("CLI smoke: codexapi --help 可正常显示帮助", () => {
  const result = runCli(["codexapi", "--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Codex 配置管理工具帮助/);
  assert.match(result.stdout, /ccm codexapi --official/);
});

test("CLI smoke: update --help 可正常显示帮助", () => {
  const result = runCli(["update", "--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /CCM 更新工具帮助/);
  assert.match(result.stdout, /ccm update --check/);
});

test("CLI smoke: 空配置环境下 status 可正常返回", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-cli-status-"));

  try {
    const result = runCli(["status"], {
      HOME: tempHome,
      USERPROFILE: tempHome,
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /当前没有配置|未配置/);
    assert.match(result.stdout, /ccm api/);
    assert.match(result.stdout, /ccm codexapi/);
    assert.match(result.stdout, /ccm geminiapi/);
  } finally {
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});
