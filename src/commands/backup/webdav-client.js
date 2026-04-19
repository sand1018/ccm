import { createClient } from 'webdav';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * WebDAV客户端管理器
 */
class WebDAVClient {
  constructor() {
    this.configPath = path.join(os.homedir(), '.cc-cli', 'webdav-config.json');
    this.client = null;
    this.config = null;
  }

  /**
   * 初始化WebDAV客户端
   */
  async initialize() {
    try {
      // 尝试加载已保存的配置
      if (await this.loadSavedConfig()) {
        await this.testConnection();
        console.log(chalk.green('✅ WebDAV客户端初始化成功'));
        return;
      }

      // 如果没有配置，提示用户配置
      await this.setupWebDAV();
      console.log(chalk.green('✅ WebDAV客户端初始化成功'));
    } catch (error) {
      throw new Error(`WebDAV客户端初始化失败: ${error.message}`);
    }
  }

  /**
   * 加载已保存的配置
   * @returns {boolean} 是否成功加载配置
   */
  async loadSavedConfig() {
    try {
      if (!await fs.pathExists(this.configPath)) {
        return false;
      }

      this.config = await fs.readJson(this.configPath);

      // 创建WebDAV客户端
      this.client = createClient(this.config.url, {
        username: this.config.username,
        password: this.config.password
      });

      console.log(chalk.green('✅ 已加载保存的WebDAV配置'));
      return true;
    } catch (error) {
      console.warn(chalk.yellow('⚠️ 加载WebDAV配置失败，需要重新设置'));
      return false;
    }
  }

