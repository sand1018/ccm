import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import RestoreManager from "../src/commands/backup/restore.js";

function createWindowsPortablePath(...segments) {
  return path.win32.join("C:\\", "Users", "source-user", ...segments);
}

function createPosixPortablePath(...segments) {
  return path.posix.join("/Users", "source-user", ...segments);
}

test("RestoreManager 能区分新旧备份格式", () => {
  const manager = new RestoreManager();

  assert.equal(
    manager.getBackupFormatVersion({ version: "3.0.0", categories: {} }),
    "v3"
  );
  assert.equal(
    manager.getBackupFormatVersion({ version: "2.0.0", categories: {} }),
    "legacy"
  );
});

test("RestoreManager 优先通过逻辑 key 将 Windows portablePath 映射到当前平台", () => {
  const manager = new RestoreManager();
  const currentPaths = manager.fileManager.getCategoryPaths("codex");

  const targetPath = manager.resolveEntryTargetPath(currentPaths, {
    entryType: "file",
    key: "codex.config",
    portablePath: createWindowsPortablePath(".codex", "config.toml"),
    relativePath: "config.toml",
  });

  assert.equal(targetPath, path.join(os.homedir(), ".codex", "config.toml"));
});

test("RestoreManager 能通过逻辑 key 和 relativePath 恢复目录文件", () => {
  const manager = new RestoreManager();
  const currentPaths = manager.fileManager.getCategoryPaths("codex");

  const targetPath = manager.resolveEntryTargetPath(currentPaths, {
    entryType: "file",
    key: "codex.prompts",
    portableRootPath: createPosixPortablePath(".codex", "prompts"),
    relativePath: path.posix.join("team", "welcome.md"),
  });

  assert.equal(
    targetPath,
    path.join(os.homedir(), ".codex", "prompts", "team", "welcome.md")
  );
});
