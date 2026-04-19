# 备份体系重构设计

## 1. 背景

当前项目的备份与恢复实现存在以下问题：

1. 备份范围由代码硬编码，扩展成本高，后续新增配置容易遗漏。
2. 备份范围与工具真实会写入的文件集不一致，例如 Claude 配置切换会写入 `~/.claude/config.json`，但当前备份未覆盖该文件。
3. 所有文件均按 UTF-8 文本读取，再转为 base64，遇到非 UTF-8 内容时存在失真风险。
4. 恢复流程会直接覆盖目标文件，缺少恢复前本地快照，回滚成本高。
5. 备份状态页只能展示存在性，无法体现“已覆盖/未覆盖”的完整性信息。

当前相关实现见：

- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\commands\backup\file-manager.js:24-57`
- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\commands\backup\backup.js:186-357`
- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\commands\backup\restore.js:258-425`
- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\core\ConfigManager.js:15-17`
- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\core\ConfigManager.js:317-363`

## 2. 目标

本次重构目标如下：

1. 将备份范围从硬编码路径迁移为声明式备份清单。
2. 保证所有关键 Claude、Codex、CC-CLI 配置均可被纳入默认备份范围。
3. 使用二进制安全的文件采集格式，兼容文本与非文本文件。
4. 在恢复前自动生成本地快照，降低覆盖恢复的风险。
5. 兼容历史备份格式，避免已有 WebDAV 备份失效。
6. 提供可理解的覆盖率状态输出，帮助用户发现遗漏项。

## 3. 非目标

本次不包含以下内容：

1. 不修改 Claude/Codex 配置切换逻辑本身。
2. 不引入新的云存储后端，仍仅使用 WebDAV。
3. 不新增交互式“任意自定义路径编辑器”。
4. 不迁移或批量重写用户已有远端备份文件。

## 4. 方案对比

### 方案 A：继续补硬编码路径

优点：

- 改动最小。
- 对现有逻辑侵入较低。

缺点：

- 后续仍会重复出现“新增配置未纳入备份”的问题。
- 备份范围与业务逻辑持续耦合。

### 方案 B：硬编码路径加部分通配规则

优点：

- 能覆盖部分目录变化。
- 比方案 A 稍强。

缺点：

- 规则依然分散在代码中。
- 长期维护成本仍高。

### 方案 C：声明式备份清单 + 二进制安全归档 + 恢复快照

优点：

- “备份什么”与“怎么备份”彻底解耦。
- 方便后续补充范围而不改核心逻辑。
- 能一次解决覆盖范围、格式安全和恢复风险。

缺点：

- 改动较大。
- 需要补齐兼容测试和恢复测试。

结论：采用方案 C。

## 5. 总体设计

### 5.1 新增备份清单文件

新增仓库内静态清单文件，建议路径：

- `C:\Users\Administrator\.codex\worktrees\7226\cc-cli\src\commands\backup\backup-manifest.json`

清单职责：

1. 定义备份类别。
2. 定义每个类别的文件、目录、可选项。
3. 定义状态检查时的“常见但未纳入项”。
4. 作为备份、恢复、状态展示的单一来源。

建议结构：

```json
{
  "version": 1,
  "categories": {
    "ccCli": {
      "name": "CC-CLI配置",
      "entries": [
        { "type": "directory", "key": ".cc-cli", "path": "~/.cc-cli", "required": true }
      ]
    },
    "claudeCode": {
      "name": "Claude Code配置",
      "entries": [
        { "type": "file", "key": "settings.json", "path": "~/.claude/settings.json", "required": false },
        { "type": "file", "key": "config.json", "path": "~/.claude/config.json", "required": false },
        { "type": "file", "key": "CLAUDE.md", "path": "~/.claude/CLAUDE.md", "required": false },
        { "type": "directory", "key": "agents", "path": "~/.claude/agents", "required": false },
        { "type": "directory", "key": "commands", "path": "~/.claude/commands", "required": false },
        { "type": "directory", "key": "skills", "path": "~/.claude/skills", "required": false }
      ],
      "coverageHints": [
        "~/.claude/hooks",
        "~/.claude/projects"
      ]
    },
    "codex": {
      "name": "Codex配置",
      "entries": [
        { "type": "file", "key": "config.toml", "path": "~/.codex/config.toml", "required": false },
        { "type": "file", "key": "auth.json", "path": "~/.codex/auth.json", "required": false },
        { "type": "file", "key": "AGENTS.md", "path": "~/.codex/AGENTS.md", "required": false },
        { "type": "directory", "key": "skills", "path": "~/.codex/skills", "required": false },
        { "type": "directory", "key": "prompts", "path": "~/.codex/prompts", "required": false }
      ]
    }
  }
}
```

### 5.2 FileManager 重构

`FileManager` 从“初始化固定路径表”改为“加载清单并解析当前环境路径”。

重构后职责：

1. 读取 `backup-manifest.json`。
2. 将 `~` 解析为当前用户家目录。
3. 为每个类别生成标准化条目：
   - `type`
   - `key`
   - `path`
   - `required`
   - `exists`
   - `size/fileCount`
4. 提供统一方法给备份、恢复、状态页复用。

新增方法建议：

1. `loadManifest()`
2. `resolveManifestPath(rawPath)`
3. `getCategoryDefinitions()`
4. `getCategoryEntries(category)`
5. `checkCoverageHints(category)`

### 5.3 备份数据格式重构

当前备份格式按类别拆分 `files` 和 `directories`，且文件内容按 UTF-8 读取。新格式改为统一归档条目列表：

```json
{
  "type": "cc-backup",
  "version": "3.0.0",
  "manifestVersion": 1,
  "timestamp": "2026-04-19T00:00:00.000Z",
  "categories": {
    "claudeCode": {
      "name": "Claude Code配置",
      "entries": [
        {
          "entryType": "file",
          "key": "settings.json",
          "rootPath": "C:/Users/.../.claude/settings.json",
          "relativePath": "settings.json",
          "required": false,
          "size": 1024,
          "mtime": "2026-04-19T00:00:00.000Z",
          "mode": 420,
          "sha256": "xxx",
          "encoding": "base64",
          "contentBase64": "xxx"
        }
      ]
    }
  }
}
```

设计要点：

1. 顶层文件和目录内文件统一为同一类条目。
2. 文件内容统一用 `Buffer` 读取，再转 base64。
3. 保留 `mtime`、`mode`、`sha256` 便于校验和调试。
4. 缺失项不写入 `contentBase64`，仅记录元信息和缺失原因。
5. 目录条目本身只保存根路径信息，真正恢复单位是目录内文件条目。

### 5.4 目录采集方式

目录采集改为：

1. 先记录目录根条目。
2. 递归遍历其下所有文件。
3. 每个文件以“相对于目录根”的 `relativePath` 存储。

好处：

1. 恢复时更简单，不需要区分 `files/subdirectories` 树结构。
2. 更容易做文件级别校验和过滤。
3. 更方便后续支持增量备份。

### 5.5 恢复前本地快照

恢复流程新增“预快照”阶段。

快照路径：

- `~/.cc-cli/restore-snapshots/<timestamp>/`

快照策略：

1. 仅备份本次即将覆盖的目标文件和目录内容。
2. 保持原始目录相对结构。
3. 生成一个 `snapshot-manifest.json` 记录来源和备份时间。

恢复流程调整为：

1. 下载并解析备份。
2. 选择恢复类别。
3. 确认恢复。
4. 生成本地快照。
5. 执行恢复。
6. 输出恢复结果和快照位置。

如果恢复过程中某个文件失败：

1. 不中断整个类别的剩余文件恢复。
2. 统计失败数量。
3. 明确提示快照位置，允许用户手动回滚。

本次不做自动回滚整个恢复过程，避免在部分成功、部分失败时引入新的覆盖行为。

### 5.6 旧备份兼容策略

恢复时按版本分支处理：

1. 当 `version` 小于 `3.0.0` 或缺少新结构字段时，走旧版解析逻辑。
2. 当 `version` 为 `3.0.0` 时，走新条目列表解析逻辑。

这样可以保证已有 WebDAV 备份继续可恢复。

### 5.7 状态页覆盖率展示

状态页增加三类信息：

1. 已纳入且存在。
2. 已纳入但当前本机不存在。
3. 常见但未纳入，仅作为提示，不参与备份。

输出示例：

```text
✅ Claude Code配置
  已纳入:
    📄 settings.json
    📄 config.json
    📁 agents/
  已纳入但缺失:
    📁 commands/
  覆盖提示:
    ⚠️ 检测到 ~/.claude/hooks 存在，但当前清单未纳入
