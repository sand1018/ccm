import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";

import updateCommand from "../src/commands/update.js";

test("update --check 会以仅检查模式执行", async () => {
  const program = new Command();
  const originalExecute = updateCommand.execute;
  let receivedOptions = null;

  updateCommand.execute = async (options = {}) => {
    receivedOptions = options;
  };

  try {
    await updateCommand.register(program);
    await program.parseAsync(["node", "ccm", "update", "--check"]);
    assert.deepEqual(receivedOptions, { checkOnly: true, yes: false });
  } finally {
    updateCommand.execute = originalExecute;
  }
});

test("UpdateCommand 在已是最新版本时不会执行升级", async () => {
  const originalFetchUpdateInfo = updateCommand.fetchUpdateInfo;
  const originalRunUpgradeCommand = updateCommand.runUpgradeCommand;
  let upgradeCalled = false;

  updateCommand.fetchUpdateInfo = async () => null;
  updateCommand.runUpgradeCommand = async () => {
    upgradeCalled = true;
    return { success: true };
  };

  try {
    const result = await updateCommand.execute({ checkOnly: false, yes: true });
    assert.equal(result.updated, false);
    assert.equal(upgradeCalled, false);
  } finally {
    updateCommand.fetchUpdateInfo = originalFetchUpdateInfo;
    updateCommand.runUpgradeCommand = originalRunUpgradeCommand;
  }
});

test("UpdateCommand 在发现新版本且确认后会执行 npm 全局升级", async () => {
  const originalFetchUpdateInfo = updateCommand.fetchUpdateInfo;
  const originalRunUpgradeCommand = updateCommand.runUpgradeCommand;
  let upgradeSpec = null;

  updateCommand.fetchUpdateInfo = async () => ({
    current: "0.0.3",
    latest: "0.0.4",
    type: "patch",
  });
  updateCommand.runUpgradeCommand = async (packageSpec) => {
    upgradeSpec = packageSpec;
    return { success: true };
  };

  try {
    const result = await updateCommand.execute({ checkOnly: false, yes: true });
    assert.equal(result.updated, true);
    assert.equal(upgradeSpec, "@journey1018/ccm@latest");
  } finally {
    updateCommand.fetchUpdateInfo = originalFetchUpdateInfo;
    updateCommand.runUpgradeCommand = originalRunUpgradeCommand;
  }
});

test("UpdateCommand 在 Windows 上通过 cmd.exe 包装 npm 升级命令", () => {
  const invocation = updateCommand.buildUpgradeInvocation(
    "@journey1018/ccm@latest",
    "win32"
  );

  assert.match(invocation.command.toLowerCase(), /(^|\\)cmd\.exe$/);
  assert.deepEqual(invocation.args, [
    "/d",
    "/s",
    "/c",
    "npm.cmd install -g @journey1018/ccm@latest",
  ]);
});
