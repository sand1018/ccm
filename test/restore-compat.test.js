import fs from "node:fs/promises";
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

test("RestoreManager 的恢复前快照写入 ~/.ccm/restore-snapshots", async () => {
  const manager = new RestoreManager();
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-restore-source-"));
  const sourceFile = path.join(sourceDir, "config.toml");
  await fs.writeFile(sourceFile, 'model = "gpt-5"\n');

  manager.fileManager.getCategoryPaths = () => ({
    name: "Codex配置",
    entries: [
      {
        type: "file",
        key: "codex.config",
        path: sourceFile,
      },
    ],
  });

  const backupData = {
    categories: {
      codex: {
        entries: [
          {
            entryType: "file",
            key: "codex.config",
            relativePath: "config.toml",
          },
        ],
      },
    },
  };

  let snapshotRoot;
  try {
    snapshotRoot = await manager.createPreRestoreSnapshot(backupData, ["codex"], "v3");
    assert.ok(
      snapshotRoot.startsWith(path.join(os.homedir(), ".ccm", "restore-snapshots"))
    );
  } finally {
    await fs.rm(sourceDir, { recursive: true, force: true });
    if (snapshotRoot) {
      await fs.rm(snapshotRoot, { recursive: true, force: true });
    }
  }
});

test("RestoreManager 恢复 claude.mcpUserConfig 时保留 .claude.json 其他字段", async () => {
  const manager = new RestoreManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-restore-claude-mcp-"));
  const targetFile = path.join(tempDir, ".claude.json");

  await fs.writeFile(
    targetFile,
    JSON.stringify(
      {
        projects: {
          "/tmp/private-project": {
            mcpServers: {
              privateServer: {
                command: "node",
                args: ["private.js"],
              },
            },
          },
        },
        hasCompletedOnboarding: true,
        mcpServers: {
          oldServer: {
            command: "old",
          },
        },
      },
      null,
      2
    )
  );

  manager.fileManager.getCategoryPaths = () => ({
    name: "Claude Code配置",
    entries: [
      {
        type: "file",
        key: "claude.mcpUserConfig",
        path: targetFile,
      },
    ],
  });

  const backupData = {
    categories: {
      claudeCode: {
        name: "Claude Code配置",
        entries: [
          {
            entryType: "file",
            key: "claude.mcpUserConfig",
            portablePath: "~/.claude.json",
            relativePath: ".claude.json",
            contentBase64: Buffer.from(
              JSON.stringify(
                {
                  mcpServers: {
                    filesystem: {
                      command: "npx",
                      args: ["-y", "@modelcontextprotocol/server-filesystem"],
                    },
                  },
                },
                null,
                2
              )
            ).toString("base64"),
          },
        ],
      },
    },
  };

  try {
    const result = await manager.restoreV3Entries(
      backupData,
      ["claudeCode"],
      { text: "" }
    );

    const restored = JSON.parse(await fs.readFile(targetFile, "utf8"));

    assert.equal(result.restoredFiles, 1);
    assert.equal(result.failedFiles, 0);
    assert.deepEqual(restored, {
      projects: {
        "/tmp/private-project": {
          mcpServers: {
            privateServer: {
              command: "node",
              args: ["private.js"],
            },
          },
        },
      },
      hasCompletedOnboarding: true,
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
      },
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("RestoreManager 会为 Claude MCP 合并恢复生成明确提示", () => {
  const manager = new RestoreManager();

  const notes = manager.buildRestoreNotes(
    {
      categories: {
        claudeCode: {
          entries: [
            {
              entryType: "file",
              key: "claude.mcpUserConfig",
            },
          ],
        },
      },
    },
    ["claudeCode"]
  );

  assert.ok(
    notes.includes("Claude MCP 将只合并恢复 ~/.claude.json 的根级 mcpServers，不会整文件覆盖其他字段")
  );
});

test("RestoreManager 会把可移植路径中的反斜杠拆成跨平台路径段", () => {
  const manager = new RestoreManager();

  assert.deepEqual(manager.splitPortablePathSegments(".codex\\prompts\\team"), [
    ".codex",
    "prompts",
    "team",
  ]);
});
