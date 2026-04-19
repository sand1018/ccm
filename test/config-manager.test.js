import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import ConfigManager from "../src/core/ConfigManager.js";

test("ConfigManager 默认将 API 配置保存到 ~/.ccm", () => {
  const manager = new ConfigManager();

  assert.equal(manager.ccmDir, path.join(os.homedir(), ".ccm"));
  assert.equal(manager.configPath, path.join(os.homedir(), ".ccm", "api_configs.json"));
});
