import assert from "node:assert/strict";
import test from "node:test";

import { formatApiHelp, formatMainHelp, formatStatus } from "../src/utils/formatter.js";

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
