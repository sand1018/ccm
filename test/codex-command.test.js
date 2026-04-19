import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";

import codexCommand from "../src/commands/codex/index.js";

test("codexapi --official 会分发到官方认证处理器", async () => {
  const program = new Command();
  const originalHandler = codexCommand.useOfficialAuth;
  let called = false;

  codexCommand.useOfficialAuth = async () => {
    called = true;
  };

  try {
    await codexCommand.register(program);
    await program.parseAsync(["node", "ccm", "codexapi", "--official"]);
    assert.equal(called, true);
  } finally {
    codexCommand.useOfficialAuth = originalHandler;
  }
});

test("codexapi --yolo 会分发到 YOLO 处理器", async () => {
  const program = new Command();
  const originalHandler = codexCommand.toggleYoloMode;
  let called = false;

  codexCommand.toggleYoloMode = async () => {
    called = true;
  };

  try {
    await codexCommand.register(program);
    await program.parseAsync(["node", "ccm", "codexapi", "--yolo"]);
    assert.equal(called, true);
  } finally {
    codexCommand.toggleYoloMode = originalHandler;
  }
});

test("removeThirdPartyProviders 会移除 model_provider 和 provider section", () => {
  const input = [
    'model = "gpt-5"',
    'model_provider = "custom"',
    "",
    "[model_providers.custom]",
    'name = "custom"',
    'base_url = "https://example.com/v1"',
    "",
    "[projects.'C:\\\\demo']",
    'trusted = true',
    "",
  ].join("\n");

  const output = codexCommand.removeThirdPartyProviders(input);

  assert.doesNotMatch(output, /model_provider = "custom"/);
  assert.doesNotMatch(output, /\[model_providers\.custom\]/);
  assert.match(output, /model = "gpt-5"/);
  assert.match(output, /\[projects\.'C:\\\\demo'\]/);
});

test("generateYoloConfig 会写入并覆盖 YOLO 顶层配置", () => {
  const input = [
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    'model = "gpt-5"',
    "",
    "[projects.'C:\\\\demo']",
    'trusted = true',
    "",
  ].join("\n");

  const output = codexCommand.generateYoloConfig(input);

  assert.match(output, /^approval_policy = "never"/);
  assert.match(output, /sandbox_mode = "danger-full-access"/);
  assert.match(output, /model = "gpt-5"/);
  assert.match(output, /\[projects\.'C:\\\\demo'\]/);
  assert.equal((output.match(/approval_policy =/g) || []).length, 1);
  assert.equal((output.match(/sandbox_mode =/g) || []).length, 1);
});

test("removeYoloConfig 会移除 YOLO 顶层配置并保留其他内容", () => {
  const input = [
    'approval_policy = "never"',
    'sandbox_mode = "danger-full-access"',
    'model = "gpt-5"',
    "",
    "[projects.'C:\\\\demo']",
    'trusted = true',
    "",
  ].join("\n");

  const output = codexCommand.removeYoloConfig(input);

  assert.doesNotMatch(output, /approval_policy = "never"/);
  assert.doesNotMatch(output, /sandbox_mode = "danger-full-access"/);
  assert.match(output, /model = "gpt-5"/);
  assert.match(output, /\[projects\.'C:\\\\demo'\]/);
});
