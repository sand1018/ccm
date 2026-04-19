# 备份体系重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将备份/恢复改为基于声明式清单的全局配置备份，补齐 Claude/Codex 的遗漏项，支持二进制安全归档、恢复前快照，并兼容旧备份格式。

**Architecture:** 以 `backup-manifest.json` 作为备份范围的单一来源，`FileManager` 负责解析清单与覆盖率检查，`BackupManager` 负责统一采集条目，`RestoreManager` 负责新旧格式兼容恢复和恢复前快照。测试使用 Node 内置 `node:test`，避免引入额外测试依赖。

**Tech Stack:** Node.js ESM、fs-extra、node:test、WebDAV 客户端

---

### Task 1: 建立备份清单与测试入口

**Files:**
- Create: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/src/commands/backup/backup-manifest.json`
- Create: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/test/backup-manifest.test.js`
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/package.json:14-25`

- [ ] **Step 1: 编写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("backup manifest covers required global Claude and Codex paths", () => {
  const raw = fs.readFileSync(new URL("../src/commands/backup/backup-manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(raw);

  const claudeEntries = manifest.categories.claudeCode.entries.map((entry) => entry.path);
  const codexEntries = manifest.categories.codex.entries.map((entry) => entry.path);

  assert.ok(claudeEntries.includes("~/.claude/config.json"));
  assert.ok(codexEntries.includes("~/.codex/AGENTS.override.md"));
  assert.ok(codexEntries.includes("~/.codex/prompts"));
  assert.ok(codexEntries.includes("~/.agents/skills"));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/backup-manifest.test.js`  
Expected: FAIL，因为清单文件尚不存在

- [ ] **Step 3: 写最小实现**

```json
{
  "version": 1,
  "categories": {
    "claudeCode": {
      "name": "Claude Code配置",
      "entries": [
        { "type": "file", "key": "settings.json", "path": "~/.claude/settings.json", "required": false },
        { "type": "file", "key": "config.json", "path": "~/.claude/config.json", "required": false },
        { "type": "file", "key": "CLAUDE.md", "path": "~/.claude/CLAUDE.md", "required": false },
        { "type": "directory", "key": "agents", "path": "~/.claude/agents", "required": false },
        { "type": "directory", "key": "commands", "path": "~/.claude/commands", "required": false },
        { "type": "directory", "key": "skills", "path": "~/.claude/skills", "required": false }
      ]
    },
    "codex": {
      "name": "Codex配置",
      "entries": [
        { "type": "file", "key": "config.toml", "path": "~/.codex/config.toml", "required": false },
        { "type": "file", "key": "auth.json", "path": "~/.codex/auth.json", "required": false },
        { "type": "file", "key": "AGENTS.md", "path": "~/.codex/AGENTS.md", "required": false },
        { "type": "file", "key": "AGENTS.override.md", "path": "~/.codex/AGENTS.override.md", "required": false },
        { "type": "directory", "key": "prompts", "path": "~/.codex/prompts", "required": false },
        { "type": "directory", "key": "skills", "path": "~/.codex/skills", "required": false },
        { "type": "directory", "key": "agentSkills", "path": "~/.agents/skills", "required": false }
      ]
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/backup-manifest.test.js`  
Expected: PASS

- [ ] **Step 5: 更新测试脚本**

```json
{
  "scripts": {
    "test": "node --test"
  }
}
```

### Task 2: 重构 FileManager 为清单驱动

**Files:**
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/src/commands/backup/file-manager.js:1-253`
- Create: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/test/file-manager.test.js`

- [ ] **Step 1: 编写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import FileManager from "../src/commands/backup/file-manager.js";

