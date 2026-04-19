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

test("RestoreManager 会把 Windows 风格 relativePath 映射到当前平台目录", () => {
  const manager = new RestoreManager();

  const targetPath = manager.resolveEntryTargetPath(null, {
    entryType: "file",
    key: "codex.prompts",
    portableRootPath: createWindowsPortablePath(".codex", "prompts"),
    relativePath: "team\\welcome.md",
  });

  assert.equal(
    targetPath,
    path.join(os.homedir(), ".codex", "prompts", "team", "welcome.md")
  );
});

test("RestoreManager 在 POSIX 目标平台上也会拆分 Windows 风格 relativePath", () => {
  const manager = new RestoreManager();

  const targetPath = manager.resolveEntryTargetPath(
    null,
    {
      entryType: "file",
      key: "codex.prompts",
      portableRootPath: createWindowsPortablePath(".codex", "prompts"),
      relativePath: "team\\welcome.md",
    },
    path.posix
  );

  assert.equal(
    targetPath,
    path.posix.join(os.homedir().replace(/\\/g, "/"), ".codex", "prompts", "team", "welcome.md")
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

test("RestoreManager 只保留最近 5 组恢复前快照", async () => {
  const manager = new RestoreManager();
  const originalHomeDir = os.homedir;
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-restore-prune-"));
  const snapshotsDir = path.join(tempHome, ".ccm", "restore-snapshots");
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-restore-prune-source-"));
  const sourceFile = path.join(sourceDir, "config.toml");
  const oldSnapshotNames = [
    "2024-01-01T00-00-00-000Z",
    "2024-01-02T00-00-00-000Z",
    "2024-01-03T00-00-00-000Z",
    "2024-01-04T00-00-00-000Z",
    "2024-01-05T00-00-00-000Z",
  ];

  os.homedir = () => tempHome;

  await fs.writeFile(sourceFile, 'model = "gpt-5"\n');
  for (const snapshotName of oldSnapshotNames) {
    await fs.mkdir(path.join(snapshotsDir, snapshotName), { recursive: true });
  }

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
    const snapshotNames = (await fs.readdir(snapshotsDir)).sort();

    assert.equal(snapshotNames.length, 5);
    assert.ok(snapshotNames.includes(path.basename(snapshotRoot)));
    assert.ok(!snapshotNames.includes("2024-01-01T00-00-00-000Z"));
  } finally {
    os.homedir = originalHomeDir;
    await fs.rm(tempHome, { recursive: true, force: true });
    await fs.rm(sourceDir, { recursive: true, force: true });
  }
});

test("RestoreManager 为 ~/.ccm 自身创建恢复前快照时不会复制到自己的子目录", async () => {
  const manager = new RestoreManager();
  const originalHomeDir = os.homedir;
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-home-"));
  const ccmDir = path.join(tempHome, ".ccm");
  const configFile = path.join(ccmDir, "api_configs.json");

  os.homedir = () => tempHome;

  await fs.mkdir(ccmDir, { recursive: true });
  await fs.writeFile(configFile, '{"sites":{}}');

  manager.fileManager.getCategoryPaths = () => ({
    name: "CCM配置",
    entries: [
      {
        type: "directory",
        key: "ccm.configDir",
        path: ccmDir,
      },
    ],
  });

  const backupData = {
    categories: {
      ccm: {
        entries: [
          {
            entryType: "directory",
            key: "ccm.configDir",
            relativePath: ".",
          },
        ],
      },
    },
  };

  let snapshotRoot;
  try {
    snapshotRoot = await manager.createPreRestoreSnapshot(backupData, ["ccm"], "v3");
    const manifest = JSON.parse(
      await fs.readFile(path.join(snapshotRoot, "snapshot-manifest.json"), "utf8")
    );

    assert.equal(manifest.categories.ccm.length, 1);
  } finally {
    os.homedir = originalHomeDir;
    await fs.rm(tempHome, { recursive: true, force: true });
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

test("RestoreManager 在父级路径已被文件占用时只提示一次并跳过其下文件", async () => {
  const manager = new RestoreManager();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-restore-blocked-parent-"));
  const skillsDir = path.join(tempDir, "skills");
  const blockedDataPath = path.join(skillsDir, "ui-ux-pro-max", "data");
  const blockedScriptsPath = path.join(skillsDir, "ui-ux-pro-max", "scripts");

  await fs.mkdir(path.dirname(blockedDataPath), { recursive: true });
  await fs.writeFile(blockedDataPath, "occupied-data");
  await fs.writeFile(blockedScriptsPath, "occupied-scripts");

  manager.fileManager.getCategoryPaths = () => ({
    name: "Claude Code配置",
    entries: [
      {
        type: "directory",
        key: "claude.skills",
        path: skillsDir,
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
            key: "claude.skills",
            portableRootPath: "~/.claude/skills",
            relativePath: path.posix.join("ui-ux-pro-max", "data", "stacks", "react.md"),
            contentBase64: Buffer.from("react").toString("base64"),
          },
          {
            entryType: "file",
            key: "claude.skills",
            portableRootPath: "~/.claude/skills",
            relativePath: path.posix.join("ui-ux-pro-max", "data", "stacks", "vue.md"),
            contentBase64: Buffer.from("vue").toString("base64"),
          },
          {
            entryType: "file",
            key: "claude.skills",
            portableRootPath: "~/.claude/skills",
            relativePath: path.posix.join(
              "ui-ux-pro-max",
              "scripts",
              "__pycache__",
              "index.pyc"
            ),
            contentBase64: Buffer.from("bytecode").toString("base64"),
          },
        ],
      },
    },
  };

  const capturedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    capturedErrors.push(args.join(" "));
  };

  try {
    const result = await manager.restoreV3Entries(
      backupData,
      ["claudeCode"],
      { text: "" }
    );

    assert.equal(result.restoredFiles, 0);
    assert.equal(result.failedFiles, 3);
    assert.equal(capturedErrors.length, 2);
    assert.match(capturedErrors[0], /父级路径 .*data 已存在且不是目录/);
    assert.match(capturedErrors[1], /父级路径 .*scripts 已存在且不是目录/);
    await assert.rejects(
      fs.access(path.join(skillsDir, "ui-ux-pro-max", "data", "stacks", "react.md"))
    );
  } finally {
    console.error = originalConsoleError;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
