import chalk from "chalk";
import { exec } from "child_process";
import fs from "fs-extra";

import ConfigManager from "../../core/ConfigManager.js";
import { showError, showInfo, showSuccess, showWarning, waitForBackConfirm } from "../../utils/ui.js";

/**
 * Gemini配置编辑命令
 */
class GeminiEditCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行编辑配置文件
   * @param {Array} args 参数
   */
  async execute(args = []) {
    try {
      showInfo("📝 打开 API 配置文件进行编辑");

      const configExists = await this.configManager.configExists();
      if (!configExists) {
        showWarning("配置文件不存在，将创建默认配置文件");
        await this.createDefaultConfigFile();
      }

      await this.openConfigFile();
      await waitForBackConfirm("编辑操作完成");
    } catch (error) {
      showError(`编辑配置文件失败: ${error.message}`);
    }
  }

  /**
   * 创建默认配置文件
   */
  async createDefaultConfigFile() {
    try {
      await this.configManager.ensureConfigDir();

      const defaultConfig = {
        sites: {
          "Gemini示例站点": {
            description: "这是一个 Gemini 示例配置，请根据需要修改",
            url: "https://generativelanguage.googleapis.com",
            gemini: {
              env: {
                GEMINI_API_KEY: {
                  主力Key: "gm-xxxxxxxxxxxxxxxx",
                  备用Key: "gm-yyyyyyyyyyyyyyyy",
                },
                GEMINI_MODEL: "gemini-2.5-pro",
                GOOGLE_GEMINI_BASE_URL: "https://generativelanguage.googleapis.com",
              },
            },
          },
        },
      };

      await fs.writeFile(
        this.configManager.configPath,
        JSON.stringify(defaultConfig, null, 2),
        "utf8"
      );

      showSuccess(`默认配置文件已创建: ${this.configManager.configPath}`);
    } catch (error) {
      throw new Error(`创建默认配置文件失败: ${error.message}`);
    }
  }

  /**
   * 打开配置文件
   */
  async openConfigFile() {
    const configPath = this.configManager.configPath;
    showInfo(`配置文件路径: ${chalk.cyan(configPath)}`);

    let command;
    const platform = process.platform;

    if (platform === "win32") {
      command = `start "" "${configPath}"`;
    } else if (platform === "darwin") {
      command = `open "${configPath}"`;
    } else {
      command = `xdg-open "${configPath}"`;
    }

    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          this.tryOpenWithTextEditor(configPath).then(resolve).catch(reject);
          return;
        }

        showSuccess("✅ 配置文件已在默认编辑器中打开");
        showInfo("💡 编辑完成后保存文件即可生效");
        showInfo(`💡 使用 ${chalk.cyan("ccm geminiapi --list")} 验证配置是否正确`);
        resolve();
      });
    });
  }

  /**
   * 尝试使用文本编辑器打开
   * @param {string} configPath 配置文件路径
   */
  async tryOpenWithTextEditor(configPath) {
    const editors = ["code", "notepad", "vim", "nano", "gedit"];

    for (const editor of editors) {
      try {
        await this.openWithEditor(editor, configPath);
        showSuccess(`✅ 配置文件已在 ${editor} 中打开`);
        showInfo("💡 编辑完成后保存文件即可生效");
        showInfo(`💡 使用 ${chalk.cyan("ccm geminiapi --list")} 验证配置是否正确`);
        return;
      } catch (error) {
        continue;
      }
    }

    showWarning("无法自动打开编辑器");
    showInfo(`请手动打开配置文件: ${chalk.cyan(configPath)}`);
    showInfo("💡 编辑完成后保存文件即可生效");
    showInfo(`💡 使用 ${chalk.cyan("ccm geminiapi --list")} 验证配置是否正确`);
  }

  /**
   * 使用指定编辑器打开文件
   * @param {string} editor 编辑器名称
   * @param {string} configPath 配置文件路径
   * @returns {Promise<void>} 打开结果
   */
  openWithEditor(editor, configPath) {
    return new Promise((resolve, reject) => {
      exec(`${editor} "${configPath}"`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

export default new GeminiEditCommand();
