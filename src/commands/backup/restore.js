import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import FileManager from "./file-manager.js";
import WebDAVClient from "./webdav-client.js";

/**
 * 恢复功能实现
 */
class RestoreManager {
  constructor() {
    this.fileManager = new FileManager();
    this.webdavClient = new WebDAVClient();
    this.lastSnapshotPath = null;
  }

  /**
   * 执行恢复流程
   */
  async performRestore() {
    try {
      console.log(chalk.cyan.bold("\n📥 配置恢复向导\n"));

      await this.webdavClient.initialize();

      const backupFiles = await this.listAvailableBackups();
      if (backupFiles.length === 0) {
        console.log(chalk.yellow("📭 未找到任何备份文件"));
        console.log(chalk.gray("请先执行备份操作，或检查WebDAV配置是否正确。"));
        return;
      }

      const selectedBackup = await this.selectBackupFile(backupFiles);
      if (!selectedBackup) {
        console.log(chalk.yellow("ℹ️ 用户取消恢复操作"));
        return;
      }

      const backupData = await this.downloadAndPreviewBackup(selectedBackup);
      const selectedCategories = await this.selectRestoreCategories(backupData);
      if (selectedCategories.length === 0) {
        console.log(chalk.yellow("ℹ️ 未选择任何配置类别，恢复已取消"));
        return;
      }

      const confirmed = await this.confirmRestore(
        selectedBackup,
        selectedCategories,
        backupData
      );
      if (!confirmed) {
        console.log(chalk.yellow("ℹ️ 用户取消恢复操作"));
        return;
      }

      await this.executeRestore(backupData, selectedCategories);
      console.log(chalk.green("\n✅ 配置恢复完成！"));
    } catch (error) {
      console.error(chalk.red("\n❌ 恢复失败:"), error.message);
      throw error;
    }
  }

  /**
   * 获取可用的备份文件列表
   * @returns {Array} 备份文件列表
   */
  async listAvailableBackups() {
    console.log(chalk.blue("📋 正在获取备份文件列表..."));

    try {
      const backups = await this.webdavClient.listBackups();
      console.log(chalk.green(`✅ 找到 ${backups.length} 个备份文件`));
      return backups;
    } catch (error) {
      throw new Error(`获取备份列表失败: ${error.message}`);
    }
  }

