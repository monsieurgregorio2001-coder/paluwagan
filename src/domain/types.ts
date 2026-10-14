export type Frequency = 'weekly' | 'biweekly' | 'monthly'

export interface Member {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
  /** Members in payout order. Cycle N pays members[N - 1]. */
  members: Member[]
  /** Fixed contribution per member per cycle, in integer centavos. */
  contributionCentavos: number
  frequency: Frequency
  /** Calendar date (YYYY-MM-DD, Asia/Manila) of the first cycle due date. */
  startDate: string
  orderMethod: 'manual' | 'seeded'
  seed?: string
  /** Member names in the order they were entered, before seeded shuffling. */
  seedInput?: string[]
}

export type ContributionStatus = 'on_time' | 'late' | 'missed'

export interface Entry {
  id: string
  seq: number
  /** ISO timestamp of when the entry was appended. */
  ts: string
  type: 'contribution' | 'payout' | 'reversal'
  cycle: number
  memberId: string
  /** Positive integer centavos. Zero only for missed contributions. */
  amount: number
  status?: ContributionStatus
  paidDate?: string
  daysLate?: number
  reverses?: string
  reversedType?: 'contribution' | 'payout'
  note?: string
}
