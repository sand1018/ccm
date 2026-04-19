import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import BackupManager from "../src/commands/backup/backup.js";

test("BackupManager 以二进制安全的 base64 格式采集文件", async () => {
  const manager = new BackupManager();
  const tempFile = path.join(os.tmpdir(), "cc-cli-binary-test.bin");

  await fs.writeFile(tempFile, Buffer.from([0, 255, 10, 20]));

  try {
    const entry = await manager.collectFileEntry({
      key: "temp",
      type: "file",
      path: tempFile,
      required: true,
    });

    assert.equal(entry.encoding, "base64");
    assert.equal(Buffer.from(entry.contentBase64, "base64")[1], 255);
    assert.equal(entry.size, 4);
  } finally {
    await fs.rm(tempFile, { force: true });
  }
});

test("BackupManager 会解析 CLAUDE.md 中的 @ 导入文件", async () => {
  const manager = new BackupManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-cli-claude-import-"));
  const importedFile = path.join(tempDir, "rules.md");
  const claudeFile = path.join(tempDir, "CLAUDE.md");

  await fs.writeFile(importedFile, "# rules");
  await fs.writeFile(claudeFile, `请阅读 @${path.basename(importedFile)}`);

  try {
    const entries = await manager.extractClaudeImportedFiles(claudeFile);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, importedFile);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("BackupManager 会解析 Codex config.toml 中的外链文件", async () => {
  const manager = new BackupManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-cli-codex-ref-"));
  const instructionsFile = path.join(tempDir, "instructions.md");
  const skillFile = path.join(tempDir, "skill.toml");
  const configFile = path.join(tempDir, "config.toml");

  await fs.writeFile(instructionsFile, "hello");
  await fs.writeFile(skillFile, "name = \"demo\"");
  await fs.writeFile(
    configFile,
    [
      `model_instructions_file = "${instructionsFile}"`,
      "[skills.config.demo]",
      `path = "${skillFile}"`,
    ].join("\n")
  );

  try {
    const entries = await manager.extractCodexReferencedFiles(configFile);
    assert.equal(entries.length, 2);
    assert.ok(entries.some((entry) => entry.path === instructionsFile));
    assert.ok(entries.some((entry) => entry.path === skillFile));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
