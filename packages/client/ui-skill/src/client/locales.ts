/** `skill` namespace dictionaries for the dedicated tool row. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'skill'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'row.title': 'Skill',
  'row.running': '正在加载 skill',
  'row.failed': 'skill 加载失败',
  'row.stopped': 'skill 加载已中止',
  'row.instructions': '说明',
  'row.inspect': '查看',
  'menu.userOnly': '仅用户',
  'settings.nav': 'Skills',
  'settings.title': 'Skill 管理',
  'settings.intro': '选择聊天输入框中可见的本地 Skill，并按需重新读取当前工作区目录。',
  'settings.installIntro': 'Skill 就是一个 Markdown 文件：把文件或文件夹放进下面的目录，保存后即可在对话中使用，无需重启或额外配置。',
  'settings.openDirectory': '打开 Skill 目录',
  'settings.opening': '正在打开…',
  'settings.openError': '无法打开 Skill 目录。',
  'settings.directoryLabel': 'Skill 目录：',
  'settings.refresh': '刷新目录',
  'settings.refreshing': '正在刷新…',
  'settings.noSession': '打开一个会话后即可读取该工作区的 Skill。',
  'settings.error': '暂时无法读取 Skill 目录。',
  'settings.retry': '重试',
  'settings.search': '搜索 Skill',
  'settings.count': '{count} 个 Skill',
  'settings.empty': '当前工作区没有可用的 Skill。',
  'settings.emptySearch': '没有匹配的 Skill。',
  'settings.showInChat': '在聊天框显示',
  'settings.userOnly': '仅用户',
  'settings.sourceProject': '项目',
  'settings.sourceUser': '用户',
  'settings.sourceBundled': '内置',
  'settings.sourceRuntime': '运行时',
  'settings.sourceCustom': '自定义',
} satisfies Record<string, string>

/** The skill namespace key union. */
export type SkillKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'row.title': 'Skill',
  'row.running': 'Loading skill',
  'row.failed': 'Skill load failed',
  'row.stopped': 'Skill load stopped',
  'row.instructions': 'Instructions',
  'row.inspect': 'Inspect',
  'menu.userOnly': 'user-only',
  'settings.nav': 'Skills',
  'settings.title': 'Skill management',
  'settings.intro': 'Choose which local skills appear in chat and refresh the current workspace catalog on demand.',
  'settings.installIntro': 'A skill is a Markdown file: drop a file or folder into the directory below and it becomes available in chat after saving — no restart or extra configuration.',
  'settings.openDirectory': 'Open skills directory',
  'settings.opening': 'Opening…',
  'settings.openError': 'Could not open the skills directory.',
  'settings.directoryLabel': 'Skills directory: ',
  'settings.refresh': 'Refresh catalog',
  'settings.refreshing': 'Refreshing…',
  'settings.noSession': 'Open a session to read skills for its workspace.',
  'settings.error': 'The skill catalog is temporarily unavailable.',
  'settings.retry': 'Retry',
  'settings.search': 'Search skills',
  'settings.count': '{count} skills',
  'settings.empty': 'No skills are available in this workspace.',
  'settings.emptySearch': 'No matching skills.',
  'settings.showInChat': 'Show in chat',
  'settings.userOnly': 'User only',
  'settings.sourceProject': 'Project',
  'settings.sourceUser': 'User',
  'settings.sourceBundled': 'Bundled',
  'settings.sourceRuntime': 'Runtime',
  'settings.sourceCustom': 'Custom',
} satisfies Record<SkillKey, string>
