import type { DeckType } from './roomStore'

export interface SessionProfile {
  id: string
  name: string
  avatarColor: string
  joinedAt: number
}

export interface CreateRoomFormValues {
  roomName: string
  deckType: DeckType
  customDeck: string
}
