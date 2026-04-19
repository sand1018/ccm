import chalk from "chalk";

import switchCommand from "./switch.js";
import listCommand from "./list.js";
import editCommand from "./edit.js";
import { createBackChoice } from "../../utils/ui.js";

/**
 * Gemini命令模块
 */
class GeminiCommand {
  constructor() {
    this.subCommands = {
      switch: switchCommand,
      list: listCommand,
      edit: editCommand,
    };
  }

  /**
   * 注册Gemini命令到commander
   * @param {Object} program commander实例
   */
  async register(program) {
    const geminiCommand = program
      .command("geminiapi")
      .description("Gemini 配置管理")
      .option("-l, --list", "列出所有 Gemini 配置")
      .option("-e, --edit", "编辑配置文件")
      .option("-h, --help", "显示 Gemini 命令帮助信息")
      .action(async (options) => {
        if (options.help) {
          this.showHelp();
          return;
        }

        if (options.list) {
          await this.subCommands.list.execute([]);
          return;
        }

        if (options.edit) {
          await this.subCommands.edit.execute([]);
          return;
        }

        await this.showInteractiveMenu();
      });

    geminiCommand.addHelpText(
      "after",
      `

示例:
  ccm geminiapi         显示交互式 Gemini 管理菜单
  ccm geminiapi --list  列出所有 Gemini 配置
  ccm geminiapi --edit  编辑配置文件
  ccm geminiapi --help  显示此帮助信息

配置文件位置:
  ~/.ccm/api_configs.json  站点配置文件
  ~/.gemini/.env           Gemini CLI 环境变量文件

注意:
  - 如果 Gemini API Key 只有一个选项，会自动选择
  - 当前切换结果会写入 ~/.gemini/.env
  - 当前使用的站点会显示在 ccm status 和启动横幅中
`
    );
  }

  /**
   * 显示Gemini命令帮助信息
   */
  showHelp() {
    console.log(chalk.cyan.bold("🪐 CCM Gemini 配置管理工具帮助"));
    console.log();
    console.log(chalk.white("用法:"));
    console.log("  ccm geminiapi [选项]");
    console.log();
    console.log(chalk.white("选项:"));
    console.log("  -l, --list     列出所有 Gemini 配置并标识当前使用的配置");
    console.log("  -e, --edit     编辑配置文件");
    console.log("  -h, --help     显示此帮助信息");
    console.log();
    console.log(chalk.white("交互式功能:"));
    console.log("  🔄 切换配置    选择不同的 Gemini 站点和 API Key");
    console.log("  📋 查看配置    查看所有 Gemini 配置的详细信息");
    console.log("  ✏️  编辑配置    打开配置文件进行编辑");
    console.log();
    console.log(chalk.white("配置文件:"));
    console.log(`  ${chalk.gray("~/.ccm/api_configs.json")}    站点配置文件`);
    console.log(`  ${chalk.gray("~/.gemini/.env")}             Gemini CLI 环境变量文件`);
    console.log();
    console.log(chalk.white("示例:"));
    console.log(`  ${chalk.green("ccm geminiapi")}         # 显示交互式菜单`);
    console.log(`  ${chalk.green("ccm geminiapi --list")}  # 列出所有 Gemini 配置`);
    console.log(`  ${chalk.green("ccm geminiapi --edit")}  # 编辑配置文件`);
  }

  /**
   * 显示交互式Gemini菜单
   */
  async showInteractiveMenu() {
    const inquirer = (await import("inquirer")).default;

    while (true) {
      try {
        console.log(chalk.cyan.bold("\n🪐 Gemini 配置管理"));
        console.log(chalk.gray("═".repeat(40)));

        const { choice } = await inquirer.prompt([
          {
            type: "list",
            name: "choice",
            message: "请选择操作：",
            choices: [
              {
                name: "🔄 切换配置 - 切换 Gemini 配置",
                value: "switch",
                short: "切换配置",
              },
              {
                name: "📋 查看配置 - 列出所有 Gemini 配置",
                value: "list",
                short: "查看配置",
              },
              {
                name: "📝 编辑配置 - 编辑 Gemini 配置文件",
                value: "edit",
                short: "编辑配置",
              },
              createBackChoice("back"),
            ],
            pageSize: 10,
          },
        ]);

        if (choice === "back") {
          return;
        }

        await this.subCommands[choice].execute([]);
      } catch (error) {
        console.error(chalk.red("❌ Gemini 菜单操作失败:"), error.message);
      }
    }
  }

  /**
   * 执行Gemini命令
   * @param {Array} args 参数
   */
  async execute(args = []) {
    await this.showInteractiveMenu();
  }
}

export default new GeminiCommand();
