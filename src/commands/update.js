import chalk from "chalk";
import inquirer from "inquirer";
import updateNotifier from "update-notifier";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf8")
);

/**
 * CCM 更新命令
 */
class UpdateCommand {
  /**
   * 注册更新命令
   * @param {Object} program commander实例
   */
  async register(program) {
    const updateCommand = program
      .command("update")
      .description("检查并升级 CCM")
      .option("-c, --check", "仅检查是否有新版本")
      .option("-y, --yes", "跳过确认并直接升级")
      .option("-h, --help", "显示更新命令帮助")
      .action(async (options) => {
        if (options.help) {
          this.showHelp();
          return;
        }

        await this.execute({
          checkOnly: Boolean(options.check),
          yes: Boolean(options.yes),
        });
      });

    updateCommand.addHelpText(
      "after",
      `

示例:
  ccm update          检查新版本并确认是否升级
  ccm update --check  仅检查是否有新版本
  ccm update --yes    跳过确认并直接升级
`
    );
  }

  /**
   * 显示更新命令帮助
   */
  showHelp() {
    console.log(chalk.cyan.bold("⬆️ CCM 更新工具帮助"));
    console.log();
    console.log(chalk.white("用法:"));
    console.log("  ccm update [选项]");
    console.log();
    console.log(chalk.white("选项:"));
    console.log("  -c, --check   仅检查是否有新版本");
    console.log("  -y, --yes     跳过确认并直接升级");
    console.log("  -h, --help    显示此帮助信息");
    console.log();
    console.log(chalk.white("说明:"));
    console.log("  - 默认会先检查版本差异，再询问是否执行全局升级");
    console.log("  - 升级命令会执行 npm install -g @journey1018/ccm@latest");
    console.log();
    console.log(chalk.white("示例:"));
    console.log(`  ${chalk.green("ccm update")}         # 检查并升级`);
    console.log(`  ${chalk.green("ccm update --check")} # 仅检查更新`);
    console.log(`  ${chalk.green("ccm update --yes")}   # 直接升级`);
  }

  /**
   * 执行更新流程
   * @param {{checkOnly?:boolean,yes?:boolean}} options 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async execute(options = {}) {
    const resolvedOptions = {
      checkOnly: false,
      yes: false,
      ...options,
    };

    const updateInfo = await this.fetchUpdateInfo();
    if (!updateInfo) {
      console.log(chalk.green("✅ 当前已是最新版本"));
      console.log(chalk.gray(`当前版本: ${packageJson.version}`));
      return { updated: false, reason: "already-latest" };
    }

    this.showUpdateInfo(updateInfo);

    if (resolvedOptions.checkOnly) {
      console.log(chalk.gray("运行 ccm update 执行升级"));
      return { updated: false, reason: "check-only", updateInfo };
    }

    const confirmed = resolvedOptions.yes
      ? true
      : await this.confirmUpdate(updateInfo);
    if (!confirmed) {
      console.log(chalk.yellow("ℹ️ 已取消升级"));
      return { updated: false, reason: "cancelled", updateInfo };
    }

    const packageSpec = `${packageJson.name}@latest`;
    const upgradeResult = await this.runUpgradeCommand(packageSpec);
    if (!upgradeResult.success) {
      const reason =
        upgradeResult.error?.message ||
        (typeof upgradeResult.status === "number"
          ? `升级命令退出码 ${upgradeResult.status}`
          : "未知错误");
      throw new Error(`升级失败: ${reason}`);
    }

    console.log(chalk.green("✅ 升级完成"));
    console.log(chalk.gray(`已升级到最新版本 ${updateInfo.latest}`));
    return { updated: true, updateInfo };
  }

  /**
   * 获取更新信息
   * @returns {Promise<Object|null>} 更新信息
   */
  async fetchUpdateInfo() {
    const notifier = updateNotifier({
      pkg: packageJson,
      updateCheckInterval: 0,
      shouldNotifyInNpmScript: false,
    });

    if (!notifier.update) {
      return null;
    }

    if (notifier.update.current === notifier.update.latest) {
      return null;
    }

    return {
      current: notifier.update.current,
      latest: notifier.update.latest,
      type: notifier.update.type,
    };
  }

  /**
   * 显示更新信息
   * @param {{current:string,latest:string,type?:string}} updateInfo 更新信息
   */
  showUpdateInfo(updateInfo) {
    console.log(chalk.yellow("🚀 检测到新版本"));
    console.log(chalk.gray(`当前版本: ${updateInfo.current}`));
    console.log(chalk.gray(`最新版本: ${updateInfo.latest}`));
    if (updateInfo.type) {
      console.log(chalk.gray(`更新类型: ${updateInfo.type}`));
    }
  }

  /**
   * 确认是否执行升级
   * @param {{current:string,latest:string}} updateInfo 更新信息
   * @returns {Promise<boolean>} 是否确认
   */
  async confirmUpdate(updateInfo) {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: `确认将 CCM 从 ${updateInfo.current} 升级到 ${updateInfo.latest} 吗？`,
        default: true,
      },
    ]);

    return confirmed;
  }

  /**
   * 执行全局升级命令
   * @param {string} packageSpec 包规格
   * @returns {Promise<{success:boolean,status?:number,error?:Error}>} 执行结果
   */
  async runUpgradeCommand(packageSpec) {
    const invocation = this.buildUpgradeInvocation(packageSpec);

    console.log(
      chalk.blue(`📦 正在执行: ${invocation.command} ${invocation.args.join(" ")}`)
    );

    const result = spawnSync(invocation.command, invocation.args, {
      stdio: "inherit",
      encoding: "utf8",
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: result.status === 0,
      status: result.status,
    };
  }

  /**
   * 构建跨平台升级命令
   * @param {string} packageSpec 包规格
   * @param {NodeJS.Platform} platform 目标平台
   * @returns {{command:string,args:Array<string>}} 命令与参数
   */
  buildUpgradeInvocation(packageSpec, platform = process.platform) {
    if (platform === "win32") {
      return {
        command: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", `npm.cmd install -g ${packageSpec}`],
      };
    }

    return {
      command: "npm",
      args: ["install", "-g", packageSpec],
    };
  }
}

export default new UpdateCommand();
