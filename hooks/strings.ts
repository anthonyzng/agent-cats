// The dashboard's words, one table per language the `language` option offers.
// Text the model reads (prompts, denials) stays English in both: it is for the model.

export type Language = 'en' | 'zh-Hant'

export type Strings = {
  title: string
  commandDescription: string
  mainAgent: string
  status: { working: string; sleeping: string; closed: string }
  counts: { working: string; sleeping: string; waiting: string }
  meowQuestion: string
  meowPermission: (tool: string) => string
  pointer: (title: string) => string
  answerHere: string
  skillsHeading: string
  modeOnly: string
  modePrefer: string
  reloadList: string
  noneChosen: string
  clearAll: string
  filterPlaceholder: (count: number) => string
  filterSubmit: string
  addSkill: string
  pickInstalled: string
  noMatch: (filter: string) => string
  moreHidden: (hint: string, hidden: number) => string
  noSkillsFound: string
  searchPlaceholder: string
  searchSubmit: string
  searchToast: string
  needsYou: string
  waited: (time: string) => string
  wantsTool: (tool: string, detail: string) => string
  permissionNote: string
  otherPlaceholder: string
  answerPlaceholder: string
  confirm: string
  answerNatively: string
  send: string
  sendIncomplete: string
  useNative: string
  noAgents: string
  rename: string
  renamePlaceholder: string
  renameSubmit: string
  cancel: string
  taskLabel: (task: string) => string
  usingTool: (tool: string) => string
  skillsUsed: (list: string) => string
  skillsNone: string
  skillsSeparator: string
  giveSkill: string
  giveSkillHint: string
  wakePlaceholder: string
  wakeSubmit: string
  closeCat: string
  hideClosed: string
  skillGiven: (name: string, skill: string) => string
  skillNotGiven: (name: string) => string
  opened: string
}