test("file manager resolves manifest entries and preserves codex additions", async () => {
  const manager = new FileManager();
  const codex = manager.getCategoryPaths("codex");

  assert.equal(codex.name, "Codex配置");
  assert.ok(codex.entries.some((entry) => entry.path === `${os.homedir()}\\.codex\\AGENTS.override.md` || entry.path.endsWith("/.codex/AGENTS.override.md")));
  assert.ok(codex.entries.some((entry) => entry.key === "agentSkills"));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/file-manager.test.js`  
Expected: FAIL，因为 `getCategoryPaths()` 还不返回 `entries`

- [ ] **Step 3: 写最小实现**

```js
getCategoryPaths(category) {
  const definition = this.configPaths[category];
  return {
    ...definition,
    entries: definition.entries.map((entry) => ({
      ...entry,
      path: this.resolveManifestPath(entry.path)
    }))
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/file-manager.test.js`  
Expected: PASS

- [ ] **Step 5: 扩展覆盖率输出**

```js
formatCheckResult(checkResult) {
  // 输出 entries + coverageHints 提示
}
```

### Task 3: 用统一归档格式重写备份采集

**Files:**
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/src/commands/backup/backup.js:1-794`
- Create: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/test/backup-format.test.js`

- [ ] **Step 1: 编写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import BackupManager from "../src/commands/backup/backup.js";

test("collect backup data stores file content as binary-safe base64 entries", async () => {
  const manager = new BackupManager();
  const tempFile = path.join(os.tmpdir(), "cc-cli-binary-test.bin");
  await fs.writeFile(tempFile, Buffer.from([0, 255, 10, 20]));

  const categoryData = await manager.collectFileEntry({
    key: "temp",
    type: "file",
    path: tempFile,
    required: true
  });

  assert.equal(categoryData.encoding, "base64");
  assert.equal(Buffer.from(categoryData.contentBase64, "base64")[1], 255);
  await fs.rm(tempFile, { force: true });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/backup-format.test.js`  
Expected: FAIL，因为 `collectFileEntry()` 尚不存在

- [ ] **Step 3: 写最小实现**

```js
async collectFileEntry(entry) {
  const buffer = await fs.readFile(entry.path);
  const stat = await fs.stat(entry.path);

  return {
    entryType: "file",
    key: entry.key,
    rootPath: entry.path,
    relativePath: path.basename(entry.path),
    required: entry.required,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    mode: stat.mode,
    encoding: "base64",
    contentBase64: buffer.toString("base64")
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/backup-format.test.js`  
Expected: PASS

- [ ] **Step 5: 将 `collectBackupData()` 切换到统一 entries 格式**

```js
backupData.categories[category] = {
  name: config.name,
  entries,
  metadata: { collectedAt: new Date().toISOString() }
};
```

### Task 4: 为恢复新增快照并兼容旧格式

**Files:**
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/src/commands/backup/restore.js:1-462`
- Create: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/test/restore-compat.test.js`

- [ ] **Step 1: 编写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import RestoreManager from "../src/commands/backup/restore.js";

test("restore manager detects v3 backups and legacy backups separately", () => {
  const manager = new RestoreManager();

  assert.equal(manager.getBackupFormatVersion({ version: "3.0.0", categories: {} }), "v3");
  assert.equal(manager.getBackupFormatVersion({ version: "2.0.0", categories: {} }), "legacy");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/restore-compat.test.js`  
Expected: FAIL，因为 `getBackupFormatVersion()` 尚不存在

- [ ] **Step 3: 写最小实现**

```js
getBackupFormatVersion(backupData) {
  return backupData?.version === "3.0.0" ? "v3" : "legacy";
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/restore-compat.test.js`  
Expected: PASS

- [ ] **Step 5: 实现恢复前快照与新旧分支恢复**

```js
async executeRestore(backupData, selectedCategories) {
  const format = this.getBackupFormatVersion(backupData);
  await this.createPreRestoreSnapshot(backupData, selectedCategories, format);
  if (format === "v3") {
    return this.restoreV3Entries(backupData, selectedCategories);
  }
  return this.restoreLegacyBackup(backupData, selectedCategories);
}
```

### Task 5: 运行完整验证并补文档

**Files:**
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/README.md:37-144`
- Modify: `C:/Users/Administrator/.codex/worktrees/7226/cc-cli/CHANGELOG.md:1-280`

- [ ] **Step 1: 更新 README 中的备份范围说明**

```md
- Claude Code 全局配置
- Codex 全局配置
- `~/.agents/skills`
- `~/.codex/prompts`
```

- [ ] **Step 2: 运行测试**

Run: `npm test`  
Expected: PASS

- [ ] **Step 3: 运行 CLI 帮助验证**

Run: `node bin/cc.js --help`  
Expected: exit 0，输出帮助信息

- [ ] **Step 4: 检查工作区差异**

Run: `git diff --stat`  
Expected: 仅出现备份相关文件、测试文件、必要文档更新
