import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";

import CommandRegistry from "../src/commands/index.js";

test("CommandRegistry 会注册 codexapi、geminiapi 和 update 命令", async () => {
  const program = new Command();
  const registry = new CommandRegistry();

  await registry.registerCommands(program);

  const commandNames = program.commands.map((command) => command.name());
  const help = program.helpInformation();

  assert.ok(commandNames.includes("codexapi"));
  assert.ok(commandNames.includes("geminiapi"));
  assert.ok(commandNames.includes("update"));
  assert.match(help, /codexapi \[options\]/);
  assert.match(help, /geminiapi \[options\]/);
  assert.match(help, /update \[options\]/);
});
