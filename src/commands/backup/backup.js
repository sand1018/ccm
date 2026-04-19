import fs from "fs-extra";
import path from "path";
import os from "os";
import crypto from "crypto";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import FileManager from "./file-manager.js";
import WebDAVClient from "./webdav-client.js";

/**
 * 备份功能实现
 */
class BackupManager {
  constructor() {
    this.fileManager = new FileManager();
    this.webdavClient = new WebDAVClient();
  }

  /**
   * 执行多选备份流程
   */
  async performBackup() {
    try {
      console.log(chalk.cyan.bold("\n📤 配置备份向导\n"));

      const shouldContinue = await this.checkAndMigrateOldConfig();
      if (!shouldContinue) {
        console.log(chalk.yellow("ℹ️ 备份已取消"));
        return;
      }

      await this.showFileStatus();

      const selectedCategories = await this.selectBackupCategories();
      if (selectedCategories.length === 0) {
        console.log(chalk.yellow("ℹ️ 未选择任何配置类别，备份已取消"));
        return;
      }

      const confirmed = await this.confirmBackup(selectedCategories);
      if (!confirmed) {
        console.log(chalk.yellow("ℹ️ 用户取消备份"));
        return;
      }

      const backupData = await this.collectBackupData(selectedCategories);
      await this.uploadToWebDAV(backupData, selectedCategories);

      console.log(chalk.green("\n✅ 备份完成！"));
    } catch (error) {
      console.error(chalk.red("\n❌ 备份失败:"), error.message);
      throw error;
    }
  }

  /**
   * 显示文件状态
   */
  async showFileStatus() {
    console.log(chalk.blue("🔍 正在检查配置文件..."));

    const spinner = ora("检查文件状态").start();
    try {
      const checkResult = await this.fileManager.checkAllFiles();
      spinner.succeed("文件状态检查完成");

      console.log("\n📋 配置文件状态：");
      console.log(this.fileManager.formatCheckResult(checkResult));
    } catch (error) {
      spinner.fail("文件状态检查失败");
      throw error;
    }
  }

