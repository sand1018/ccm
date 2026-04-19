import chalk from 'chalk';
import inquirer from 'inquirer';
import { createBackChoice } from '../../utils/ui.js';

/**
 * 备份命令主控制器
 */
class BackupCommand {
  /**
   * 执行备份命令
   * @param {Array} args 命令参数
   */
  async execute(args = []) {
    while (true) {
      try {
        const choice = await this.showBackupMenu();

        if (choice === 'back') {
          break;
        }

        switch (choice) {
          case 'backup':
            await this.handleBackup();
            break;
          case 'restore':
            await this.handleRestore();
            break;
          case 'status':
            await this.handleStatus();
            break;
        }
      } catch (error) {
        console.error(chalk.red('❌ 备份操作失败:'), error.message);

        const { continueOnError } = await inquirer.prompt([
          {
            type: 'list',
            name: 'continueOnError',
            message: '发生错误，请选择下一步操作：',
            choices: [
              {
                name: '🔄 继续使用',
                value: true,
                short: '继续'
              },
              createBackChoice('back')
            ],
            default: 0
          }
        ]);

        if (continueOnError === 'back') {
          break;
        }
      }
    }
  }

  /**
   * 显示备份菜单
   * @returns {string} 用户选择
   */
  async showBackupMenu() {
    console.log(chalk.cyan.bold('\n🔄 备份与恢复'));
    console.log(chalk.gray('═'.repeat(40)));

    const choices = [
      {
        name: '📤 手动备份 - 选择配置进行备份',
        value: 'backup',
        short: '手动备份'
      },
      {
        name: '📥 恢复数据 - 从云端存储恢复配置',
        value: 'restore',
        short: '恢复数据'
      },
      {
        name: '📊 备份状态 - 查看备份历史和状态',
        value: 'status',
        short: '备份状态'
      },
      new inquirer.Separator(),
      createBackChoice('back')
    ];

    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: '请选择操作：',
        choices,
        pageSize: 10
      }
    ]);

    return choice;
  }

  /**
   * 处理手动备份
   */
  async handleBackup() {
    try {
      const { default: BackupManager } = await import('./backup.js');
      const backupManager = new BackupManager();

      await backupManager.performBackup();
      await this.waitForBack();
    } catch (error) {
      console.error(chalk.red('❌ 备份失败:'), error.message);
      await this.waitForBack();
    }
  }

  /**
   * 处理恢复数据
   */
  async handleRestore() {
    try {
      const { default: RestoreManager } = await import('./restore.js');
      const restoreManager = new RestoreManager();

      await restoreManager.performRestore();
      await this.waitForBack();
    } catch (error) {
      console.error(chalk.red('❌ 恢复失败:'), error.message);
      await this.waitForBack();
    }
  }

  /**
   * 处理备份状态
   */
  async handleStatus() {
    try {
      await this.showBackupStatus();
      await this.waitForBack();
    } catch (error) {
      console.error(chalk.red('❌ 获取状态失败:'), error.message);
      await this.waitForBack();
    }
  }

  /**
   * 显示备份状态
   */
  async showBackupStatus() {
    const ora = (await import('ora')).default;
    const { default: FileManager } = await import('./file-manager.js');
    const { default: WebDAVClient } = await import('./webdav-client.js');

    console.log(chalk.cyan.bold('\n📊 备份状态报告\n'));

    // 检查本地文件状态
    console.log(chalk.white('🔍 本地配置文件状态：'));
    const localSpinner = ora('检查本地文件').start();

    try {
      const fileManager = new FileManager();
      const checkResult = await fileManager.checkAllFiles();
      localSpinner.succeed('本地文件检查完成');

      console.log(fileManager.formatCheckResult(checkResult));
    } catch (error) {
      localSpinner.fail('本地文件检查失败');
      console.error(chalk.red(`错误: ${error.message}`));
    }

    // 云端存储状态
    console.log(chalk.white('\n☁️ 云端存储状态：'));
    const cloudSpinner = ora('检查WebDAV连接').start();

    try {
      const webdavClient = new WebDAVClient();
      const isConfigured = await webdavClient.loadSavedConfig();

      if (isConfigured && await webdavClient.testConnection()) {
        cloudSpinner.succeed('WebDAV连接正常');

        const serverInfo = webdavClient.getServerInfo();
        console.log(chalk.green('✅ 云端存储已配置且连接正常'));
        console.log(chalk.gray(`📍 服务类型: ${serverInfo.serverType}`));
        console.log(chalk.gray(`🔗 服务地址: ${serverInfo.url}`));
        console.log(chalk.gray(`👤 用户名: ${serverInfo.username}`));

        // 获取备份文件列表
        try {
          const backups = await webdavClient.listBackups();
          console.log(chalk.gray(`📦 云端备份: ${backups.length} 个文件`));

          if (backups.length > 0) {
            const latestBackup = backups[0];
            console.log(chalk.gray(`🕒 最新备份: ${latestBackup.name} (${latestBackup.lastModified.toLocaleString()})`));
          }
        } catch (error) {
          console.log(chalk.yellow('⚠️ 获取备份列表失败，但连接正常'));
        }

      } else {
        cloudSpinner.warn('WebDAV未配置或连接失败');
        console.log(chalk.yellow('⚠️ 云端存储未配置或连接失败'));
        console.log(chalk.gray('• 首次使用时会自动引导配置'));
        console.log(chalk.gray('• 支持坚果云、Nextcloud、ownCloud等WebDAV服务'));
      }
    } catch (error) {
      cloudSpinner.fail('WebDAV状态检查失败');
      console.error(chalk.red(`云端存储检查失败: ${error.message}`));
    }

    console.log(chalk.blue('\n💡 功能状态：'));
    console.log(chalk.gray('• ✅ 配置文件检查和状态显示'));
    console.log(chalk.gray('• ✅ 本地备份数据收集'));
    console.log(chalk.gray('• ✅ WebDAV云端备份'));
    console.log(chalk.gray('• ✅ 选择性配置恢复'));
    console.log(chalk.gray('• ✅ 自动清理旧备份 (保留5个)'));
  }

  /**
   * 等待用户返回
   */
  async waitForBack() {
    await inquirer.prompt([
      {
        type: 'list',
        name: 'back',
        message: '操作完成：',
        choices: [createBackChoice('back')]
      }
    ]);
  }
}

export default new BackupCommand();