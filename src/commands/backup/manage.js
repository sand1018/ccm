import chalk from "chalk";
import inquirer from "inquirer";
import WebDAVClient from "./webdav-client.js";

/**
 * 远程备份管理器
 */
class BackupManageManager {
  constructor(options = {}) {
    this.webdavClient = options.webdavClient || new WebDAVClient();
    this.prompt = options.prompt || inquirer.prompt;
  }

  /**
   * 执行远程备份管理流程
   * @returns {Object} 管理操作结果
   */
  async performBackupManagement() {
    try {
      console.log(chalk.cyan.bold("\n🗂️ 远程备份管理\n"));

      await this.webdavClient.initialize();

      const backups = await this.listRemoteBackups();
      if (backups.length === 0) {
        console.log(chalk.yellow("📭 未找到任何远程备份文件"));
        return this.buildResult("empty");
      }

      const selectedBackups = await this.selectBackupsToDelete(backups);
      if (selectedBackups.length === 0) {
        console.log(chalk.yellow("ℹ️ 未选择任何备份，删除已取消"));
        return this.buildResult("cancelled");
      }

      const confirmed = await this.confirmDelete(selectedBackups);
      if (!confirmed) {
        console.log(chalk.yellow("ℹ️ 用户取消删除远程备份"));
        return this.buildResult("cancelled");
      }

      const result = await this.deleteSelectedBackups(selectedBackups);
      this.showDeleteResult(result);
      return result;
    } catch (error) {
      console.error(chalk.red("\n❌ 管理远程备份失败:"), error.message);
      throw error;
    }
  }

  /**
   * 获取远程备份列表
   * @returns {Array} 远程备份列表
   */
  async listRemoteBackups() {
    return this.webdavClient.listBackups();
  }

  /**
   * 选择要删除的远程备份
   * @param {Array} backups 远程备份列表
   * @returns {Array} 选中的远程备份
   */
  async selectBackupsToDelete(backups) {
    const choices = backups.map((backup) => ({
      name: this.formatBackupChoice(backup),
      value: backup,
      short: backup.name,
    }));

    choices.push(new inquirer.Separator());
    choices.push({
      name: "取消操作",
      value: "__cancel__",
      short: "取消",
    });

    const { selectedBackups } = await this.prompt([
      {
        type: "checkbox",
        name: "selectedBackups",
        message: "请选择要删除的远程备份（空格选择/取消选择）：",
        choices,
        pageSize: 10,
        validate: (input) => {
          if (input.includes("__cancel__")) {
            return true;
          }

          if (input.length === 0) {
            return "请至少选择一个远程备份，或选择取消操作";
          }

          return true;
        },
      },
    ]);

    if (selectedBackups.includes("__cancel__")) {
      return [];
    }

    return selectedBackups;
  }

  /**
   * 格式化备份选择项
   * @param {Object} backup 远程备份信息
   * @returns {string} 选择项展示文本
   */
  formatBackupChoice(backup) {
    return `${backup.name} (${this.formatFileSize(backup.size)}, ${backup.lastModified.toLocaleString()})`;
  }

  /**
   * 确认删除远程备份
   * @param {Array} selectedBackups 选中的远程备份
   * @returns {boolean} 是否确认删除
   */
  async confirmDelete(selectedBackups) {
    console.log(chalk.yellow("\n⚠️ 即将永久删除以下远程备份："));

    for (const backup of selectedBackups) {
      console.log(
        chalk.gray(
          `• ${backup.name} (${this.formatFileSize(backup.size)}, ${backup.lastModified.toLocaleString()})`
        )
      );
    }

    console.log(chalk.red("\n删除后无法通过 CCM 自动恢复这些远程备份。"));

    const { confirmed } = await this.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: `确认删除选中的 ${selectedBackups.length} 个远程备份？`,
        default: false,
      },
    ]);

    return confirmed;
  }

  /**
   * 删除选中的远程备份
   * @param {Array} selectedBackups 选中的远程备份
   * @returns {{status:string,success:Array,failed:Array}} 删除结果
   */
  async deleteSelectedBackups(selectedBackups) {
    const result = this.buildResult("deleted");

    for (const backup of selectedBackups) {
      try {
        await this.webdavClient.deleteBackup(backup.path);
        result.success.push(backup);
      } catch (error) {
        result.failed.push({
          backup,
          error,
        });
        console.error(chalk.red(`❌ 删除失败 ${backup.name}: ${error.message}`));
      }
    }

    return result;
  }

  /**
   * 显示删除结果
   * @param {{success:Array,failed:Array}} result 删除结果
   */
  showDeleteResult(result) {
    console.log(chalk.green("\n✅ 远程备份删除完成"));
    console.log(chalk.gray(`成功删除: ${result.success.length} 个`));

    if (result.failed.length > 0) {
      console.log(chalk.yellow(`删除失败: ${result.failed.length} 个`));

      for (const { backup, error } of result.failed) {
        console.log(chalk.gray(`• ${backup.name}: ${error.message}`));
      }
    }
  }

  /**
   * 创建流程结果对象
   * @param {string} status 结果状态
   * @returns {{status:string,success:Array,failed:Array}}
   */
  buildResult(status) {
    return {
      status,
      success: [],
      failed: [],
    };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

export default BackupManageManager;