export const STRINGS: Record<Language, Strings> = {
  en: {
    title: 'Agent Cats',
    commandDescription: 'Open the Agent Cats dashboard',
    mainAgent: 'Main agent',
    status: { working: 'Working', sleeping: 'Asleep (can be woken)', closed: 'Done' },
    counts: { working: 'Working', sleeping: 'Asleep', waiting: 'Waiting for you' },
    meowQuestion: 'An agent has a question for you: answer it in the Agent Cats dashboard',
    meowPermission: tool => `An agent wants to use ${tool} and is waiting for your approval`,
    pointer: title => `Answer this question in the ${title} dashboard.`,
    answerHere: 'Answer here',
    skillsHeading: 'Skills for this task',
    modeOnly: 'Mode: only the chosen ones',
    modePrefer: 'Mode: prefer the chosen ones',
    reloadList: 'Refresh list',
    noneChosen: 'None chosen (every skill works as usual)',
    clearAll: 'Clear all',
    filterPlaceholder: count => `Filter skills (${count} in all): type a keyword, then Enter`,
    filterSubmit: 'Filter',
    addSkill: 'Add a skill: ',
    pickInstalled: '— Pick an installed skill —',
    noMatch: filter => `— No skill matches "${filter}" —`,
    moreHidden: (hint, hidden) => `${hint} (${hidden} more: type above to filter)`,
    noSkillsFound: 'No installed skills found. Try "Refresh list".',
    searchPlaceholder: 'Find a new skill: say what you need, Enter asks the main agent to search',
    searchSubmit: 'Search',
    searchToast: 'Asked the main agent to look for a skill',
    needsYou: 'Needs your reply',
    waited: time => `waiting ${time}`,
    wantsTool: (tool, detail) => `wants to use ${tool}${detail ? `: ${detail}` : ''}`,
    permissionNote: 'Choose Allow / Deny in the permission dialog (only the native dialog can grant a permission).',
    otherPlaceholder: 'Other (type your own, Enter to confirm)',
    answerPlaceholder: 'Your answer (Enter to confirm)',
    confirm: 'Confirm',
    answerNatively: 'Answer in the native dialog.',
    send: 'Send answers',
    sendIncomplete: 'Send answers (not all answered)',
    useNative: 'Use the native dialog',
    noAgents: 'No agents yet.',
    rename: '✎ Rename',
    renamePlaceholder: 'New name (empty: back to the task name)',
    renameSubmit: 'Rename',
    cancel: 'Cancel',
    taskLabel: task => `Task: ${task}`,
    usingTool: tool => `using ${tool}`,
    skillsUsed: list => `Skills: ${list}`,
    skillsNone: 'none yet',
    skillsSeparator: ', ',
    giveSkill: '＋Skill: ',
    giveSkillHint: '— Hand it a skill —',
    wakePlaceholder: 'Give it a new task, Enter wakes it',
    wakeSubmit: 'Wake',
    closeCat: 'No need to wake it again: close',
    hideClosed: 'Hide the finished cats',
    skillGiven: (name, skill) => `Asked "${name}" to use ${skill}`,
    skillNotGiven: name => `${name} has finished: cannot hand it a skill`,
    opened: 'Agent Cats dashboard opened.',
  },
  'zh-Hant': {
    title: 'Agent 貓貓',
    commandDescription: '打開 Agent 貓貓 dashboard',
    mainAgent: '主 agent',
    status: { working: '工作中', sleeping: '休眠（可喚醒）', closed: '已結束' },
    counts: { working: '工作中', sleeping: '休眠', waiting: '等你回覆' },
    meowQuestion: '有 agent 問你問題，喺 Agent 貓貓 dashboard 答',
    meowPermission: tool => `有 agent 想用 ${tool}，等你批准`,
    pointer: title => `呢條問題請喺「${title}」dashboard 回答。`,
    answerHere: '喺呢度答',
    skillsHeading: '今次任務用嘅 skills',
    modeOnly: '模式：只准用揀咗嘅',
    modePrefer: '模式：優先用揀咗嘅',
    reloadList: '重新整理清單',
    noneChosen: '未揀（全部 skills 照常可用）',
    clearAll: '全部清除',
    filterPlaceholder: count => `篩選 skill（共 ${count} 個），打關鍵字再 Enter`,
    filterSubmit: '篩選',
    addSkill: '加入 skill：',
    pickInstalled: '— 揀一個已安裝嘅 skill —',
    noMatch: filter => `— 冇 skill 符合「${filter}」—`,
    moreHidden: (hint, hidden) => `${hint}（仲有 ${hidden} 個，喺上面打字篩選）`,
    noSkillsFound: '搵唔到已安裝嘅 skills，試吓撳「重新整理清單」。',
    searchPlaceholder: '搵新 skill：講你想做乜，Enter 叫主 agent 去搵',
    searchSubmit: '搵',
    searchToast: '已經叫主 agent 去搵 skill',
    needsYou: '需要你回覆',
    waited: time => `等咗 ${time}`,
    wantsTool: (tool, detail) => `想用 ${tool}${detail ? `：${detail}` : ''}`,
    permissionNote: '請喺權限對話框揀 Allow / Deny（權限只可以由原生對話框批准）。',
    otherPlaceholder: '其他（自己打，Enter 確認）',
    answerPlaceholder: '你嘅答案（Enter 確認）',
    confirm: '確認',
    answerNatively: '請喺原生對話框回答。',
    send: '送出答案',
    sendIncomplete: '送出答案（未答晒）',
    useNative: '改用原生對話框',
    noAgents: '未有 agent。',
    rename: '✎ 改名',
    renamePlaceholder: '新名（留空就用返原本嘅任務名）',
    renameSubmit: '改名',
    cancel: '取消',
    taskLabel: task => `任務：${task}`,
    usingTool: tool => `用緊 ${tool}`,
    skillsUsed: list => `Skills：${list}`,
    skillsNone: '未用',
    skillsSeparator: '、',
    giveSkill: '＋Skill：',
    giveSkillHint: '— 交一個 skill 俾佢 —',
    wakePlaceholder: '交代新工作，Enter 喚醒佢',
    wakeSubmit: '喚醒',
    closeCat: '唔使再喚醒，關閉佢',
    hideClosed: '收埋已結束嘅貓',
    skillGiven: (name, skill) => `已經叫「${name}」用 ${skill}`,
    skillNotGiven: name => `${name} 已經結束，交唔到 skill`,
    opened: 'Agent 貓貓 dashboard 已打開。',
  },
}

export function languageOf(value: unknown): Language {
  return value === 'zh-Hant' ? 'zh-Hant' : 'en'
}