```

这部分的目标不是鼓励自动把所有东西都备份，而是帮助用户识别覆盖盲区。

## 6. 详细实现计划

### 6.1 新增文件

1. `src/commands/backup/backup-manifest.json`

### 6.2 修改文件

1. `src/commands/backup/file-manager.js`
2. `src/commands/backup/backup.js`
3. `src/commands/backup/restore.js`
4. `src/commands/backup/index.js`

视实现需要，可能补充：

5. `README.md`
6. `CHANGELOG.md`

### 6.3 FileManager 实现方向

1. 删除旧的固定 `configPaths` 构造逻辑。
2. 改为读取清单并生成标准化类别定义。
3. 保留 `getCategoryPaths(category)` 的兼容接口，但返回新结构。
4. 增加状态检查输出中对 coverage hints 的支持。

### 6.4 BackupManager 实现方向

1. 将“按文件/目录两棵树采集”改为“按清单条目统一采集”。
2. 使用 `Buffer` 读取文件内容。
3. 对每个文件计算 `sha256`。
4. 更新备份统计逻辑，基于条目列表统计文件数和大小。
5. 保留旧版字段解析能力不是备份阶段的职责，因此只在恢复中兼容旧版。

### 6.5 RestoreManager 实现方向

1. 新增备份版本识别。
2. 对新格式按条目恢复。
3. 对旧格式保留现有恢复逻辑。
4. 新增恢复前快照生成。
5. 最终输出中附带快照路径。

## 7. 风险与应对

### 风险 1：新旧格式共存导致恢复逻辑复杂

应对：

1. 将旧格式恢复逻辑单独封装为兼容分支。
2. 新格式恢复逻辑独立实现。
3. 用测试覆盖两套输入。

### 风险 2：目录递归导致备份文件过大

应对：

1. 当前仍以配置目录为主，规模可接受。
2. 先不加入大文件目录。
3. 后续若有需要再引入大小阈值或忽略规则。

### 风险 3：快照目录持续增长

应对：

1. 首版先保留全部快照。
2. 后续可按数量或时间清理。
3. 状态页可提示快照目录位置。

## 8. 测试策略

### 8.1 单元级验证

1. 清单加载与路径解析正确。
2. `~` 能正确解析到当前用户目录。
3. `config.json` 等新增关键文件被纳入默认类别。
4. 状态页能区分已纳入/缺失/提示项。

### 8.2 备份格式验证

1. 文本文件备份后内容可正确恢复。
2. 非 UTF-8 或二进制内容通过 `Buffer` 备份恢复不失真。
3. `sha256`、`size`、`mtime` 等字段按预期写入。

### 8.3 恢复流程验证

1. 新格式备份可恢复到目标位置。
2. 旧格式备份仍可恢复。
3. 恢复前会生成快照。
4. 目标路径不存在时可自动创建父目录。

### 8.4 CLI 级验证

1. `node bin/cc.js --help`
2. 备份状态命令相关流程不报错。

## 9. 成功标准

本次修改完成后，应满足以下标准：

1. 默认备份范围覆盖当前工具实际会写入的关键配置文件，并包含 Codex 的 `~/.codex/skills/` 与 `~/.codex/prompts/`。
2. 新备份格式不再依赖 UTF-8 文本读取。
3. 恢复前会自动生成本地快照。
4. 旧版备份文件仍可恢复。
5. 状态页可以清楚看出备份覆盖率。
6. 有针对清单、备份格式和恢复兼容的自动化测试。