  /**
   * 选择备份类别
   * @returns {Array} 选中的类别列表
   */
  async selectBackupCategories() {
    const categories = [
      {
        name: "🔧 CCM配置 (.ccm/)",
        value: "ccCli",
        short: "CCM配置",
        checked: true,
      },
      {
        name: "🎯 Claude Code配置 (settings.json, config.json, CLAUDE.md, agents/, commands/, skills/)",
        value: "claudeCode",
        short: "Claude Code配置",
      },
      {
        name: "⚙️ Codex配置 (config.toml, auth.json, AGENTS, prompts/, skills/, ~/.agents/skills/)",
        value: "codex",
        short: "Codex配置",
      },
      {
        name: "🪐 Gemini CLI配置 (settings.json, .env, GEMINI.md, commands/, agents/, skills/, antigravity/)",
        value: "geminiCli",
        short: "Gemini CLI配置",
      },
    ];

    const { selectedCategories } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedCategories",
        message: "请选择要备份的配置类别：",
        choices: categories,
        validate: (input) => {
          if (input.length === 0) {
            return "请至少选择一个配置类别";
          }
          return true;
        },
      },
    ]);

    return selectedCategories;
  }

  /**
   * 确认备份信息
   * @param {Array} categories 选中的类别
   * @returns {boolean} 是否确认备份
   */
  async confirmBackup(categories) {
    console.log(chalk.white("\n📋 备份确认信息："));

    for (const category of categories) {
      const config = this.fileManager.getCategoryPaths(category);
      console.log(chalk.cyan(`\n${config.name}:`));

      for (const entry of config.entries || []) {
        const exists = await fs.pathExists(entry.path);
        const icon = exists ? "✅" : "❌";
        const suffix = entry.type === "directory" ? "/" : "";
        console.log(chalk.gray(`  ${icon} ${(entry.label || entry.key)}${suffix}`));
      }
    }

    const timestamp = new Date().toLocaleString();
    console.log(chalk.gray(`\n备份时间: ${timestamp}`));
    console.log(chalk.gray("备份位置: 本地已收集，等待配置云端存储"));

    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "确认执行备份？",
        default: true,
      },
    ]);

    return confirmed;
  }

  /**
   * 收集备份数据
   * @param {Array} categories 选中的类别
   * @returns {Object} 备份数据
   */
  async collectBackupData(categories) {
    const spinner = ora("收集备份数据").start();
    const backupData = {
      type: "cc-backup",
      version: "3.0.0",
      manifestVersion: this.fileManager.manifest.version,
      timestamp: new Date().toISOString(),
      categories: {},
    };

    try {
      for (const category of categories) {
        spinner.text = `收集 ${category} 配置数据`;

        const config = this.fileManager.getCategoryPaths(category);
        const entries = await this.collectCategoryEntries(category, config.entries || []);

        backupData.categories[category] = {
          name: config.name,
          entries,
          metadata: {
            collectedAt: new Date().toISOString(),
            platform: process.platform,
            nodeVersion: process.version,
            warnings: this.buildCategoryWarnings(entries),
          },
        };
      }

      spinner.succeed("备份数据收集完成");
      return backupData;
    } catch (error) {
      spinner.fail("备份数据收集失败");
      throw error;
    }
  }

  /**
   * 收集单个类别的所有条目
   * @param {string} category 类别名称
   * @param {Array<Object>} entries 清单条目
   * @returns {Array<Object>} 采集结果
   */
  async collectCategoryEntries(category, entries) {
    const collectedEntries = [];
    const queue = [...entries];
    const seen = new Set();

    while (queue.length > 0) {
      const entry = queue.shift();
      const identity = `${entry.type}:${entry.path}`;
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);

      const collected = await this.collectManifestEntry(entry);
      if (Array.isArray(collected)) {
        collectedEntries.push(...collected);
      } else if (collected) {
        collectedEntries.push(collected);
      }

      const referencedEntries = await this.collectReferencedEntries(category, entry);
      for (const referencedEntry of referencedEntries) {
        queue.push(referencedEntry);
      }
    }

    return collectedEntries;
  }

  /**
   * 收集清单条目
   * @param {Object} entry 清单条目
   * @returns {Object|Array<Object>} 条目数据
   */
  async collectManifestEntry(entry) {
    if (entry.type === "directory") {
      return this.collectDirectoryEntry(entry);
    }

    return this.collectFileEntry(entry);
  }

  /**
   * 收集单个文件条目
   * @param {Object} entry 文件条目
   * @returns {Object} 文件备份数据
   */
  async collectFileEntry(entry) {
    const exists = await fs.pathExists(entry.path);
    if (!exists) {
      return this.createMissingEntry(entry, "文件不存在");
    }

    const buffer = await this.readEntryBuffer(entry);
    const stat = await fs.stat(entry.path);

    return {
      entryType: "file",
      key: entry.key,
      rootPath: entry.path,
      portablePath: this.toPortablePath(entry.path),
      relativePath: entry.relativePath || path.basename(entry.path),
      required: entry.required,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      mode: stat.mode,
      sha256: this.calculateSha256(buffer),
      encoding: "base64",
      contentBase64: buffer.toString("base64"),
    };
  }

  /**
   * 按条目类型读取需要写入备份的数据
   * @param {Object} entry 文件条目
   * @returns {Promise<Buffer>} 文件内容
   */
  async readEntryBuffer(entry) {
    const buffer = await fs.readFile(entry.path);

    if (entry.key === "claude.mcpUserConfig") {
      return this.extractClaudeUserMcpBuffer(buffer);
    }

    return buffer;
  }

  /**
   * 从 ~/.claude.json 中仅提取用户级 mcpServers
   * @param {Buffer} buffer 原始文件内容
   * @returns {Buffer} 精简后的 JSON 内容
   */
  extractClaudeUserMcpBuffer(buffer) {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      const sanitized = {
        mcpServers:
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed.mcpServers || {}
            : {},
      };

      return Buffer.from(JSON.stringify(sanitized, null, 2));
    } catch (error) {
      return buffer;
    }
  }

  /**
   * 收集目录条目
   * @param {Object} entry 目录条目
   * @returns {Array<Object>} 目录及其文件条目
   */
  async collectDirectoryEntry(entry) {
    const exists = await fs.pathExists(entry.path);
    if (!exists) {
      return [this.createMissingEntry(entry, "目录不存在")];
    }

    const stat = await fs.stat(entry.path);
    const directoryEntry = {
      entryType: "directory",
      key: entry.key,
      rootPath: entry.path,
      portablePath: this.toPortablePath(entry.path),
      relativePath: ".",
      required: entry.required,
      size: 0,
      mtime: stat.mtime.toISOString(),
      mode: stat.mode,
      fileCount: 0,
    };

    const files = await this.collectDirectoryFiles(entry.path, entry.path, entry);
    directoryEntry.fileCount = files.length;

    return [directoryEntry, ...files];
  }

  /**
   * 递归收集目录中的文件
   * @param {string} rootPath 目录根路径
   * @param {string} currentPath 当前路径
   * @param {Object} entry 原始条目
   * @returns {Array<Object>} 文件条目
   */
  async collectDirectoryFiles(rootPath, currentPath, entry) {
    const results = [];
    const items = await fs.readdir(currentPath, { withFileTypes: true });

    for (const item of items) {
      if (this.shouldSkipDirectoryItem(item.name)) {
        continue;
      }

      const itemPath = path.join(currentPath, item.name);

      if (item.isDirectory()) {
        results.push(...(await this.collectDirectoryFiles(rootPath, itemPath, entry)));
        continue;
      }

      if (!item.isFile()) {
        continue;
      }

      const buffer = await fs.readFile(itemPath);
      const stat = await fs.stat(itemPath);

      results.push({
        entryType: "file",
        key: entry.key,
        rootPath,
        portableRootPath: this.toPortablePath(rootPath),
        relativePath: this.toPortableSubpath(path.relative(rootPath, itemPath)),
        required: entry.required,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        mode: stat.mode,
        sha256: this.calculateSha256(buffer),
        encoding: "base64",
        contentBase64: buffer.toString("base64"),
      });
    }

    return results;
  }

  /**
   * 判断目录采集时是否应跳过当前项
   * @param {string} itemName 目录项名称
   * @returns {boolean} 是否跳过
   */
  shouldSkipDirectoryItem(itemName) {
    return itemName === ".git" || itemName === "node_modules";
  }

  /**
   * 收集引用到的额外文件
   * @param {string} category 类别名称
   * @param {Object} entry 当前条目
   * @returns {Array<Object>} 额外清单条目
   */
  async collectReferencedEntries(category, entry) {
    if (category === "claudeCode" && entry.key === "claude.globalInstructions") {
      return this.extractClaudeImportedFiles(entry.path);
    }

    if (category === "geminiCli" && entry.key === "gemini.globalInstructions") {
      return this.extractGeminiImportedFiles(entry.path);
    }

    if (category === "codex" && entry.key === "codex.config") {
      return this.extractCodexReferencedFiles(entry.path);
    }

    return [];
  }

  /**
   * 从 CLAUDE.md 中提取 @ 导入文件
   * @param {string} filePath CLAUDE.md 路径
   * @returns {Array<Object>} 引用条目
   */
  async extractClaudeImportedFiles(filePath) {
    return this.extractMarkdownImportedFiles(
      filePath,
      "claude.globalInstructions.import",
      "CLAUDE import"
    );
  }

  /**
   * 从 GEMINI.md 中提取 @ 导入文件
   * @param {string} filePath GEMINI.md 路径
   * @returns {Array<Object>} 引用条目
   */
  async extractGeminiImportedFiles(filePath) {
    return this.extractMarkdownImportedFiles(
      filePath,
      "gemini.globalInstructions.import",
      "GEMINI import"
    );
  }

  /**
   * 从 Markdown 指令文件中提取 @ 导入文件
   * @param {string} filePath Markdown 文件路径
   * @param {string} key 条目标识
   * @param {string} labelPrefix 标签前缀
   * @returns {Array<Object>} 引用条目
   */
  async extractMarkdownImportedFiles(filePath, key, labelPrefix) {
    if (!(await fs.pathExists(filePath))) {
      return [];
    }

    const content = await fs.readFile(filePath, "utf8");
    const importPaths = [];
    const regex = /@([^\s]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const rawImportPath = match[1].replace(/^["']|["']$/g, "");
      if (rawImportPath.startsWith("http")) {
        continue;
      }

      const resolvedPath = path.isAbsolute(rawImportPath)
        ? rawImportPath
        : path.resolve(path.dirname(filePath), rawImportPath);

      importPaths.push({
        type: "file",
        key,
        label: `${labelPrefix}: ${path.basename(resolvedPath)}`,
        path: resolvedPath,
        required: false,
        relativePath: this.buildRelativePath(path.dirname(filePath), resolvedPath),
      });
    }

    return importPaths;
  }

  /**
   * 从 Codex config.toml 中提取引用文件
   * @param {string} filePath config.toml 路径
   * @returns {Array<Object>} 引用条目
   */
  async extractCodexReferencedFiles(filePath) {
    if (!(await fs.pathExists(filePath))) {
      return [];
    }

    const content = await fs.readFile(filePath, "utf8");
    const patterns = [
      {
        key: "modelInstructions",
        regex: /^\s*model_instructions_file\s*=\s*"([^"]+)"/gm,
      },
      {
        key: "compactPrompt",
        regex: /^\s*experimental_compact_prompt_file\s*=\s*"([^"]+)"/gm,
      },
      {
        key: "modelCatalog",
        regex: /^\s*model_catalog_json\s*=\s*"([^"]+)"/gm,
      },
      {
        key: "skillConfig",
        regex: /^\s*path\s*=\s*"([^"]+)"/gm,
      },
    ];

    const entries = [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const rawPath = match[1];
        const resolvedPath = rawPath.startsWith("~/")
          ? path.join(os.homedir(), rawPath.slice(2))
          : path.isAbsolute(rawPath)
            ? rawPath
            : path.resolve(path.dirname(filePath), rawPath);

        entries.push({
          type: "file",
          key: `codex.reference.${pattern.key}`,
          label: `${pattern.key}: ${path.basename(resolvedPath)}`,
          path: resolvedPath,
          required: false,
          relativePath: this.buildRelativePath(path.dirname(filePath), resolvedPath),
        });
      }
    }

    return entries;
  }

  /**
   * 构建类别警告信息
   * @param {Array<Object>} entries 条目列表
   * @returns {Array<string>} 警告列表
   */
  buildCategoryWarnings(entries) {
    const warnings = [];
    const authEntry = entries.find((entry) => entry.key === "codex.auth");

    if (!authEntry?.contentBase64) {
      return warnings;
    }

    try {
      const raw = Buffer.from(authEntry.contentBase64, "base64").toString("utf8");
      const authConfig = JSON.parse(raw);
      if (
        authConfig.cli_auth_credentials_store &&
        authConfig.cli_auth_credentials_store !== "file"
      ) {
        warnings.push(
          `认证凭证使用 ${authConfig.cli_auth_credentials_store} 存储，文件备份无法完整恢复系统钥匙串内容`
        );
      }
    } catch (error) {
      // 忽略 auth.json 非预期内容
    }

    return warnings;
  }

  /**
   * 生成缺失条目
   * @param {Object} entry 原始条目
   * @param {string} reason 缺失原因
   * @returns {Object} 缺失条目
   */
  createMissingEntry(entry, reason) {
    return {
      entryType: entry.type,
      key: entry.key,
      rootPath: entry.path,
      portablePath: this.toPortablePath(entry.path),
      relativePath: entry.relativePath || ".",
      required: entry.required,
      missingReason: reason,
    };
  }

  /**
   * 计算 SHA256
   * @param {Buffer} buffer 文件内容
   * @returns {string} 摘要
   */
  calculateSha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * 基于当前文件目录计算相对路径，无法相对化时回退到文件名
   * @param {string} baseDir 基准目录
   * @param {string} targetPath 目标路径
   * @returns {string} 相对路径
   */
  buildRelativePath(baseDir, targetPath) {
    const relativePath = path.relative(baseDir, targetPath);
    if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      return this.toPortableSubpath(relativePath);
    }

    return path.basename(targetPath);
  }

  /**
   * 统一将相对路径转换为可移植的 POSIX 形式
   * @param {string} relativePath 相对路径
   * @returns {string} 可移植相对路径
   */
  toPortableSubpath(relativePath) {
    if (!relativePath || relativePath === ".") {
      return relativePath || ".";
    }

    return relativePath.replace(/\\/g, "/");
  }

  /**
   * 将绝对路径转换为可移植路径
   * @param {string} absolutePath 绝对路径
   * @returns {string} 可移植路径
   */
  toPortablePath(absolutePath) {
    if (!absolutePath) {
      return absolutePath;
    }

    const normalizedAbsolutePath = absolutePath.replace(/\\/g, "/");
    const normalizedHomeDir = this.fileManager.homeDir.replace(/\\/g, "/");

    if (
      normalizedAbsolutePath === normalizedHomeDir ||
      normalizedAbsolutePath.startsWith(`${normalizedHomeDir}/`)
    ) {
      const relativePath = normalizedAbsolutePath.slice(normalizedHomeDir.length).replace(/^\/+/, "");
      return relativePath ? `~/${relativePath}` : "~";
    }

    return normalizedAbsolutePath;
  }

  /**
   * 上传备份到WebDAV
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   */
  async uploadToWebDAV(backupData, selectedCategories) {
    try {
      const fileName = this.generateBackupFileName(selectedCategories);

      console.log(chalk.blue("\n📤 正在上传备份到云端存储..."));

      await this.webdavClient.initialize();
      await this.cleanupOldBackups();

      await this.webdavClient.uploadBackup(fileName, backupData);
      this.showUploadSuccess(fileName, backupData);
    } catch (error) {
      console.error(chalk.red("\n❌ 上传备份失败:"), error.message);
      console.log(chalk.yellow("\n💡 备份数据已收集完成，但上传失败。您可以："));
      console.log(chalk.gray("• 检查WebDAV配置是否正确"));
      console.log(chalk.gray("• 确认网络连接是否正常"));
      console.log(chalk.gray("• 稍后重新运行备份命令"));
      throw error;
    }
  }

  /**
   * 生成备份文件名
   * @param {Array} selectedCategories 选择的类别
   * @returns {string} 文件名
   */
  generateBackupFileName(selectedCategories) {
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:\-]/g, "")
      .replace(/\..+/, "")
      .replace("T", "-");

    const categoryPrefix =
      selectedCategories.length === 1
        ? selectedCategories[0].toLowerCase().replace(/\s+/g, "-")
        : "multi-config";

    return `ccm-${categoryPrefix}-${timestamp}.json`;
  }

  /**
   * 清理旧备份文件
   */
  async cleanupOldBackups() {
    try {
      const maxBackups = 5;
      const backups = await this.webdavClient.listBackups();

      if (backups.length >= maxBackups) {
        const backupsToDelete = backups.slice(maxBackups - 1);
        console.log(
          chalk.blue(`🧹 清理旧备份文件 (保留最新${maxBackups}个)...`)
        );

        for (const backup of backupsToDelete) {
          await this.webdavClient.deleteBackup(backup.path);
        }

        console.log(
          chalk.green(`✅ 已清理 ${backupsToDelete.length} 个旧备份文件`)
        );
      }
    } catch (error) {
      console.warn(chalk.yellow("⚠️ 清理旧备份时出现问题:"), error.message);
    }
  }

  /**
   * 统计备份条目
   * @param {Object} backupData 备份数据
   * @returns {{totalFiles:number,totalSize:number,categoryNames:Array<string>}} 统计信息
   */
  summarizeBackupData(backupData) {
    let totalFiles = 0;
    let totalSize = 0;
    const categoryNames = [];

    for (const data of Object.values(backupData.categories)) {
      categoryNames.push(data.name);

      for (const entry of data.entries || []) {
        if (entry.entryType === "file" && entry.contentBase64) {
          totalFiles++;
          totalSize += entry.size || 0;
        }
      }
    }

    return { totalFiles, totalSize, categoryNames };
  }

  /**
   * 显示上传成功信息
   * @param {string} fileName 文件名
   * @param {Object} backupData 备份数据
   */
  showUploadSuccess(fileName, backupData) {
    console.log(chalk.green("\n🎉 备份上传成功！"));
    console.log(chalk.white("📋 备份详情："));
    console.log(
      chalk.gray(`备份时间: ${new Date(backupData.timestamp).toLocaleString()}`)
    );

    const { totalFiles, totalSize, categoryNames } =
      this.summarizeBackupData(backupData);

    console.log(chalk.gray(`📁 备份文件: ${fileName}`));
    console.log(chalk.gray(`📦 备份类别: ${categoryNames.join(", ")}`));
    console.log(chalk.gray(`📄 文件数量: ${totalFiles}`));
    console.log(chalk.gray(`💾 总大小: ${this.formatFileSize(totalSize)}`));

    const serverInfo = this.webdavClient.getServerInfo();
    if (serverInfo) {
      console.log(chalk.gray(`☁️ 存储服务: ${serverInfo.serverType}`));
      console.log(chalk.gray(`👤 用户: ${serverInfo.username}`));
    }
  }

  /**
   * 显示备份结果
   * @param {Object} backupData 备份数据
   */
  showBackupResult(backupData) {
    console.log(chalk.green("\n🎉 备份数据收集完成！"));
    console.log(chalk.white("📋 备份详情："));
    console.log(
      chalk.gray(`备份时间: ${new Date(backupData.timestamp).toLocaleString()}`)
    );

    const { totalFiles, totalSize, categoryNames } =
      this.summarizeBackupData(backupData);

    console.log(chalk.gray(`备份类别: ${categoryNames.join(", ")}`));
    console.log(chalk.gray(`文件数量: ${totalFiles}`));
    console.log(chalk.gray(`总大小: ${this.formatFileSize(totalSize)}`));
    console.log(chalk.yellow("\n💡 提示: 云端存储功能开发中，当前仅完成本地数据收集"));
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * 检查并处理旧版本配置迁移
   * @returns {boolean} 是否继续备份流程
   */
  async checkAndMigrateOldConfig() {
    try {
      const oldConfigPath = path.join(os.homedir(), ".claude", "api_configs.json");

      if (!(await fs.pathExists(oldConfigPath))) {
        return true;
      }

      console.log(chalk.yellow("🔍 检测到旧版本配置文件"));
      console.log(chalk.gray(`发现: ${oldConfigPath}`));
      console.log("");

      return await this.showMigrationPrompt(oldConfigPath);
    } catch (error) {
      console.warn(chalk.yellow("⚠️ 检查旧配置时出现问题:"), error.message);
      return true;
    }
  }

  /**
   * 显示迁移提醒和选项
   * @param {string} oldConfigPath 旧配置文件路径
   * @returns {boolean} 是否继续备份流程
   */
  async showMigrationPrompt(oldConfigPath) {
    console.log(chalk.cyan.bold("📢 版本更新提醒"));
    console.log("");
    console.log(chalk.white("检测到您使用的是旧版本的配置文件位置："));
    console.log(chalk.gray("• 旧位置: ~/.claude/api_configs.json"));
    console.log(chalk.gray("• 新位置: ~/.ccm/api_configs.json"));
    console.log("");
    console.log(chalk.yellow("为了更好的管理和组织，建议将配置文件迁移到新位置。"));
    console.log("");

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "请选择操作：",
        choices: [
          {
            name: "🚀 一键迁移配置文件 (推荐)",
            value: "migrate",
            short: "一键迁移",
          },
          {
            name: "⏭️ 跳过迁移，继续备份",
            value: "skip",
            short: "跳过迁移",
          },
          {
            name: "❌ 取消备份操作",
            value: "cancel",
            short: "取消备份",
          },
        ],
        default: 0,
      },
    ]);

    switch (action) {
      case "migrate":
        return await this.performMigration(oldConfigPath);
      case "skip":
        console.log(chalk.blue("ℹ️ 跳过迁移，继续使用现有配置进行备份"));
        return true;
      case "cancel":
        return false;
      default:
        return true;
    }
  }

  /**
   * 执行配置文件迁移
   * @param {string} oldConfigPath 旧配置文件路径
   * @returns {boolean} 是否继续备份流程
   */
  async performMigration(oldConfigPath) {
    const newConfigDir = path.join(os.homedir(), ".ccm");
    const newConfigPath = path.join(newConfigDir, "api_configs.json");

    const spinner = ora("正在迁移配置文件").start();

    try {
      await fs.ensureDir(newConfigDir);

      if (await fs.pathExists(newConfigPath)) {
        spinner.warn("新位置已存在配置文件");

        const { overwrite } = await inquirer.prompt([
          {
            type: "list",
            name: "overwrite",
            message: "新位置已存在配置文件，如何处理？",
            choices: [
              {
                name: "🔄 合并配置 (推荐)",
                value: "merge",
                short: "合并配置",
              },
              {
                name: "🗑️ 覆盖新配置文件",
                value: "overwrite",
                short: "覆盖文件",
              },
              {
                name: "❌ 取消迁移",
                value: "cancel",
                short: "取消迁移",
              },
            ],
            default: 0,
          },
        ]);

        if (overwrite === "cancel") {
          console.log(chalk.yellow("ℹ️ 迁移已取消"));
          return true;
        }

        if (overwrite === "merge") {
          return await this.mergeConfigs(oldConfigPath, newConfigPath, spinner);
        }
      }

      spinner.text = "复制配置文件";
      await fs.copy(oldConfigPath, newConfigPath);

      spinner.text = "验证迁移结果";
      const isValid = await this.validateMigration(oldConfigPath, newConfigPath);

      if (!isValid) {
        spinner.fail("迁移验证失败");
        console.log(chalk.red("❌ 配置文件迁移失败，请检查文件完整性"));
        return true;
      }

      const backupPath = oldConfigPath + ".backup";
      await fs.move(oldConfigPath, backupPath);

      spinner.succeed("配置文件迁移完成");

      console.log(chalk.green("\n✅ 迁移成功！"));
      console.log(chalk.gray(`• 新配置位置: ${newConfigPath}`));
      console.log(chalk.gray(`• 旧文件备份: ${backupPath}`));
      console.log(chalk.blue("• 现在可以安全地删除备份文件，或保留作为备份"));
      console.log("");

      return true;
    } catch (error) {
      spinner.fail("迁移过程中出现错误");
      console.error(chalk.red("❌ 迁移失败:"), error.message);

      const { continueAnyway } = await inquirer.prompt([
        {
          type: "confirm",
          name: "continueAnyway",
          message: "迁移失败，是否继续备份流程？",
          default: true,
        },
      ]);

      return continueAnyway;
    }
  }

  /**
   * 合并配置文件
   * @param {string} oldConfigPath 旧配置路径
   * @param {string} newConfigPath 新配置路径
   * @param {Object} spinner 加载器
   * @returns {boolean} 是否继续备份流程
   */
  async mergeConfigs(oldConfigPath, newConfigPath, spinner) {
    try {
      spinner.text = "读取配置文件";
      const oldConfig = await fs.readJSON(oldConfigPath);
      const newConfig = await fs.readJSON(newConfigPath);

      spinner.text = "合并配置数据";
      const mergedConfig = { ...oldConfig, ...newConfig };

      if (oldConfig.sites && newConfig.sites) {
        mergedConfig.sites = { ...oldConfig.sites, ...newConfig.sites };
      }

      spinner.text = "保存合并后的配置";
      await fs.writeJSON(newConfigPath, mergedConfig, { spaces: 2 });

      const backupPath = oldConfigPath + ".backup";
      await fs.move(oldConfigPath, backupPath);

      spinner.succeed("配置合并完成");

      console.log(chalk.green("\n✅ 配置合并成功！"));
      console.log(chalk.gray(`• 合并后配置: ${newConfigPath}`));
      console.log(chalk.gray(`• 旧文件备份: ${backupPath}`));
      console.log("");

      return true;
    } catch (error) {
      spinner.fail("配置合并失败");
      console.error(chalk.red("❌ 合并失败:"), error.message);
      return true;
    }
  }

  /**
   * 验证迁移结果
   * @param {string} oldConfigPath 旧配置路径
   * @param {string} newConfigPath 新配置路径
   * @returns {boolean} 验证是否通过
   */
  async validateMigration(oldConfigPath, newConfigPath) {
    try {
      const oldStat = await fs.stat(oldConfigPath);
      const newStat = await fs.stat(newConfigPath);

      if (oldStat.size !== newStat.size) {
        console.warn(chalk.yellow("⚠️ 文件大小不匹配"));
        return false;
      }

      const oldContent = await fs.readFile(oldConfigPath, "utf8");
      const newContent = await fs.readFile(newConfigPath, "utf8");

      if (oldContent !== newContent) {
        console.warn(chalk.yellow("⚠️ 文件内容不匹配"));
        return false;
      }

      try {
        JSON.parse(newContent);
      } catch (error) {
        console.warn(chalk.yellow("⚠️ 新配置文件JSON格式无效"));
        return false;
      }

      return true;
    } catch (error) {
      console.warn(chalk.yellow("⚠️ 验证过程出现错误:"), error.message);
      return false;
    }
  }
}

export default BackupManager;
