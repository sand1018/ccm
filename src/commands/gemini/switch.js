import chalk from "chalk";
import inquirer from "inquirer";

import ConfigManager from "../../core/ConfigManager.js";
import { formatGeminiSwitchSuccess } from "../../utils/formatter.js";
import { createBackChoice, showError, showInfo, showSuccess, showWarning } from "../../utils/ui.js";

/**
 * Gemini配置切换命令
 */
class GeminiSwitchCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行切换命令
   * @param {Array} args 参数
   */
  async execute(args = []) {
    try {
      showInfo("🪐 开始切换 Gemini 配置...");

      const geminiSites = await this.getGeminiSites();
      if (Object.keys(geminiSites).length === 0) {
        showWarning("没有找到支持 Gemini 的站点配置");
        showInfo('请在 api_configs.json 中添加带有 "gemini" 字段的站点配置');
        return false;
      }

      const selectedSite = await this.selectSite(geminiSites);
      if (selectedSite === "__back__") {
        return false;
      }

      const siteConfig = geminiSites[selectedSite];
      const geminiConfig = this.configManager.getGeminiConfig(siteConfig);
      const selectedApiKey = await this.selectApiKey(geminiConfig.env.GEMINI_API_KEY);
      if (selectedApiKey === "__back__") {
        return false;
      }

      const currentGeminiConfig = await this.configManager.switchGeminiConfig(
        selectedSite,
        selectedApiKey,
        siteConfig
      );

      console.log(formatGeminiSwitchSuccess(currentGeminiConfig));
      showSuccess("Gemini 配置切换完成！");
      process.exit(0);
    } catch (error) {
      showError(`切换 Gemini 配置失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取支持Gemini的站点配置
   * @returns {Object} 站点配置
   */
  async getGeminiSites() {
    const allConfigs = await this.configManager.getAllConfigs();
    const geminiSites = {};

    for (const [siteKey, siteConfig] of Object.entries(allConfigs.sites)) {
      if (siteConfig.gemini) {
        geminiSites[siteKey] = siteConfig;
      }
    }

    return geminiSites;
  }

  /**
   * 选择站点
   * @param {Object} geminiSites 站点配置
   * @returns {string} 选择结果
   */
  async selectSite(geminiSites) {
    const choices = Object.entries(geminiSites).map(([key, config]) => ({
      name: `🌐 ${key}${config.description ? ` [${config.description}]` : ""}`,
      value: key,
      short: key,
    }));

    choices.push(createBackChoice("__back__"));

    if (choices.length === 2) {
      showInfo(`自动选择站点: ${chalk.cyan(choices[0].value)}`);
      return choices[0].value;
    }

    const { site } = await inquirer.prompt([
      {
        type: "list",
        name: "site",
        message: "选择 Gemini 站点：",
        choices,
        pageSize: 10,
      },
    ]);

    return site;
  }

  /**
   * 选择API Key
   * @param {string|Object} apiKeyConfig API Key配置
   * @returns {string} 选择的API Key
   */
  async selectApiKey(apiKeyConfig) {
    const apiKeys =
      typeof apiKeyConfig === "string"
        ? { "默认API Key": apiKeyConfig }
        : apiKeyConfig;

    if (Object.keys(apiKeys).length === 1) {
      const keyName = Object.keys(apiKeys)[0];
      const apiKey = Object.values(apiKeys)[0];
      showInfo(`自动选择 API Key: ${chalk.cyan(keyName)}`);
      return apiKey;
    }

    const { apiKey } = await inquirer.prompt([
      {
        type: "list",
        name: "apiKey",
        message: "选择 Gemini API Key：",
        choices: [
          ...Object.entries(apiKeys).map(([keyName, keyValue]) => ({
            name: `🔑 ${keyName} (${String(keyValue).slice(0, 10)}...)`,
            value: keyValue,
            short: keyName,
          })),
          createBackChoice("__back__"),
        ],
        pageSize: 10,
      },
    ]);

    return apiKey;
  }
}

export default new GeminiSwitchCommand();
