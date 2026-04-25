import assert from "node:assert/strict";
import test from "node:test";

import BackupManageManager from "../src/commands/backup/manage.js";

function createBackups() {
  return [
    {
      name: "ccm-codex-2026-04-25-10-00-00.json",
      path: "/ccm-backups/ccm-codex-2026-04-25-10-00-00.json",
      size: 2048,
      lastModified: new Date("2026-04-25T10:00:00Z"),
    },
    {
      name: "ccm-claude-2026-04-24-09-00-00.json",
      path: "/ccm-backups/ccm-claude-2026-04-24-09-00-00.json",
      size: 1024,
      lastModified: new Date("2026-04-24T09:00:00Z"),
    },
    {
      name: "ccm-gemini-2026-04-23-08-00-00.json",
      path: "/ccm-backups/ccm-gemini-2026-04-23-08-00-00.json",
      size: 512,
      lastModified: new Date("2026-04-23T08:00:00Z"),
    },
  ];
}

test("BackupManageManager 会多选删除远程备份", async () => {
  const backups = createBackups();
  const deletedPaths = [];
  let initialized = false;

  const manager = new BackupManageManager({
    webdavClient: {
      async initialize() {
        initialized = true;
      },
      async listBackups() {
        return backups;
      },
      async deleteBackup(backupPath) {
        deletedPaths.push(backupPath);
      },
    },
    async prompt(questions) {
      const questionName = questions[0].name;

      if (questionName === "selectedBackups") {
        return {
          selectedBackups: [backups[0], backups[2]],
        };
      }

      if (questionName === "confirmed") {
        return {
          confirmed: true,
        };
      }

      throw new Error(`未处理的问题: ${questionName}`);
    },
  });

  const result = await manager.performBackupManagement();

  assert.equal(initialized, true);
  assert.equal(result.status, "deleted");
  assert.deepEqual(deletedPaths, [backups[0].path, backups[2].path]);
  assert.deepEqual(result.success, [backups[0], backups[2]]);
  assert.deepEqual(result.failed, []);
});

test("BackupManageManager 在确认取消时不会删除远程备份", async () => {
  const backups = createBackups();
  const deletedPaths = [];

  const manager = new BackupManageManager({
    webdavClient: {
      async initialize() {},
      async listBackups() {
        return backups;
      },
      async deleteBackup(backupPath) {
        deletedPaths.push(backupPath);
      },
    },
    async prompt(questions) {
      const questionName = questions[0].name;

      if (questionName === "selectedBackups") {
        return {
          selectedBackups: [backups[0]],
        };
      }

      if (questionName === "confirmed") {
        return {
          confirmed: false,
        };
      }

      throw new Error(`未处理的问题: ${questionName}`);
    },
  });

  const result = await manager.performBackupManagement();

  assert.equal(result.status, "cancelled");
  assert.deepEqual(deletedPaths, []);
});

test("BackupManageManager 删除失败时会继续处理剩余备份并记录失败项", async () => {
  const backups = createBackups().slice(0, 2);
  const deletedPaths = [];
  const originalConsoleError = console.error;
  const manager = new BackupManageManager({
    webdavClient: {
      async deleteBackup(backupPath) {
        deletedPaths.push(backupPath);

        if (backupPath === backups[1].path) {
          throw new Error("远程服务拒绝删除");
        }
      },
    },
  });

  let result;
  try {
    console.error = () => {};
    result = await manager.deleteSelectedBackups(backups);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result.status, "deleted");
  assert.deepEqual(deletedPaths, [backups[0].path, backups[1].path]);
  assert.deepEqual(result.success, [backups[0]]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].backup, backups[1]);
  assert.equal(result.failed[0].error.message, "远程服务拒绝删除");
});
