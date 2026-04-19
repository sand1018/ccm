import chalk from 'chalk';
import ora from 'ora';

import ConfigManager from '../../core/ConfigManager.js';
import { formatConfigList, formatError } from '../../utils/formatter.js';
import { showError, showInfo, waitForBackConfirm } from '../../utils/ui.js';

/**
 * API配置列表显示命令
 */
class ListCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行配置列表显示
   * @param {Array} args 参数
   */
  async execute(args = []) {
    const spinner = ora('正在加载配置...').start();
    
    try {
      // 检查配置文件是否存在
      if (!await this.configManager.configExists()) {
        spinner.fail();
        
        const errorMessage = formatError(
          '配置文件不存在',
          '无法找到 ~/.claude/api_configs.json 文件',
          '请确保Claude Code已正确安装并配置了API设置'
        );
        
        console.log(errorMessage);
        return;
      }

      // 读取所有配置
      const allConfigs = await this.configManager.getAllConfigs();
      
      if (!this.configManager.validateConfig(allConfigs)) {
        spinner.fail();
        showError('配置文件格式无效');
        showInfo('请检查配置文件格式是否正确');
        return;
      }

      // 读取当前配置
      const currentConfig = await this.configManager.getCurrentConfig();
      
      spinner.succeed('配置加载完成');

      // 显示配置列表
      const configList = formatConfigList(allConfigs, currentConfig);
      console.log(configList);

      // 等待用户确认后返回
      await waitForBackConfirm('配置信息显示完成');

    } catch (error) {
      spinner.fail();
      
      if (error.message.includes('配置文件不存在')) {
        const errorMessage = formatError(
          'API配置文件访问失败',
          error.message,
          '1. 确保Claude Code已正确安装\n2. 检查用户目录权限\n3. 尝试重新配置Claude Code'
        );
        console.log(errorMessage);
      } else {
        showError(`读取配置失败: ${error.message}`);
      }
    }
  }
}

export default new ListCommand();