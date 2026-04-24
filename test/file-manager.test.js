import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import FileManager from "../src/commands/backup/file-manager.js";

test("FileManager 返回基于清单解析后的 entries", () => {
  const manager = new FileManager();
  const ccm = manager.getCategoryPaths("ccm");
  const codex = manager.getCategoryPaths("codex");
  const cursor = manager.getCategoryPaths("cursor");
  const gemini = manager.getCategoryPaths("geminiCli");

  assert.equal(ccm.name, "CCM配置");
  assert.ok(
    ccm.entries.some(
      (entry) => entry.key === ".ccm" && entry.path === path.join(os.homedir(), ".ccm")
    )
  );
  assert.equal(codex.name, "Codex配置");
  assert.ok(Array.isArray(codex.entries));
  assert.ok(
    manager
      .getCategoryPaths("claudeCode")
      .entries.some(
        (entry) =>
          entry.key === "claude.mcpUserConfig" &&
          entry.path === path.join(os.homedir(), ".claude.json")
      )
  );
  assert.ok(
    manager
      .getCategoryPaths("claudeCode")
      .entries.some(
        (entry) =>
          entry.key === "claude.hooks" &&
          entry.path === path.join(os.homedir(), ".claude", "hooks")
      )
  );
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "codex.agentsOverride" &&
        entry.path === path.join(os.homedir(), ".codex", "AGENTS.override.md")
    )
  );
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "codex.hooksConfig" &&
        entry.path === path.join(os.homedir(), ".codex", "hooks.json")
    )
  );
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "codex.hooks" &&
        entry.path === path.join(os.homedir(), ".codex", "hooks")
    )
  );
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "codex.subAgents" &&
        entry.path === path.join(os.homedir(), ".codex", "agents")
    )
  );
  assert.ok(codex.entries.some((entry) => entry.key === "shared.agentSkills"));
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "shared.dotAgentSkills" &&
        entry.path === path.join(os.homedir(), ".agent", "skills")
    )
  );
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "shared.dotAgentWorkflows" &&
        entry.path === path.join(os.homedir(), ".agent", "workflows")
    )
  );
  assert.equal(cursor.name, "Cursor配置");
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.hooksConfig" &&
        entry.path === path.join(os.homedir(), ".cursor", "hooks.json")
    )
  );
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.commands" &&
        entry.path === path.join(os.homedir(), ".cursor", "commands")
    )
  );
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.skills" &&
        entry.path === path.join(os.homedir(), ".cursor", "skills")
    )
  );
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.agents" &&
        entry.path === path.join(os.homedir(), ".cursor", "agents")
    )
  );
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.hooks" &&
        entry.path === path.join(os.homedir(), ".cursor", "hooks")
    )
  );
  assert.ok(
    cursor.entries.some(
      (entry) =>
        entry.key === "cursor.rules" &&
        entry.path === path.join(os.homedir(), ".cursor", "rules")
    )
  );
  assert.equal(gemini.name, "Gemini CLI配置");
  assert.ok(
    gemini.entries.some(
      (entry) =>
        entry.key === "gemini.hooks" &&
        entry.path === path.join(os.homedir(), ".gemini", "hooks")
    )
  );
  assert.ok(
    gemini.entries.some(
      (entry) =>
        entry.key === "gemini.antigravityConfig" &&
        entry.path ===
          path.join(
            os.homedir(),
            ".gemini",
            "antigravity",
            "mcp_config.json"
          )
    )
  );
  assert.ok(
    gemini.entries.some(
      (entry) =>
        entry.key === "gemini.antigravityGlobalWorkflows" &&
        entry.path ===
          path.join(
            os.homedir(),
            ".gemini",
            "antigravity",
            "global_workflows"
          )
    )
  );
});

test("FileManager 会按当前 home 目录展开逻辑路径", () => {
  const manager = new FileManager();

  manager.homeDir = path.win32.join("C:\\", "Users", "Alice");
  assert.equal(
    manager.resolveManifestPath("~/.codex/config.toml", path.win32),
    path.win32.join("C:\\", "Users", "Alice", ".codex", "config.toml")
  );

  manager.homeDir = path.posix.join("/Users", "alice");
  assert.equal(
    manager.resolveManifestPath("~/.codex/config.toml", path.posix),
    path.posix.join("/Users", "alice", ".codex", "config.toml")
  );

  manager.homeDir = path.posix.join("/home", "alice");
  assert.equal(
    manager.resolveManifestPath("~/.codex/config.toml", path.posix),
    path.posix.join("/home", "alice", ".codex", "config.toml")
  );
});
