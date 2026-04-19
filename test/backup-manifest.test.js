import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("备份清单覆盖必要的全局 Claude、Codex 和 Gemini 路径", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  const claudeEntries = manifest.categories.claudeCode.entries.map(
    (entry) => entry.path
  );
  const codexEntries = manifest.categories.codex.entries.map((entry) => entry.path);
  const geminiEntries = manifest.categories.geminiCli.entries.map((entry) => entry.path);

  assert.ok(claudeEntries.includes("~/.claude/config.json"));
  assert.ok(codexEntries.includes("~/.codex/AGENTS.override.md"));
  assert.ok(codexEntries.includes("~/.codex/prompts"));
  assert.ok(codexEntries.includes("~/.agents/skills"));
  assert.ok(geminiEntries.includes("~/.gemini/settings.json"));
  assert.ok(geminiEntries.includes("~/.gemini/.env"));
  assert.ok(geminiEntries.includes("~/.gemini/antigravity/mcp_config.json"));
  assert.ok(geminiEntries.includes("~/.gemini/antigravity/skills"));
  assert.ok(geminiEntries.includes("~/.gemini/antigravity/workflows"));
  assert.ok(geminiEntries.includes("~/.gemini/antigravity/global_workflows"));
});

test("备份清单使用稳定的逻辑 key 作为恢复主键", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  const claudeKeys = manifest.categories.claudeCode.entries.map((entry) => entry.key);
  const codexKeys = manifest.categories.codex.entries.map((entry) => entry.key);
  const geminiKeys = manifest.categories.geminiCli.entries.map((entry) => entry.key);

  assert.ok(claudeKeys.includes("claude.config"));
  assert.ok(claudeKeys.includes("claude.globalInstructions"));
  assert.ok(codexKeys.includes("codex.config"));
  assert.ok(codexKeys.includes("codex.agentsOverride"));
  assert.ok(codexKeys.includes("shared.agentSkills"));
  assert.ok(geminiKeys.includes("gemini.settings"));
  assert.ok(geminiKeys.includes("gemini.globalInstructions"));
  assert.ok(geminiKeys.includes("gemini.antigravityConfig"));
  assert.ok(geminiKeys.includes("gemini.antigravitySkills"));
  assert.ok(geminiKeys.includes("gemini.antigravityGlobalWorkflows"));
});

test("备份清单中的 CCM 类别使用新的目录与名称", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  assert.equal(manifest.categories.ccCli.name, "CCM配置");
  assert.equal(manifest.categories.ccCli.entries[0].key, ".ccm");
  assert.equal(manifest.categories.ccCli.entries[0].path, "~/.ccm");
});
