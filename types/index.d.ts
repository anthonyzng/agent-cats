export type CatStatus = 'working' | 'sleeping' | 'closed'

/** Which cats the dashboard lists: all, or only those working, asleep or waiting for the person. */
export type CatView = 'all' | 'working' | 'sleeping' | 'waiting'

/** `prefer`: the chosen skills are suggested; `only`: any other skill is refused. */
export type SkillMode = 'prefer' | 'only'

export type CatAgent = {
  id: string
  label: string
  /** The name the person gave the cat in the dashboard; shown before `label`. */
  nickname?: string
  type: string
  name?: string
  status: CatStatus
  rawStatus: string
  color: string
  startedAt: number
  endedAt?: number
  skills: string[]
  tool?: string
  isHidden?: boolean
  /** Stopped from the dashboard: not a finished task (no chime); a skill handed to it resumes it. */
  isStopped?: boolean
}

export type CatQuestion = {
  question: string
  header: string
  kind: 'choice' | 'text' | 'number'
  isMulti: boolean
  options: string[]
}

export type CatPending = {
  id: string
  kind: 'question' | 'permission'
  agentId: string
  askedAt: number
  questions: CatQuestion[]
  picks: string[][]
  others: string[]
  tool?: string
  detail?: string
}

declare module 'claude-code' {
  interface PluginState {
    'agent-cats': {
      agents: CatAgent[]
      pending: CatPending[]
      now: number
      native: string[]
      skills: string[]
      activeSkills: string[]
      skillMode: SkillMode
      skillFilter: string
      renaming: string
      view: CatView
      /** The cat whose Stop waits for the person's confirmation, or ''. */
      confirmStop: string
      /** Cats deleted from the dashboard: never listed again, even while the engine still lists them. */
      deleted: string[]
    }
  }
}
