import chalk from "chalk";

import ConfigManager from "../../core/ConfigManager.js";
import { formatToken } from "../../utils/formatter.js";
import { waitForBackConfirm } from "../../utils/ui.js";

/**
 * Gemini配置列表命令
 */
class GeminiListCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行查看列表
   * @param {Array} args 参数
   */
  async execute(args = []) {
    try {
      const allConfigs = await this.configManager.getAllConfigs();
      const currentGeminiConfig = await this.configManager.getCurrentGeminiConfig();

      console.log(chalk.cyan.bold("🪐 Gemini 配置列表\n"));
      console.log(chalk.gray("═".repeat(40)));

      let hasGeminiConfigs = false;

      for (const [siteKey, siteConfig] of Object.entries(allConfigs.sites)) {
        if (!siteConfig.gemini) {
          continue;
        }

        hasGeminiConfigs = true;
        const isCurrentSite =
          currentGeminiConfig && currentGeminiConfig.site === siteKey;
        const title = isCurrentSite
          ? chalk.green.bold(`🌐 ${siteKey} ⭐`)
          : chalk.white.bold(`🌐 ${siteKey}`);
        console.log(title);

        if (siteConfig.description) {
          console.log(chalk.gray(`   ${siteConfig.description}`));
        }

        const envConfig = siteConfig.gemini.env || {};
        const model = envConfig.GEMINI_MODEL || "未设置";
        const baseUrl = envConfig.GOOGLE_GEMINI_BASE_URL || "未设置";
        console.log(chalk.cyan(`   🤖 Model: ${model}`));
        console.log(chalk.cyan(`   📡 Base URL: ${baseUrl}`));

        const rawApiKeys = envConfig.GEMINI_API_KEY;
        const apiKeys =
          typeof rawApiKeys === "string"
            ? { "默认API Key": rawApiKeys }
            : rawApiKeys || {};
        const entries = Object.entries(apiKeys);

        console.log(`   🔑 GEMINI_API_KEY (${entries.length}个):`);
        entries.forEach(([keyName, keyValue]) => {
          const isCurrentKey =
            currentGeminiConfig &&
            currentGeminiConfig.site === siteKey &&
            currentGeminiConfig.apiKey === keyValue;
          const line = `      └─ ${keyName}: ${formatToken(keyValue)}`;
          console.log(isCurrentKey ? chalk.green(line) : line);
        });

        console.log();
      }

      if (!hasGeminiConfigs) {
        console.log(chalk.yellow("⚠️  没有找到 Gemini 配置"));
        console.log(chalk.gray('请在 api_configs.json 中添加带有 "gemini" 字段的站点配置'));
      }

      await waitForBackConfirm("配置信息显示完成");
    } catch (error) {
      console.error(chalk.red("❌ 获取 Gemini 配置失败:"), error.message);
      await waitForBackConfirm("操作完成");
    }
  }
}

export default new GeminiListCommand();