  /**
   * 设置WebDAV连接
   */
  async setupWebDAV() {
    console.log(chalk.cyan.bold('\n🔧 WebDAV 配置向导\n'));

    console.log(chalk.white('支持的WebDAV服务：'));
    console.log(chalk.gray('• 坚果云 (https://dav.jianguoyun.com/dav/)优选 其他未测试'));
    console.log(chalk.gray('• 其他支持WebDAV的云存储服务'));
    console.log(chalk.gray('━'.repeat(60)));

    const config = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'WebDAV服务器地址:',
        default: 'https://dav.jianguoyun.com/dav/',
        validate: (input) => {
          if (!input.trim()) {
            return 'WebDAV地址不能为空';
          }
          if (!input.startsWith('http://') && !input.startsWith('https://')) {
            return '请输入有效的HTTP/HTTPS地址';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'username',
        message: '用户名:',
        validate: (input) => {
          if (!input.trim()) {
            return '用户名不能为空';
          }
          return true;
        }
      },
      {
        type: 'password',
        name: 'password',
        message: '密码 (或应用专用密码):',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) {
            return '密码不能为空';
          }
          return true;
        }
      }
    ]);

    // 测试连接
    console.log(chalk.blue('🔍 测试WebDAV连接...'));

    try {
      const testClient = createClient(config.url, {
        username: config.username,
        password: config.password
      });

      // 尝试获取根目录内容来测试连接
      await testClient.getDirectoryContents('/');

      console.log(chalk.green('✅ WebDAV连接测试成功'));

      // 保存配置
      this.config = config;
      this.client = testClient;
      await this.saveConfig();

      // 确保备份目录存在
      await this.ensureBackupDirectory();

    } catch (error) {
      console.error(chalk.red('❌ WebDAV连接测试失败:'), error.message);

      console.log(chalk.yellow('\n💡 常见问题解决：'));
      console.log(chalk.gray('• 检查WebDAV地址是否正确'));
      console.log(chalk.gray('• 确认用户名和密码是否正确'));
      console.log(chalk.gray('• 某些服务需要应用专用密码（如坚果云）'));
      console.log(chalk.gray('• 检查网络连接是否正常'));

      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: '是否重新配置？',
          default: true
        }
      ]);

      if (retry) {
        return await this.setupWebDAV();
      } else {
        throw new Error('WebDAV配置失败');
      }
    }
  }

  /**
   * 保存配置到本地
   */
  async saveConfig() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, this.config, { spaces: 2 });
      console.log(chalk.green('✅ WebDAV配置已保存'));
    } catch (error) {
      console.error(chalk.red('❌ 保存WebDAV配置失败:'), error.message);
    }
  }

  /**
   * 确保备份目录存在
   */
  async ensureBackupDirectory() {
    try {
      const backupDir = '/cc-cli-backups';

      // 检查目录是否存在
      const exists = await this.client.exists(backupDir);

      if (!exists) {
        await this.client.createDirectory(backupDir);
        console.log(chalk.green(`✅ 创建备份目录: ${backupDir}`));
      } else {
        console.log(chalk.green(`✅ 备份目录已存在: ${backupDir}`));
      }
    } catch (error) {
      throw new Error(`创建备份目录失败: ${error.message}`);
    }
  }

  /**
   * 上传备份文件
   * @param {string} fileName 文件名
   * @param {Object} data 备份数据
   * @param {string} category 备份类别
   * @returns {string} 上传后的文件路径
   */
  async uploadBackup(fileName, data, category) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const content = JSON.stringify(data, null, 2);
      const remotePath = `/cc-cli-backups/${fileName}`;

      console.log(chalk.blue(`📤 上传备份文件: ${fileName}`));

      await this.client.putFileContents(remotePath, content, {
        contentLength: Buffer.byteLength(content, 'utf8'),
        overwrite: true
      });

      console.log(chalk.green(`✅ 上传成功: ${fileName}`));
      return remotePath;
    } catch (error) {
      throw new Error(`上传备份文件失败: ${error.message}`);
    }
  }

  /**
   * 列出所有备份文件
   * @returns {Array} 备份文件列表
   */
  async listBackups() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      console.log(chalk.blue('📋 获取备份文件列表...'));

      const contents = await this.client.getDirectoryContents('/cc-cli-backups');

      const backupFiles = contents
        .filter(item => item.type === 'file' && item.filename.endsWith('.json'))
        .map(item => ({
          name: path.basename(item.filename),
          path: item.filename,
          size: item.size,
          lastModified: new Date(item.lastmod),
          category: this.extractCategory(path.basename(item.filename)),
          timestamp: this.extractTimestamp(path.basename(item.filename))
        }))
        .sort((a, b) => b.lastModified - a.lastModified);

      console.log(chalk.green(`✅ 找到 ${backupFiles.length} 个备份文件`));
      return backupFiles;
    } catch (error) {
      throw new Error(`获取备份列表失败: ${error.message}`);
    }
  }

  /**
   * 下载备份文件
   * @param {string} remotePath 远程文件路径
   * @returns {Object} 备份数据
   */
  async downloadBackup(remotePath) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      console.log(chalk.blue(`📥 下载备份文件: ${path.basename(remotePath)}`));

      const content = await this.client.getFileContents(remotePath, { format: 'text' });
      const data = JSON.parse(content);

      console.log(chalk.green('✅ 备份文件下载成功'));
      return data;
    } catch (error) {
      throw new Error(`下载备份文件失败: ${error.message}`);
    }
  }

  /**
   * 删除备份文件
   * @param {string} remotePath 远程文件路径
   */
  async deleteBackup(remotePath) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      console.log(chalk.blue(`🗑️ 删除备份文件: ${path.basename(remotePath)}`));

      await this.client.deleteFile(remotePath);

      console.log(chalk.green('✅ 备份文件删除成功'));
    } catch (error) {
      throw new Error(`删除备份文件失败: ${error.message}`);
    }
  }

  /**
   * 测试连接状态
   * @returns {boolean} 连接是否正常
   */
  async testConnection() {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.getDirectoryContents('/');
      return true;
    } catch (error) {
      console.error(chalk.red('❌ WebDAV连接测试失败:'), error.message);
      return false;
    }
  }

  /**
   * 获取WebDAV服务信息
   * @returns {Object} 服务信息
   */
  getServerInfo() {
    if (!this.config) {
      return null;
    }

    return {
      url: this.config.url,
      username: this.config.username,
      serverType: this.detectServerType(this.config.url)
    };
  }

  /**
   * 检测服务器类型
   * @param {string} url WebDAV地址
   * @returns {string} 服务器类型
   */
  detectServerType(url) {
    if (url.includes('jianguoyun.com')) return '坚果云';
    if (url.includes('nextcloud')) return 'Nextcloud';
    if (url.includes('owncloud')) return 'ownCloud';
    return '通用WebDAV';
  }

  /**
   * 从文件名提取类别
   * @param {string} fileName 文件名
   * @returns {string} 类别
   */
  extractCategory(fileName) {
    if (fileName.includes('cc-cli')) return 'CC-CLI配置';
    if (fileName.includes('claude-code')) return 'Claude Code配置';
    if (fileName.includes('codex')) return 'Codex配置';
    return '未知';
  }

  /**
   * 从文件名提取时间戳
   * @param {string} fileName 文件名
   * @returns {Date|null} 时间戳
   */
  extractTimestamp(fileName) {
    const timeMatch = fileName.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const [year, month, day, hour, minute, second] = timeStr.split('-').map(Number);
      return new Date(year, month - 1, day, hour, minute, second);
    }
    return null;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 清除保存的配置
   */
  async clearConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        await fs.remove(this.configPath);
        console.log(chalk.green('✅ 已清除WebDAV配置'));
      }

      this.client = null;
      this.config = null;
    } catch (error) {
      console.error(chalk.red('❌ 清除WebDAV配置失败:'), error.message);
    }
  }
}

export default WebDAVClient;