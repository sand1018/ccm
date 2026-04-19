import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import FileManager from "../src/commands/backup/file-manager.js";

test("FileManager 返回基于清单解析后的 entries", () => {
  const manager = new FileManager();
  const codex = manager.getCategoryPaths("codex");

  assert.equal(codex.name, "Codex配置");
  assert.ok(Array.isArray(codex.entries));
  assert.ok(
    codex.entries.some(
      (entry) =>
        entry.key === "codex.agentsOverride" &&
        entry.path === path.join(os.homedir(), ".codex", "AGENTS.override.md")
    )
  );
  assert.ok(codex.entries.some((entry) => entry.key === "shared.agentSkills"));
});
