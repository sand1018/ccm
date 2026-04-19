import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';

import ConfigManager from '../../core/ConfigManager.js';
import { showError, showSuccess, showInfo, showWarning } from '../../utils/ui.js';
import { formatError } from '../../utils/formatter.js';

/**
 * API配置添加命令
 */
class AddCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行添加新配置
   * @param {Array} args 参数
   */
  async execute(args = []) {
    try {
      showInfo('📝 交互式添加API配置');
      
      // 检查配置文件是否存在
      const configExists = await this.configManager.configExists();
      
      if (!configExists) {
        const createConfig = await this.askCreateConfigFile();
        if (!createConfig) {
          showInfo('取消操作');
          return;
        }
        await this.createEmptyConfigFile();
      }

      // 开始配置创建流程
      await this.startConfigCreation();

    } catch (error) {
      showError(`添加配置操作失败: ${error.message}`);
    }
  }

  /**
   * 询问是否创建配置文件
   */
  async askCreateConfigFile() {
    console.log(chalk.yellow('\n⚠️  配置文件不存在'));
    console.log(chalk.gray('需要先创建配置文件才能添加配置'));
    
    const { create } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'create',
        message: '是否创建新的配置文件？',
        default: true
      }
    ]);

    return create;
  }

  /**
   * 创建空的配置文件
   */
  async createEmptyConfigFile() {
    const spinner = ora('创建配置文件...').start();
    
    try {
      await this.configManager.ensureConfigDir();
      
      const emptyConfig = {
        sites: {}
      };
      
      await fs.writeFile(
        this.configManager.configPath, 
        JSON.stringify(emptyConfig, null, 2), 
        'utf8'
      );
      
      spinner.succeed('配置文件创建成功');
      showSuccess(`配置文件已创建: ${this.configManager.configPath}`);
      
    } catch (error) {
      spinner.fail();
      throw new Error(`创建配置文件失败: ${error.message}`);
    }
  }

  /**
   * 开始配置创建流程
   */
  async startConfigCreation() {
    console.log(chalk.cyan('\n🚀 开始创建新的API配置'));
    console.log(chalk.gray('请按照提示逐步输入配置信息\n'));

    // 1. 基本信息
    const basicInfo = await this.collectBasicInfo();
    
    // 2. URL配置
    const url = await this.collectUrl();
    
    // 3. Token配置
    const tokens = await this.collectTokens();
    
    // 4. 确认和保存
    await this.confirmAndSave(basicInfo, url, tokens);
  }

  /**
   * 收集基本信息
   */
  async collectBasicInfo() {
    console.log(chalk.white.bold('📋 第1步: 基本信息'));
    
    // 获取现有配置以检查重复
    let existingConfig = {};
    try {
      existingConfig = await this.configManager.getAllConfigs();
    } catch (error) {
      // 配置文件可能为空，忽略错误
    }

    const questions = [
      {
        type: 'input',
        name: 'siteKey',
        message: '站点标识 (用于内部识别，支持中英文):',
        validate: (input) => {
          if (!input.trim()) {
            return '站点标识不能为空';
          }
          if (existingConfig.sites && existingConfig.sites[input]) {
            return `站点标识 "${input}" 已存在，请使用其他标识`;
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: '站点描述 (可选):',
        default: ''
      }
    ];

    return await inquirer.prompt(questions);
  }

  /**
   * 收集URL配置
   */
  async collectUrl() {
    console.log(chalk.white.bold('\n📡 第2步: ANTHROPIC_BASE_URL配置'));
    
    const urlInfo = await inquirer.prompt([
      {
        type: 'input',
        name: 'urlValue',
        message: 'ANTHROPIC_BASE_URL地址:',
        validate: (input) => {
          if (!input.trim()) {
            return 'URL地址不能为空';
          }
          try {
            new URL(input);
            return true;
          } catch (error) {
            return '请输入有效的URL地址 (如: https://api.example.com)';
          }
        }
      }
    ]);

    console.log(chalk.green(`✓ ANTHROPIC_BASE_URL: ${urlInfo.urlValue}`));
    
    return urlInfo.urlValue;
  }

  /**
   * 收集Token配置
   */
  async collectTokens() {
    console.log(chalk.white.bold('\n🔑 第3步: ANTHROPIC_AUTH_TOKEN配置'));
    
    const tokens = {};
    let continueAdding = true;
    let tokenCount = 0;

    while (continueAdding) {
      tokenCount++;
      console.log(chalk.gray(`\n添加第 ${tokenCount} 个Token:`));

      const tokenInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenName',
          message: 'Token名称 (如: 主账号, 测试账号):',
          validate: (input) => {
            if (!input.trim()) {
              return 'Token名称不能为空';
            }
            if (tokens[input]) {
              return `Token名称 "${input}" 已存在`;
            }
            return true;
          }
        },
        {
          type: 'password',
          name: 'tokenValue',
          message: 'Token值:',
          mask: '*',
          validate: (input) => {
            if (!input.trim()) {
              return 'Token值不能为空';
            }
            if (input.length < 10) {
              return 'Token值长度不能少于10个字符';
            }
            return true;
          }
        }
      ]);

      tokens[tokenInfo.tokenName] = tokenInfo.tokenValue;
      console.log(chalk.green(`✓ 已添加Token: ${tokenInfo.tokenName} -> ${tokenInfo.tokenValue.substring(0, 10)}...`));

      if (tokenCount === 1) {
        const { addMore } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addMore',
            message: '是否添加更多Token？',
            default: false
          }
        ]);
        continueAdding = addMore;
      } else {
        const { addMore } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addMore',
            message: '是否继续添加Token？',
            default: false
          }
        ]);
        continueAdding = addMore;
      }
    }

    return tokens;
  }

  /**
   * 确认并保存配置
   */
  async confirmAndSave(basicInfo, url, tokens) {
    console.log(chalk.white.bold('\n📝 第4步: 确认配置'));
    
    // 显示配置预览
    console.log(chalk.cyan('\n配置预览:'));
    console.log(chalk.white(`站点标识: ${chalk.yellow(basicInfo.siteKey)}`));
    if (basicInfo.description) {
      console.log(chalk.white(`站点描述: ${chalk.yellow(basicInfo.description)}`));
    }
    
    console.log(chalk.white(`\nANTHROPIC_BASE_URL: ${chalk.yellow(url)}`));
    
    console.log(chalk.white(`\nANTHROPIC_AUTH_TOKEN配置 (${Object.keys(tokens).length}个):`));
    Object.entries(tokens).forEach(([name, token]) => {
      console.log(chalk.gray(`  ${name}: ${token.substring(0, 15)}...`));
    });

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '\n确认保存此配置？',
        default: true
      }
    ]);

    if (!confirm) {
      showWarning('取消保存配置');
      return;
    }

    // 保存配置
    const spinner = ora('保存配置...').start();
    
    try {
      // 读取现有配置
      let allConfigs = {};
      try {
        allConfigs = await this.configManager.getAllConfigs();
      } catch (error) {
        allConfigs = { sites: {} };
      }

      // 添加新配置（使用标准的claude字段）
      allConfigs.sites[basicInfo.siteKey] = {
        url: url, // 站点URL
        claude: {
          env: {
            ANTHROPIC_BASE_URL: url,
            ANTHROPIC_AUTH_TOKEN: tokens
          }
        }
      };

      // 添加描述字段（如果有）
      if (basicInfo.description) {
        allConfigs.sites[basicInfo.siteKey].description = basicInfo.description;
      }

      // 保存到文件
      await fs.writeFile(
        this.configManager.configPath,
        JSON.stringify(allConfigs, null, 2),
        'utf8'
      );

      spinner.succeed('配置保存成功');
      
      showSuccess(`🎉 API配置 "${basicInfo.siteKey}" 已成功添加！`);
      showInfo(`配置文件位置: ${this.configManager.configPath}`);
      showInfo(`使用 ${chalk.cyan('ccm api --list')} 查看所有配置`);
      showInfo(`使用 ${chalk.cyan('ccm api')} 切换到新配置`);

    } catch (error) {
      spinner.fail();
      throw new Error(`保存配置失败: ${error.message}`);
    }
  }
}

export default new AddCommand();
