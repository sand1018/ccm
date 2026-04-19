import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("备份清单覆盖必要的全局 Claude 和 Codex 路径", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  const claudeEntries = manifest.categories.claudeCode.entries.map(
    (entry) => entry.path
  );
  const codexEntries = manifest.categories.codex.entries.map((entry) => entry.path);

  assert.ok(claudeEntries.includes("~/.claude/config.json"));
  assert.ok(codexEntries.includes("~/.codex/AGENTS.override.md"));
  assert.ok(codexEntries.includes("~/.codex/prompts"));
  assert.ok(codexEntries.includes("~/.agents/skills"));
});

test("备份清单使用稳定的逻辑 key 作为恢复主键", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  const claudeKeys = manifest.categories.claudeCode.entries.map((entry) => entry.key);
  const codexKeys = manifest.categories.codex.entries.map((entry) => entry.key);

  assert.ok(claudeKeys.includes("claude.config"));
  assert.ok(claudeKeys.includes("claude.globalInstructions"));
  assert.ok(codexKeys.includes("codex.config"));
  assert.ok(codexKeys.includes("codex.agentsOverride"));
  assert.ok(codexKeys.includes("shared.agentSkills"));
});
