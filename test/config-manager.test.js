import fs from "fs-extra";
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

test("ConfigManager 能保存并读取当前 Gemini 配置", async () => {
  const manager = new ConfigManager();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-gemini-config-"));

  manager.ccmDir = path.join(tempRoot, ".ccm");
  manager.claudeDir = path.join(tempRoot, ".claude");
  manager.geminiDir = path.join(tempRoot, ".gemini");
  manager.configPath = path.join(manager.ccmDir, "api_configs.json");

  await fs.ensureDir(manager.ccmDir);
  await fs.writeJson(manager.configPath, { sites: {} }, { spaces: 2 });

  try {
    await manager.saveCurrentGeminiConfig({
      site: "Gemini站点",
      siteName: "Gemini站点",
      apiKey: "gm-key-1",
      apiKeyName: "主力Key",
      model: "gemini-2.5-pro",
      baseUrl: "https://proxy.example.com",
    });

    const currentConfig = await manager.getCurrentGeminiConfig();
    assert.equal(currentConfig.site, "Gemini站点");
    assert.equal(currentConfig.apiKeyName, "主力Key");
    assert.equal(currentConfig.model, "gemini-2.5-pro");
    assert.equal(currentConfig.baseUrl, "https://proxy.example.com");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("ConfigManager 切换 Gemini 配置时会写入 ~/.gemini/.env", async () => {
  const manager = new ConfigManager();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ccm-gemini-switch-"));

  manager.ccmDir = path.join(tempRoot, ".ccm");
  manager.claudeDir = path.join(tempRoot, ".claude");
  manager.geminiDir = path.join(tempRoot, ".gemini");
  manager.configPath = path.join(manager.ccmDir, "api_configs.json");
  manager.geminiEnvPath = path.join(manager.geminiDir, ".env");

  const siteConfig = {
    gemini: {
      env: {
        GEMINI_API_KEY: {
          主力Key: "gm-key-1",
          备用Key: "gm-key-2",
        },
        GEMINI_MODEL: "gemini-2.5-pro",
        GOOGLE_GEMINI_BASE_URL: "https://proxy.example.com",
      },
    },
  };

  await fs.ensureDir(manager.ccmDir);
  await fs.ensureDir(manager.geminiDir);
  await fs.writeJson(
    manager.configPath,
    {
      sites: {
        Gemini站点: siteConfig,
      },
    },
    { spaces: 2 }
  );
  await fs.writeFile(manager.geminiEnvPath, "FOO=bar\nGEMINI_MODEL=old-model\n", "utf8");

  try {
    const currentConfig = await manager.switchGeminiConfig(
      "Gemini站点",
      "gm-key-2",
      siteConfig
    );

    const envContent = await fs.readFile(manager.geminiEnvPath, "utf8");
    assert.match(envContent, /FOO=bar/);
    assert.match(envContent, /GEMINI_API_KEY=gm-key-2/);
    assert.match(envContent, /GEMINI_MODEL=gemini-2\.5-pro/);
    assert.match(envContent, /GOOGLE_GEMINI_BASE_URL=https:\/\/proxy\.example\.com/);
    assert.equal(currentConfig.apiKeyName, "备用Key");
    assert.equal(currentConfig.model, "gemini-2.5-pro");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
