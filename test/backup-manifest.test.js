import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("备份清单覆盖必要的全局 Claude、Codex、Cursor 和 Gemini 路径", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  const claudeEntries = manifest.categories.claudeCode.entries.map(
    (entry) => entry.path
  );
  const codexEntries = manifest.categories.codex.entries.map((entry) => entry.path);
  const cursorEntries = manifest.categories.cursor.entries.map((entry) => entry.path);
  const geminiEntries = manifest.categories.geminiCli.entries.map((entry) => entry.path);

  assert.ok(claudeEntries.includes("~/.claude/config.json"));
  assert.ok(claudeEntries.includes("~/.claude.json"));
  assert.ok(claudeEntries.includes("~/.claude/hooks"));
  assert.ok(codexEntries.includes("~/.codex/hooks.json"));
  assert.ok(codexEntries.includes("~/.codex/hooks"));
  assert.ok(codexEntries.includes("~/.codex/AGENTS.override.md"));
  assert.ok(codexEntries.includes("~/.codex/prompts"));
  assert.ok(codexEntries.includes("~/.codex/agents"));
  assert.ok(codexEntries.includes("~/.agents/skills"));
  assert.ok(codexEntries.includes("~/.agent/skills"));
  assert.ok(codexEntries.includes("~/.agent/workflows"));
  assert.ok(cursorEntries.includes("~/.cursor/hooks.json"));
  assert.ok(cursorEntries.includes("~/.cursor/commands"));
  assert.ok(cursorEntries.includes("~/.cursor/skills"));
  assert.ok(cursorEntries.includes("~/.cursor/agents"));
  assert.ok(cursorEntries.includes("~/.cursor/hooks"));
  assert.ok(cursorEntries.includes("~/.cursor/rules"));
  assert.ok(geminiEntries.includes("~/.gemini/settings.json"));
  assert.ok(geminiEntries.includes("~/.gemini/hooks"));
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
  const cursorKeys = manifest.categories.cursor.entries.map((entry) => entry.key);
  const geminiKeys = manifest.categories.geminiCli.entries.map((entry) => entry.key);

  assert.ok(claudeKeys.includes("claude.config"));
  assert.ok(claudeKeys.includes("claude.mcpUserConfig"));
  assert.ok(claudeKeys.includes("claude.globalInstructions"));
  assert.ok(claudeKeys.includes("claude.hooks"));
  assert.ok(codexKeys.includes("codex.config"));
  assert.ok(codexKeys.includes("codex.hooksConfig"));
  assert.ok(codexKeys.includes("codex.hooks"));
  assert.ok(codexKeys.includes("codex.agentsOverride"));
  assert.ok(codexKeys.includes("codex.subAgents"));
  assert.ok(codexKeys.includes("shared.agentSkills"));
  assert.ok(codexKeys.includes("shared.dotAgentSkills"));
  assert.ok(codexKeys.includes("shared.dotAgentWorkflows"));
  assert.ok(cursorKeys.includes("cursor.hooksConfig"));
  assert.ok(cursorKeys.includes("cursor.commands"));
  assert.ok(cursorKeys.includes("cursor.skills"));
  assert.ok(cursorKeys.includes("cursor.agents"));
  assert.ok(cursorKeys.includes("cursor.hooks"));
  assert.ok(cursorKeys.includes("cursor.rules"));
  assert.ok(geminiKeys.includes("gemini.settings"));
  assert.ok(geminiKeys.includes("gemini.hooks"));
  assert.ok(geminiKeys.includes("gemini.globalInstructions"));
  assert.ok(geminiKeys.includes("gemini.antigravityConfig"));
  assert.ok(geminiKeys.includes("gemini.antigravitySkills"));
  assert.ok(geminiKeys.includes("gemini.antigravityGlobalWorkflows"));
});

test("备份清单中的 CCM 类别使用 ccm 作为逻辑 key", () => {
  const raw = fs.readFileSync(
    new URL("../src/commands/backup/backup-manifest.json", import.meta.url),
    "utf8"
  );
  const manifest = JSON.parse(raw);

  assert.equal(manifest.categories.ccm.name, "CCM配置");
  assert.equal(manifest.categories.ccm.entries[0].key, ".ccm");
  assert.equal(manifest.categories.ccm.entries[0].path, "~/.ccm");
});
