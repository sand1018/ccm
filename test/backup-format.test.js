import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import BackupManager from "../src/commands/backup/backup.js";

test("BackupManager 以二进制安全的 base64 格式采集文件", async () => {
  const manager = new BackupManager();
  const tempFile = path.join(os.tmpdir(), "ccm-binary-test.bin");

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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-claude-import-"));
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

test("BackupManager 会在 Gemini 类别中收集 GEMINI.md 的 @ 导入文件", async () => {
  const manager = new BackupManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-gemini-import-"));
  const importedFile = path.join(tempDir, "persona.md");
  const geminiFile = path.join(tempDir, "GEMINI.md");

  await fs.writeFile(importedFile, "# persona");
  await fs.writeFile(geminiFile, `请遵循 @${path.basename(importedFile)}`);

  try {
    const entries = await manager.collectReferencedEntries("geminiCli", {
      key: "gemini.globalInstructions",
      type: "file",
      path: geminiFile,
      required: false,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, importedFile);
    assert.equal(entries[0].key, "gemini.globalInstructions.import");
    assert.equal(entries[0].relativePath, path.basename(importedFile));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("BackupManager 会解析 Codex config.toml 中的外链文件", async () => {
  const manager = new BackupManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-codex-ref-"));
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

test("BackupManager 生成的备份文件名使用 ccm 前缀", () => {
  const manager = new BackupManager();

  const fileName = manager.generateBackupFileName(["codex"]);

  assert.match(fileName, /^ccm-codex-\d{8}-\d{6}\.json$/);
});
