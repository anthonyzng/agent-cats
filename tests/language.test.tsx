import { test, expect } from 'claude-code/testing'

const PANE_PROPS = {
  title: 'Agent Cats',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, height: 40 },
  view: { rows: 40 },
} as never

async function heading($: any): Promise<string | undefined> {
  const ui = await $.ui.mount({
    plugin: 'agent-cats',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'agent-cats',
    props: PANE_PROPS,
    viewport: { columns: 80, rows: 40 },
  })
  const title = await ui.find({ type: 'Text', text: /^🐾/ })
  await ui.unmount()
  return title?.text
}

test('the dashboard speaks English by default', async ($: any) => {
  expect(await heading($)).toBe('🐾 Agent Cats')
})

test('the language option switches it to Traditional Chinese', { options: { language: 'zh-Hant' } }, async ($: any) => {
  expect(await heading($)).toBe('🐾 Agent 貓貓')
})
