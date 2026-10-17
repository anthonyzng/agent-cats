# Agent 貓貓（Agent Cats）

[English](README.md) | **繁體中文**

一個 [Claude Code](https://claude.com/claude-code) mod，將一個 session 入面所有 agent 變成一個貓貓 dashboard。

- **每個 agent 一隻貓。** 主 agent 同每個 sub-agent 各有自己嘅顏色。Desktop app 同 VS Code 顯示 SVG 貓，terminal 顯示 `ᓚᘏᗢ`。
- **一眼睇晒每隻貓做緊乜。** 每隻貓會顯示任務、狀態、做咗幾耐、agent 類型、而家用緊邊個 tool，同埋載入咗邊啲 skills。
- **休眠定結束。** Sub-agent 做完之後，佢嘅貓會轉狀態：
  - **休眠（可喚醒）**：`SendMessage` 仲搵到佢。喺佢個輸入框交代新工作，主 agent 就會叫醒佢。
  - **已結束**：失敗、被停咗，或者已經冇得聯絡佢。
  - 唔使再叫醒佢，就撳**關閉**。
- **只睇某類貓。** 頂部嘅數字係掣：**全部**、**工作中**、**休眠**、**等你回覆**，撳咗就只顯示嗰類貓；再撳一次揀咗嗰個就返去睇全部。
- **停止一隻貓。** 工作中嘅貓有 **■ 停止**，撳咗會先問你確認。主 agent 會中止嗰一輪，subagent 會用 `TaskStop` 停止。停咗嘅貓仍然有 **＋Skill** 選單：交個 skill 俾佢，佢讀完就會繼續做（subagent 用 `SendMessage` 喚醒，所以佢要有名）。
- **刪除一隻貓。** 唔係工作中嘅貓有 **🗑 刪除**，撳咗佢就會由 dashboard 消失，就算 Claude Code 仲列住呢個 agent 都唔會再出現。
- **Agent 完成或者等你嗰陣會出聲。** Agent 完成任務、問你問題或者等權限嗰陣，會播 `sounds/Hachimi.mp3`。同一時間只會播一段：幾個 agent 接連完成都只會響一次，播緊嗰陣唔會排隊亦唔會疊埋一齊播。你自己停咗嘅貓唔會響。
- **喺 dashboard 直接答問題。** Agent 問你嘢（`AskUserQuestion`）嗰陣，問題會出喺 dashboard 頂部，同時會出聲提你。
  - 撳一個選項，或者自己打答案。
  - 原本嘅對話框會變成一句提示，叫你去 dashboard 答。萬一有問題，可以撳**改用原生對話框**。
  - 權限請求都會顯示，同樣會出聲。不過 Allow / Deny 仍然要喺原生對話框撳，因為只有引擎可以批准權限。
- **幫貓改名。** 用 **✎ 改名** 幫每隻貓改個你自己記得嘅名。
- **Skills：**
  - 每隻貓嘅 **＋Skill** 可以交一個已安裝嘅 skill 俾佢：
    - 做緊嘢嘅 agent 下一步就會讀到
    - 休眠嘅 sub-agent 會被叫醒去用
    - 閒住嘅主 agent 會收到一個 prompt
  - **搵新 skill**：叫主 agent 去 skill 同 plugin 目錄搵，再出安裝卡。你未撳卡，就唔會裝任何嘢。
  - **今次任務用嘅 skills**：揀今次工作要用嘅 skills，有兩個模式：
    - **優先用**：每個 prompt 同每個新開嘅 sub-agent 都會被提醒用呢啲 skills
    - **只准用**：其他 skill 一律擋住
- **英文或繁體中文。** Dashboard 嘅語言可以喺設定改（睇下面）。

## 要求

Claude Code **2.1.286 或以上**，即係第一個支援 mods（function hooks）嘅版本。

## 安裝

喺 Claude Code 入面打：

```
/plugin marketplace add anthonyzng/agent-cats
/plugin install agent-cats@agent-cats
```

之後打 `/cats` 打開 dashboard。如果開 session 時個視窗夠闊，個 pane 會自己打開；有 agent 問你嘢嗰陣，佢亦會自己打開。

之後要更新：

```
/plugin marketplace update agent-cats
```

### 用本機副本

```bash
git clone https://github.com/anthonyzng/agent-cats.git
claude --plugin-dir ./agent-cats
```

Desktop app 呢類冇得加 flag 嘅環境，可以喺 `~/.claude/settings.json` 嘅 `env` 入面設 `CLAUDE_CODE_PLUGIN_DIRS`，填個資料夾嘅絕對路徑。

## 語言

Dashboard 預設係英文。想轉做繁體中文（廣東話）：

1. 打開 `/config`
2. 搵 agent-cats 嘅 **Language** 嗰行
3. 揀 `zh-Hant`

Claude Code 會將個選擇存喺 `~/.claude/settings.json` 嘅 `pluginConfigs`，mod 會即刻用新語言重新載入。俾 agent 讀嘅文字（例如 skill 指示）會保持英文。

## 要留意嘅地方

- **Mods 冇 sandbox。** 同所有 mod 一樣，呢個 mod 喺 Claude Code 入面用你嘅權限行。安裝之前請先睇 `hooks/register.tsx`。佢唔會上網，亦唔會寫任何檔案；唯一用到嘅外部檔案係內附嘅聲音檔 `sounds/Hachimi.mp3`，而喺 Windows 佢只會行一個程式：用 `powershell.exe` 播呢個聲。
- **「只准用」模式對成個 session 所有 agent 都生效**，包括主 agent。
- **你用緊 dashboard 嘅時候，佢唔會郁。** 你喺下拉選單或者輸入框入面嗰陣，每秒一次嘅更新會暫停，所以打開咗嘅選單唔會跳返最頂。
  - Terminal 版做得到。
  - Desktop app 唔會講係邊個元素攞咗 focus，所以喺 desktop，agent 做緊嘢嗰陣，打開咗嘅下拉選單仍然可能被重新畫。
  - 所有 agent 都閒住嘅時候，dashboard 完全唔會重新畫。
- **`/cats` 會印一行診斷**：搵到幾多個 skill、pane 畫咗幾多次，同埋最近嘅 focus 變化。
- **播聲音。** macOS 用 Claude Code 自己嘅播放器。Windows 上面 Claude Code 冇播放器，所以 mod 會用 PowerShell 嘅 MediaPlayer（Windows 內置嘅 `powershell.exe`）播。Linux 嘅 terminal 冇播放器，只會出 toast 通知。

## 開發

```bash
claude plugin validate .   # 列出個 module hook 咗乜、call 咗乜，同埋引擎會拒絕嘅地方
claude plugin test .       # 用引擎本身行 tests/*.test.tsx
python scripts/make-meow.py  # 重新生成 sounds/meow.wav（只用標準庫）
```

Claude Code 載入 mod 嘅時候會將類型定義寫入 `.claude-plugin/types/`，`tsconfig.json` 會 extend 佢，所以 `tsc -p .` 就可以做 type check。介面文字喺 `hooks/strings.ts`，每種語言一張表。

## License

[MIT](LICENSE)
