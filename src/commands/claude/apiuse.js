import chalk from 'chalk';
import ora from 'ora';

import ConfigManager from '../../core/ConfigManager.js';
import { selectSite, selectToken, confirmSwitch, showSuccess, showError, showInfo } from '../../utils/ui.js';
import { formatSwitchSuccess } from '../../utils/formatter.js';

/**
 * API快速使用命令
 * 直接跳转到站点选择，快速完成配置切换
 */
class ApiUseCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行快速配置切换
   * @param {Array} args 参数
   */
  async execute(args = []) {
    console.log(chalk.cyan.bold('\n🚀 Claude Code API 快速切换'));
    console.log(chalk.gray('═'.repeat(40)));

    const spinner = ora('正在加载配置...').start();

    try {
      // 检查配置文件是否存在
      if (!await this.configManager.configExists()) {
        spinner.fail();
        showError('配置文件不存在');
        showInfo('请确保 ~/.ccm/api_configs.json 文件存在');
        showInfo('可以使用 "ccm api --add" 添加新配置');
        return false;
      }

      // 读取所有配置
      const allConfigs = await this.configManager.getAllConfigs();

      if (!this.configManager.validateConfig(allConfigs)) {
        spinner.fail();
        showError('配置文件格式无效');
        showInfo('请检查配置文件格式或使用 "ccm api --edit" 编辑配置');
        return false;
      }

      spinner.succeed('配置加载完成');

      // 1. 直接选择站点
      console.log(chalk.white('\n📡 请选择 Claude Code 站点:'));
      const selectedSite = await selectSite(allConfigs.sites);

      // 检查是否选择返回
      if (selectedSite === '__back__') {
        showInfo('操作已取消');
        return false;
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
        console.log(chalk.white('\n🔑 请选择 Token:'));
        selectedToken = await selectToken(tokens);

        // 检查是否选择返回
        if (selectedToken === '__back__') {
          showInfo('操作已取消');
          return false;
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
        showInfo('操作已取消');
        return false;
      }

      // 4. 保存配置
      const saveSpinner = ora('正在保存配置...').start();

      try {
        await this.configManager.switchConfig(selectedSite, selectedToken, siteConfig);
        saveSpinner.succeed('配置保存成功');

        // 显示成功信息
        console.log(formatSwitchSuccess(config));
        showSuccess('🎉 Claude Code API 配置切换完成！');
        showInfo('您现在可以在 Claude Code 中使用新的配置');

        return true;

      } catch (error) {
        saveSpinner.fail();
        showError(`保存配置失败: ${error.message}`);
        return false;
      }

    } catch (error) {
      spinner.fail();
      showError(`配置切换失败: ${error.message}`);

      if (error.message.includes('配置文件不存在')) {
        showInfo('请确保以下文件存在：');
        console.log(chalk.gray('  ~/.ccm/api_configs.json'));
        showInfo('使用 "ccm api --add" 来创建第一个配置');
      }

      return false;
    }
  }
}

export default new ApiUseCommand();
