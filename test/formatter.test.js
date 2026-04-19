import assert from "node:assert/strict";
import test from "node:test";

import {
  formatApiHelp,
  formatConfigList,
  formatMainHelp,
  formatStatus,
} from "../src/utils/formatter.js";

test("formatStatus 会展示当前 Gemini 配置", () => {
  const output = formatStatus(
    null,
    null,
    {
      siteName: "Gemini站点",
      apiKeyName: "主力Key",
      updatedAt: "2026-04-19T00:00:00.000Z",
    }
  );

  assert.match(output, /Gemini API 配置/);
  assert.match(output, /Gemini站点/);
  assert.match(output, /主力Key/);
});

test("formatStatus 会为 Codex 和 Gemini 使用 API Key 名称标签", () => {
  const output = formatStatus(
    null,
    {
      siteName: "Codex站点",
      apiKeyName: "Codex主Key",
      updatedAt: "2026-04-19T00:00:00.000Z",
    },
    {
      siteName: "Gemini站点",
      apiKeyName: "Gemini主Key",
      updatedAt: "2026-04-19T00:00:00.000Z",
    }
  );

  assert.match(output, /API Key名称：\s*Codex主Key/);
  assert.match(output, /API Key名称：\s*Gemini主Key/);
});

test("帮助文案会指向 .ccm 并展示 Codex 和 Gemini 命令", () => {
  const apiHelp = formatApiHelp();
  const mainHelp = formatMainHelp();

  assert.match(apiHelp, /~\/\.ccm\/api_configs\.json/);
  assert.match(apiHelp, /ccm codexapi/);
  assert.match(apiHelp, /ccm geminiapi/);

  assert.match(mainHelp, /~\/\.ccm\/api_configs\.json/);
  assert.match(mainHelp, /ccm codexapi/);
  assert.match(mainHelp, /ccm geminiapi/);
  assert.match(mainHelp, /ccm update/);
});

test("formatConfigList 会将字符串 Token 视为单个默认 Token 显示", () => {
  const output = formatConfigList(
    {
      sites: {
        local: {
          url: "https://ax.icorad.com",
          claude: {
            env: {
              ANTHROPIC_BASE_URL: "https://ax.icorad.com/anthropic",
              ANTHROPIC_AUTH_TOKEN: "ah-2e5570a2be9dd0646e88faf359817d738093c9a90405ced0eb7713b3db29dacd",
            },
          },
        },
      },
    },
    {
      site: "local",
      token:
        "ah-2e5570a2be9dd0646e88faf359817d738093c9a90405ced0eb7713b3db29dacd",
    }
  );

  assert.match(output, /ANTHROPIC_AUTH_TOKEN \(1个\)/);
  assert.match(output, /默认Token: ah-2e55\.\.\.29dacd/);
  assert.doesNotMatch(output, /0: a/);
});
