import chalk from 'chalk';
import ora from 'ora';

import ConfigManager from '../../core/ConfigManager.js';
import { selectSite, selectToken, confirmSwitch, showSuccess, showError, showInfo } from '../../utils/ui.js';
import { formatSwitchSuccess } from '../../utils/formatter.js';

/**
 * API配置切换命令
 */
class SwitchCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行配置切换
   * @param {Array} args 参数
   */
  async execute(args = []) {
    const spinner = ora('正在加载配置...').start();
    
    try {
      // 检查配置文件是否存在
      if (!await this.configManager.configExists()) {
        spinner.fail();
        showError('配置文件不存在');
        showInfo('请确保 ~/.claude/api_configs.json 文件存在');
        return false; // 配置文件不存在，操作未完成
      }

      // 读取所有配置
      const allConfigs = await this.configManager.getAllConfigs();
      
      if (!this.configManager.validateConfig(allConfigs)) {
        spinner.fail();
        showError('配置文件格式无效');
        return false; // 配置格式无效，操作未完成
      }

      spinner.succeed('配置加载完成');

      // 1. 选择站点
      const selectedSite = await selectSite(allConfigs.sites);

      // 检查是否选择返回
      if (selectedSite === '__back__') {
        return false; // 用户选择返回，操作被取消
      }

      const siteConfig = allConfigs.sites[selectedSite];

      // 获取Claude配置（兼容老格式）
      const claudeConfig = this.configManager.getClaudeConfig(siteConfig);

      console.log(chalk.gray(`✓ 选择站点: ${selectedSite}`));
      console.log(chalk.gray(`✓ URL: ${claudeConfig.env.ANTHROPIC_BASE_URL}`));

      // 2. 智能选择Token
      let selectedToken;
      const rawTokens = claudeConfig.env.ANTHROPIC_AUTH_TOKEN;
      const tokens = typeof rawTokens === 'string' ? { '默认Token': rawTokens } : rawTokens;

      if (Object.keys(tokens).length === 1) {
        selectedToken = Object.values(tokens)[0];
        const tokenName = Object.keys(tokens)[0];
        console.log(chalk.gray(`✓ Token自动选择: ${tokenName} (${selectedToken.substring(0, 10)}...)`));
      } else {
        selectedToken = await selectToken(tokens);

        // 检查是否选择返回
        if (selectedToken === '__back__') {
          return false; // 用户选择返回，操作被取消
        }

        const tokenName = Object.keys(tokens).find(key => tokens[key] === selectedToken);
        console.log(chalk.gray(`✓ 选择Token: ${tokenName}`));
      }

      // 3. 确认切换
      const config = {
        site: selectedSite,
        siteName: selectedSite,
        ANTHROPIC_BASE_URL: claudeConfig.env.ANTHROPIC_BASE_URL,
        token: selectedToken,
        tokenName: Object.keys(tokens).find(key => tokens[key] === selectedToken)
      };

      const confirmed = await confirmSwitch(config);
      
      if (!confirmed) {
        showInfo('取消切换配置');
        return false; // 用户取消确认，操作被取消
      }

      // 4. 保存配置
      const saveSpinner = ora('正在保存配置...').start();
      
      try {
        await this.configManager.switchConfig(selectedSite, selectedToken, siteConfig);
        saveSpinner.succeed('配置保存成功');

        // 显示成功信息
        console.log(formatSwitchSuccess(config));
        showSuccess('配置切换完成！');

        // 退出程序
        process.exit(0);

      } catch (error) {
        saveSpinner.fail();
        showError(`保存配置失败: ${error.message}`);
        return false; // 保存配置失败
      }

    } catch (error) {
      spinner.fail();
      showError(`配置切换失败: ${error.message}`);

      if (error.message.includes('配置文件不存在')) {
        showInfo('请确保以下文件存在：');
        console.log(chalk.gray('  ~/.claude/api_configs.json'));
      }

      return false; // 操作失败
    }
  }
}

export default new SwitchCommand();