  /**
   * 选择要恢复的备份文件
   * @param {Array} backupFiles 备份文件列表
   * @returns {Object|null} 选择的备份文件
   */
  async selectBackupFile(backupFiles) {
    const choices = backupFiles.map((backup) => ({
      name: `${backup.name} (${this.formatFileSize(
        backup.size
      )}, ${backup.lastModified.toLocaleString()})`,
      value: backup,
      short: backup.name,
    }));

    choices.push({ name: "取消操作", value: null });

    const { selectedBackup } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedBackup",
        message: "请选择要恢复的备份文件:",
        choices,
        pageSize: 10,
      },
    ]);

    return selectedBackup;
  }

  /**
   * 下载并预览备份内容
   * @param {Object} selectedBackup 选择的备份文件
   * @returns {Object} 备份数据
   */
  async downloadAndPreviewBackup(selectedBackup) {
    console.log(chalk.blue(`📥 正在下载备份文件: ${selectedBackup.name}`));

    try {
      const backupData = await this.webdavClient.downloadBackup(selectedBackup.path);
      this.showBackupPreview(backupData);
      return backupData;
    } catch (error) {
      throw new Error(`下载备份文件失败: ${error.message}`);
    }
  }

  /**
   * 显示备份预览信息
   * @param {Object} backupData 备份数据
   */
  showBackupPreview(backupData) {
    console.log(chalk.white("\n📋 备份内容预览："));
    console.log(
      chalk.gray(`备份时间: ${new Date(backupData.timestamp).toLocaleString()}`)
    );

    if (backupData.categories) {
      console.log(chalk.gray("包含的配置类别:"));

      for (const data of Object.values(backupData.categories)) {
        const { fileCount, totalSize } = this.summarizeCategory(data);
        console.log(
          chalk.gray(
            `  • ${data.name} (${fileCount} 个文件, ${this.formatFileSize(totalSize)})`
          )
        );
      }
    }
  }

  /**
   * 汇总类别统计
   * @param {Object} data 类别数据
   * @returns {{fileCount:number,totalSize:number}} 统计信息
   */
  summarizeCategory(data) {
    let fileCount = 0;
    let totalSize = 0;

    if (data.entries) {
      for (const entry of data.entries) {
        if (entry.entryType === "file" && entry.contentBase64) {
          fileCount++;
          totalSize += entry.size || 0;
        }
      }
      return { fileCount, totalSize };
    }

    if (data.files) {
      for (const fileInfo of Object.values(data.files)) {
        if (!fileInfo.error) {
          fileCount++;
          totalSize += fileInfo.size || 0;
        }
      }
    }

    if (data.directories) {
      for (const dirInfo of Object.values(data.directories)) {
        if (!dirInfo.error) {
          fileCount += dirInfo.fileCount || 0;
          totalSize += dirInfo.totalSize || 0;
        }
      }
    }

    return { fileCount, totalSize };
  }

  /**
   * 选择要恢复的配置类别
   * @param {Object} backupData 备份数据
   * @returns {Array} 选择的类别列表
   */
  async selectRestoreCategories(backupData) {
    if (!backupData.categories || Object.keys(backupData.categories).length === 0) {
      throw new Error("备份文件中没有找到配置数据");
    }

    const choices = Object.entries(backupData.categories).map(([category, data]) => ({
      name: data.name || category,
      value: category,
      checked: false,
    }));

    const { selectedCategories } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedCategories",
        message: "请选择要恢复的配置类别 (空格选择/取消选择):",
        choices,
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
   * 确认恢复操作
   * @param {Object} selectedBackup 选择的备份文件
   * @param {Array} selectedCategories 选择的类别
   * @param {Object} backupData 备份数据
   * @returns {boolean} 是否确认恢复
   */
  async confirmRestore(selectedBackup, selectedCategories, backupData) {
    console.log(chalk.yellow("\n⚠️ 恢复操作将会覆盖现有的配置文件！"));
    console.log(chalk.gray(`备份文件: ${selectedBackup.name}`));
    console.log(chalk.gray(`恢复类别: ${selectedCategories.join(", ")}`));

    const restoreNotes = this.buildRestoreNotes(backupData, selectedCategories);
    for (const note of restoreNotes) {
      console.log(chalk.blue(`ℹ️ ${note}`));
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "确定要执行恢复操作吗？",
        default: false,
      },
    ]);

    return confirmed;
  }

  /**
   * 构建恢复确认阶段需要展示的提示
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   * @returns {Array<string>} 提示列表
   */
  buildRestoreNotes(backupData, selectedCategories) {
    const notes = [];

    for (const category of selectedCategories || []) {
      const categoryData = backupData?.categories?.[category];
      const hasClaudeMcpEntry = (categoryData?.entries || []).some(
        (entry) => entry.key === "claude.mcpUserConfig"
      );

      if (hasClaudeMcpEntry) {
        notes.push(
          "Claude MCP 将只合并恢复 ~/.claude.json 的根级 mcpServers，不会整文件覆盖其他字段"
        );
      }
    }

    return notes;
  }

  /**
   * 判断备份格式版本
   * @param {Object} backupData 备份数据
   * @returns {"v3"|"legacy"} 备份格式
   */
  getBackupFormatVersion(backupData) {
    return backupData?.version === "3.0.0" ? "v3" : "legacy";
  }

  /**
   * 执行恢复操作
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   */
  async executeRestore(backupData, selectedCategories) {
    console.log(chalk.blue("\n🔄 正在执行恢复操作..."));

    const spinner = ora("恢复配置文件").start();
    try {
      const format = this.getBackupFormatVersion(backupData);
      this.lastSnapshotPath = await this.createPreRestoreSnapshot(
        backupData,
        selectedCategories,
        format
      );

      let result;
      if (format === "v3") {
        result = await this.restoreV3Entries(backupData, selectedCategories, spinner);
      } else {
        result = await this.restoreLegacyBackup(backupData, selectedCategories, spinner);
      }

      spinner.succeed(
        `恢复完成: ${result.restoredFiles} 个文件成功, ${result.failedFiles} 个文件失败`
      );
      this.showRestoreResult(result.restoredFiles, result.failedFiles, selectedCategories);
    } catch (error) {
      spinner.fail("恢复操作失败");
      throw error;
    }
  }

  /**
   * 创建恢复前快照
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   * @param {"v3"|"legacy"} format 备份格式
   * @returns {string} 快照目录
   */
  async createPreRestoreSnapshot(backupData, selectedCategories, format) {
    const snapshotRoot = path.join(
      os.homedir(),
      ".ccm",
      "restore-snapshots",
      new Date().toISOString().replace(/[:.]/g, "-")
    );
    await fs.ensureDir(snapshotRoot);

    const snapshotManifest = {
      createdAt: new Date().toISOString(),
      format,
      categories: {},
    };

    for (const category of selectedCategories) {
      const targetPaths =
        format === "v3"
          ? this.getV3TargetPaths(category, backupData.categories[category])
          : this.getLegacyTargetPaths(category);

      snapshotManifest.categories[category] = [];

      for (const targetPath of targetPaths) {
        if (!(await fs.pathExists(targetPath))) {
          continue;
        }

        const relativeSnapshotPath = this.toSnapshotRelativePath(
          category,
          backupData.categories[category],
          targetPath,
          format
        );
        const snapshotPath = path.join(snapshotRoot, relativeSnapshotPath);
        await fs.ensureDir(path.dirname(snapshotPath));

        const stat = await fs.stat(targetPath);
        if (stat.isDirectory()) {
          if (this.isSameOrSubPath(snapshotRoot, targetPath)) {
            await this.copyDirectorySnapshot(targetPath, snapshotPath, snapshotRoot);
          } else {
            await fs.copy(targetPath, snapshotPath);
          }
        } else {
          await fs.copyFile(targetPath, snapshotPath);
        }

        snapshotManifest.categories[category].push({
          sourcePath: targetPath,
          snapshotPath,
        });
      }
    }

    await fs.writeJson(path.join(snapshotRoot, "snapshot-manifest.json"), snapshotManifest, {
      spaces: 2,
    });

    return snapshotRoot;
  }

  /**
   * 复制目录快照，并跳过包含当前快照根目录的分支，避免复制到自己的子目录
   * @param {string} sourcePath 源目录
   * @param {string} snapshotPath 快照目录
   * @param {string} snapshotRoot 当前快照根目录
   */
  async copyDirectorySnapshot(sourcePath, snapshotPath, snapshotRoot) {
    await fs.ensureDir(snapshotPath);

    const items = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(sourcePath, item.name);
      if (this.isSameOrSubPath(snapshotRoot, itemPath)) {
        continue;
      }

      const targetItemPath = path.join(snapshotPath, item.name);
      if (item.isDirectory()) {
        await fs.copy(itemPath, targetItemPath);
        continue;
      }

      if (item.isFile()) {
        await fs.copyFile(itemPath, targetItemPath);
      }
    }
  }

  /**
   * 获取新格式恢复将会覆盖的目标路径
   * @param {string} category 类别
   * @param {Object} categoryData 类别数据
   * @returns {Array<string>} 目标路径
   */
  getV3TargetPaths(category, categoryData) {
    if (!categoryData?.entries) {
      return [];
    }

    const currentPaths = this.fileManager.getCategoryPaths(category);
    const targets = new Set();

    for (const entry of categoryData.entries) {
      const targetPath = this.resolveEntryTargetPath(currentPaths, entry);
      if (targetPath) {
        targets.add(targetPath);
      }
    }

    return Array.from(targets);
  }

  /**
   * 获取旧格式恢复将会覆盖的目标路径
   * @param {string} category 类别
   * @returns {Array<string>} 目标路径
   */
  getLegacyTargetPaths(category) {
    const currentPaths = this.fileManager.getCategoryPaths(category);
    const targets = [];

    for (const entry of currentPaths?.entries || []) {
      targets.push(entry.path);
    }

    return targets;
  }

  /**
   * 将目标路径转换为快照相对路径
   * @param {string} targetPath 目标路径
   * @returns {string} 快照内路径
   */
  toSnapshotRelativePath(category, categoryData, targetPath, format) {
    if (format === "v3" && categoryData?.entries) {
      const entry = categoryData.entries.find((item) => {
        if (item.entryType === "directory") {
          return false;
        }

        const resolvedTarget = this.resolveEntryTargetPath(
          this.fileManager.getCategoryPaths(category),
          item
        );
        return resolvedTarget === targetPath;
      });

      if (entry) {
        const sanitizedKey = entry.key.replace(/[.:]/g, "_");
        if (entry.relativePath && entry.relativePath !== ".") {
          return path.join(category, sanitizedKey, entry.relativePath);
        }
        return path.join(category, sanitizedKey);
      }
    }

    const parsed = path.parse(targetPath);
    const relativePath = targetPath.slice(parsed.root.length);
    return path.join(category, relativePath);
  }

  /**
   * 判断 targetPath 是否与 basePath 相同，或位于其子路径内
   * @param {string} targetPath 目标路径
   * @param {string} basePath 基准路径
   * @returns {boolean} 是否同路径或子路径
   */
  isSameOrSubPath(targetPath, basePath) {
    const relativePath = path.relative(basePath, targetPath);
    return (
      relativePath === "" ||
      (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
    );
  }

  /**
   * 恢复新格式条目
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   * @param {Object} spinner spinner
   * @returns {{restoredFiles:number,failedFiles:number}} 恢复结果
   */
  async restoreV3Entries(backupData, selectedCategories, spinner) {
    let restoredFiles = 0;
    let failedFiles = 0;

    for (const category of selectedCategories) {
      const categoryData = backupData.categories[category];
      if (!categoryData?.entries) {
        continue;
      }

      spinner.text = `恢复 ${categoryData.name} 配置...`;
      const currentPaths = this.fileManager.getCategoryPaths(category);
      const pendingEntries = [];

      for (const entry of categoryData.entries) {
        if (entry.entryType !== "file" || !entry.contentBase64) {
          continue;
        }

        const targetPath = this.resolveEntryTargetPath(currentPaths, entry);
        if (!targetPath) {
          console.warn(chalk.yellow(`⚠️ 无法映射恢复路径: ${entry.key}`));
          failedFiles++;
          continue;
        }

        pendingEntries.push({ entry, targetPath });
      }

      const blockedTargets = await this.detectBlockedRestoreTargets(pendingEntries);
      const reportedBlockedPaths = new Set();

      for (const { entry, targetPath } of pendingEntries) {
        const blocked = blockedTargets.get(targetPath);
        if (blocked) {
          failedFiles++;

          if (!reportedBlockedPaths.has(blocked.path)) {
            console.error(chalk.red(`❌ 恢复文件失败 ${entry.key}: ${blocked.message}`));
            reportedBlockedPaths.add(blocked.path);
          }

          continue;
        }

        try {
          await fs.ensureDir(path.dirname(targetPath));
          const content = await this.buildRestoreContent(entry, targetPath);
          await fs.writeFile(targetPath, content);
          restoredFiles++;
          console.log(chalk.gray(`✅ 恢复文件: ${entry.key} -> ${targetPath}`));
        } catch (error) {
          console.error(chalk.red(`❌ 恢复文件失败 ${entry.key}:`, error.message));
          failedFiles++;
        }
      }
    }

    return { restoredFiles, failedFiles };
  }

  /**
   * 检查恢复目标路径是否被已有文件或同批次文件路径阻塞
   * @param {Array<{entry:Object,targetPath:string}>} pendingEntries 待恢复条目
   * @returns {Promise<Map<string,{path:string,message:string}>>} 被阻塞的目标路径
   */
  async detectBlockedRestoreTargets(pendingEntries) {
    const blockedTargets = new Map();
    const targetPathSet = new Set(pendingEntries.map(({ targetPath }) => targetPath));
    const statCache = new Map();

    for (const { targetPath } of pendingEntries) {
      const parentPaths = this.getAncestorPaths(path.dirname(targetPath));

      for (const parentPath of parentPaths) {
        if (targetPathSet.has(parentPath)) {
          blockedTargets.set(targetPath, {
            path: parentPath,
            message: `父级路径 ${parentPath} 也被作为文件恢复，无法同时写入其子路径，已跳过该路径下的文件`,
          });
          break;
        }

        const stat = await this.getCachedPathStat(parentPath, statCache);
        if (stat && !stat.isDirectory()) {
          blockedTargets.set(targetPath, {
            path: parentPath,
            message: `父级路径 ${parentPath} 已存在且不是目录，已跳过该路径下的文件`,
          });
          break;
        }
      }
    }

    return blockedTargets;
  }

  /**
   * 获取路径的所有父级路径
   * @param {string} targetDir 目标目录
   * @returns {Array<string>} 父级路径列表，按近到远排序
   */
  getAncestorPaths(targetDir) {
    const ancestors = [];
    let currentPath = path.resolve(targetDir);
    const rootPath = path.parse(currentPath).root;

    while (currentPath && currentPath !== rootPath) {
      ancestors.push(currentPath);
      currentPath = path.dirname(currentPath);
    }

    return ancestors;
  }

  /**
   * 带缓存地读取路径状态
   * @param {string} targetPath 目标路径
   * @param {Map<string, fs.Stats|null>} statCache 状态缓存
   * @returns {Promise<fs.Stats|null>} 路径状态
   */
  async getCachedPathStat(targetPath, statCache) {
    if (statCache.has(targetPath)) {
      return statCache.get(targetPath);
    }

    let stat = null;
    try {
      stat = await fs.stat(targetPath);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
        throw error;
      }
    }

    statCache.set(targetPath, stat);
    return stat;
  }

  /**
   * 生成恢复时实际写入的文件内容
   * @param {Object} entry 备份条目
   * @param {string} targetPath 目标路径
   * @returns {Promise<Buffer>} 写入内容
   */
  async buildRestoreContent(entry, targetPath) {
    const rawContent = Buffer.from(entry.contentBase64, "base64");

    if (entry.key === "claude.mcpUserConfig") {
      return this.mergeClaudeUserMcpConfig(targetPath, rawContent);
    }

    return rawContent;
  }

  /**
   * 恢复 Claude 用户级 MCP 配置时，仅替换根级 mcpServers，保留其他字段
   * @param {string} targetPath 目标路径
   * @param {Buffer} rawContent 备份内容
   * @returns {Promise<Buffer>} 合并后的内容
   */
  async mergeClaudeUserMcpConfig(targetPath, rawContent) {
    let incomingConfig;
    try {
      incomingConfig = JSON.parse(rawContent.toString("utf8"));
    } catch (error) {
      return rawContent;
    }

    if (
      !incomingConfig ||
      typeof incomingConfig !== "object" ||
      Array.isArray(incomingConfig)
    ) {
      return rawContent;
    }

    let currentConfig = {};
    if (await fs.pathExists(targetPath)) {
      try {
        const currentRaw = await fs.readFile(targetPath, "utf8");
        const parsedCurrent = JSON.parse(currentRaw);
        if (
          parsedCurrent &&
          typeof parsedCurrent === "object" &&
          !Array.isArray(parsedCurrent)
        ) {
          currentConfig = parsedCurrent;
        }
      } catch (error) {
        return rawContent;
      }
    }

    const mergedConfig = {
      ...currentConfig,
      mcpServers: incomingConfig.mcpServers || {},
    };

    return Buffer.from(JSON.stringify(mergedConfig, null, 2));
  }

  /**
   * 解析新格式条目的恢复路径
   * @param {Object} currentPaths 当前类别路径信息
   * @param {Object} entry 备份条目
   * @returns {string|null} 目标路径
   */
  resolveEntryTargetPath(currentPaths, entry, pathModule = path) {
    const matchingEntry = (currentPaths?.entries || []).find(
      (currentEntry) => currentEntry.key === entry.key
    );

    if (matchingEntry?.type === "file") {
      return matchingEntry.path;
    }

    if (matchingEntry?.type === "directory") {
      if (entry.relativePath === "." || !entry.relativePath) {
        return matchingEntry.path;
      }
      return pathModule.join(
        matchingEntry.path,
        ...this.splitPortablePathSegments(entry.relativePath)
      );
    }

    if (entry.portablePath) {
      return this.resolvePortablePath(entry.portablePath, pathModule);
    }

    if (entry.portableRootPath) {
      const rootPath = this.resolvePortablePath(entry.portableRootPath, pathModule);
      return entry.relativePath && entry.relativePath !== "."
        ? pathModule.join(rootPath, ...this.splitPortablePathSegments(entry.relativePath))
        : rootPath;
    }

    return entry.rootPath || null;
  }

  /**
   * 将可移植路径解析回当前环境路径
   * @param {string} portablePath 可移植路径
   * @returns {string} 目标路径
   */
  resolvePortablePath(portablePath, pathModule = path) {
    const normalized = portablePath.replace(/\\/g, "/");
    const homeDir = this.normalizeHomeDirForPathModule(pathModule);

    if (normalized === "~") {
      return homeDir;
    }

    if (normalized.startsWith("~/")) {
      return pathModule.join(homeDir, ...this.splitPortablePathSegments(normalized.slice(2)));
    }

    const windowsHomeMatch = normalized.match(/^[A-Za-z]:\/Users\/[^/]+\/(.+)$/);
    if (windowsHomeMatch) {
      return pathModule.join(homeDir, ...this.splitPortablePathSegments(windowsHomeMatch[1]));
    }

    const posixHomeMatch = normalized.match(/^\/(?:Users|home)\/[^/]+\/(.+)$/);
    if (posixHomeMatch) {
      return pathModule.join(homeDir, ...this.splitPortablePathSegments(posixHomeMatch[1]));
    }

    return normalized;
  }

  /**
   * 按目标路径模块规范化当前 home 目录
   * @param {typeof path|typeof path.posix|typeof path.win32} pathModule 路径模块
   * @returns {string} 规范化后的 home 目录
   */
  normalizeHomeDirForPathModule(pathModule = path) {
    const homeDir = os.homedir();

    if (pathModule === path.posix) {
      return homeDir.replace(/\\/g, "/");
    }

    if (pathModule === path.win32) {
      return homeDir.replace(/\//g, "\\");
    }

    return homeDir;
  }

  /**
   * 将可移植路径拆分为当前平台可 join 的路径段
   * @param {string} portablePath 可移植路径
   * @returns {Array<string>} 路径段
   */
  splitPortablePathSegments(portablePath) {
    return String(portablePath)
      .split(/[\\/]+/)
      .filter(Boolean);
  }

  /**
   * 恢复旧格式备份
   * @param {Object} backupData 备份数据
   * @param {Array} selectedCategories 选择的类别
   * @param {Object} spinner spinner
   * @returns {{restoredFiles:number,failedFiles:number}} 恢复结果
   */
  async restoreLegacyBackup(backupData, selectedCategories, spinner) {
    let restoredFiles = 0;
    let failedFiles = 0;

    for (const category of selectedCategories) {
      const categoryData = backupData.categories[category];
      if (!categoryData) {
        console.warn(chalk.yellow(`⚠️ 备份中未找到类别: ${category}`));
        continue;
      }

      spinner.text = `恢复 ${categoryData.name} 配置...`;
      const currentPaths = this.fileManager.getCategoryPaths(category);

      const fileEntries = (currentPaths?.entries || []).filter(
        (entry) => entry.type === "file"
      );
      const directoryEntries = (currentPaths?.entries || []).filter(
        (entry) => entry.type === "directory"
      );

      if (categoryData.files) {
        for (const [fileName, fileData] of Object.entries(categoryData.files)) {
          try {
            if (!fileData.error && fileData.content) {
              const targetEntry = fileEntries.find((entry) => entry.key === fileName);
              if (!targetEntry) {
                console.warn(chalk.yellow(`⚠️ 当前环境未找到文件 ${fileName} 的路径配置`));
                continue;
              }

              await fs.ensureDir(path.dirname(targetEntry.path));
              if (fileData.encoding === "base64") {
                await fs.writeFile(targetEntry.path, Buffer.from(fileData.content, "base64"));
              } else {
                await fs.writeFile(targetEntry.path, fileData.content, "utf8");
              }

              restoredFiles++;
              console.log(chalk.gray(`✅ 恢复文件: ${fileName} -> ${targetEntry.path}`));
            }
          } catch (error) {
            console.error(chalk.red(`❌ 恢复文件失败 ${fileName}:`, error.message));
            failedFiles++;
          }
        }
      }

      if (categoryData.directories) {
        for (const [dirName, dirData] of Object.entries(categoryData.directories)) {
          if (!dirData.error && dirData.files) {
            spinner.text = `恢复 ${categoryData.name} - ${dirName}目录...`;

            try {
              const targetEntry = directoryEntries.find((entry) => entry.key === dirName);
              if (!targetEntry) {
                console.warn(chalk.yellow(`⚠️ 当前环境未找到目录 ${dirName} 的路径配置`));
                continue;
              }

              const result = await this.restoreDirectoryData(dirData, targetEntry.path);
              restoredFiles += result.restoredCount;
              failedFiles += result.failedCount;
            } catch (error) {
              console.error(chalk.red(`❌ 恢复目录失败 ${dirName}:`, error.message));
              failedFiles++;
            }
          }
        }
      }
    }

    return { restoredFiles, failedFiles };
  }

  /**
   * 恢复目录数据
   * @param {Object} dirData 目录数据
   * @param {string} targetPath 目标路径
   * @returns {Object} 恢复结果统计
   */
  async restoreDirectoryData(dirData, targetPath) {
    let restoredCount = 0;
    let failedCount = 0;

    try {
      await fs.ensureDir(targetPath);

      if (dirData.files) {
        for (const [fileName, fileData] of Object.entries(dirData.files)) {
          try {
            if (!fileData.error && fileData.content) {
              const filePath = path.join(targetPath, fileName);

              if (fileData.encoding === "base64") {
                await fs.writeFile(filePath, Buffer.from(fileData.content, "base64"));
              } else {
                await fs.writeFile(filePath, fileData.content, "utf8");
              }

              restoredCount++;
            }
          } catch (error) {
            console.error(chalk.red(`❌ 恢复文件失败 ${fileName}:`, error.message));
            failedCount++;
          }
        }
      }

      if (dirData.subdirectories) {
        for (const [subDirName, subDirData] of Object.entries(dirData.subdirectories)) {
          const subDirPath = path.join(targetPath, subDirName);
          const subResult = await this.restoreDirectoryData(subDirData, subDirPath);
          restoredCount += subResult.restoredCount;
          failedCount += subResult.failedCount;
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ 创建目录失败 ${targetPath}:`, error.message));
      failedCount++;
    }

    return { restoredCount, failedCount };
  }

  /**
   * 显示恢复结果
   * @param {number} restoredFiles 成功恢复的文件数
   * @param {number} failedFiles 失败的文件数
   * @param {Array} selectedCategories 恢复的类别
   */
  showRestoreResult(restoredFiles, failedFiles, selectedCategories) {
    console.log(chalk.green("\n🎉 恢复操作执行完成！"));
    console.log(chalk.gray(`恢复类别: ${selectedCategories.join(", ")}`));
    console.log(chalk.gray(`成功恢复: ${restoredFiles} 个文件`));

    if (failedFiles > 0) {
      console.log(chalk.yellow(`失败文件: ${failedFiles} 个`));
    }

    if (this.lastSnapshotPath) {
      console.log(chalk.gray(`恢复前快照: ${this.lastSnapshotPath}`));
    }

    console.log(chalk.blue("\n💡 建议操作："));
    console.log(chalk.gray("• 重启相关应用程序以加载新配置"));
    console.log(chalk.gray("• 验证配置是否正确生效"));
    console.log(chalk.gray("• 如有问题可从恢复前快照手动回滚"));
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
}

export default RestoreManager;
