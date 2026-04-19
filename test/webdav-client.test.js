import assert from "node:assert/strict";
import test from "node:test";

import WebDAVClient from "../src/commands/backup/webdav-client.js";

test("WebDAVClient 默认使用 /ccm-backups 作为远端备份目录", async () => {
  const manager = new WebDAVClient();
  const calls = {
    existsPath: null,
    createdPath: null,
    uploadedPath: null,
    listedPath: null,
  };

  manager.client = {
    async exists(targetPath) {
      calls.existsPath = targetPath;
      return false;
    },
    async createDirectory(targetPath) {
      calls.createdPath = targetPath;
    },
    async putFileContents(targetPath) {
      calls.uploadedPath = targetPath;
    },
    async getDirectoryContents(targetPath) {
      calls.listedPath = targetPath;
      return [];
    },
  };

  await manager.ensureBackupDirectory();
  const uploadedPath = await manager.uploadBackup("demo.json", { ok: true });
  await manager.listBackups();

  assert.equal(calls.existsPath, "/ccm-backups");
  assert.equal(calls.createdPath, "/ccm-backups");
  assert.equal(uploadedPath, "/ccm-backups/demo.json");
  assert.equal(calls.uploadedPath, "/ccm-backups/demo.json");
  assert.equal(calls.listedPath, "/ccm-backups");
});
