import { useSyncExternalStore } from 'react'

export type DeckType = 'fibonacci' | 'numeric' | 'custom'

export interface ParticipantProfile {
  id: string
  name: string
  avatarColor: string
  joinedAt: number
}

export interface RoomState {
  id: string
  name: string
  deckType: DeckType
  deckValues: string[]
  hostId: string
  participants: Record<string, ParticipantProfile>
  votes: Record<string, string | null>
  revealed: boolean
  createdAt: number
}

interface RoomsMap {
  [roomId: string]: RoomState
}

const STORAGE_KEY = 'planning-poker-rooms'
const BROADCAST_KEY = 'planning-poker-sync'

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

function loadRooms(): RoomsMap {
  if (!isBrowser) return {}
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored) as RoomsMap
    // Validate deck arrays to ensure they are arrays of strings
    Object.values(parsed).forEach((room) => {
      if (!Array.isArray(room.deckValues)) {
        room.deckValues = []
      } else {
        room.deckValues = room.deckValues.map((value) => String(value))
      }
      room.revealed = Boolean(room.revealed)
    })
    return parsed
  } catch (error) {
    console.warn('Unable to parse rooms from storage', error)
    return {}
  }
}

let rooms: RoomsMap = loadRooms()
const listeners = new Set<() => void>()

const channel: BroadcastChannel | null = isBrowser && 'BroadcastChannel' in window
  ? new BroadcastChannel(BROADCAST_KEY)
  : null

channel?.addEventListener('message', (event) => {
  const data = event.data as { type?: string; payload?: unknown }
  if (!data || typeof data !== 'object') return
  if (data.type === 'rooms-sync' && data.payload && typeof data.payload === 'object') {
    rooms = data.payload as RoomsMap
    persist()
    emit()
  }
})

function emit() {
  listeners.forEach((listener) => listener())
}

function persist() {
  if (!isBrowser) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
}

function broadcast() {
  if (!channel) return
  channel.postMessage({ type: 'rooms-sync', payload: rooms })
}

function updateRooms(mutator: (draft: RoomsMap) => void) {
  const draft: RoomsMap = JSON.parse(JSON.stringify(rooms))
  mutator(draft)
  rooms = draft
  persist()
  broadcast()
  emit()
}

export function getRoomsSnapshot(): RoomsMap {
  return rooms
}

export function subscribeRooms(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRooms(): RoomsMap {
  return useSyncExternalStore(subscribeRooms, getRoomsSnapshot, () => ({} as RoomsMap))
}

export function useRoom(roomId: string | null) {
  const allRooms = useRooms()
  if (!roomId) return null
  return allRooms[roomId] ?? null
}

export interface CreateRoomOptions {
  name: string
  deckType: DeckType
  customDeck?: string[]
  host: ParticipantProfile
}

const PRESET_DECKS: Record<Exclude<DeckType, 'custom'>, string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
  numeric: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?', '☕'],
}

function resolveDeck(deckType: DeckType, customDeck?: string[]) {
  if (deckType === 'custom') {
    const deck = (customDeck ?? []).map((value) => value.trim()).filter((value) => value.length > 0)
    return deck.length > 0 ? deck : ['?']
  }
  return [...PRESET_DECKS[deckType]]
}

export function createRoom(options: CreateRoomOptions) {
  const id = generateRoomId()
  const deckValues = resolveDeck(options.deckType, options.customDeck)
  const participant: ParticipantProfile = {
    id: options.host.id,
    name: options.host.name,
    avatarColor: options.host.avatarColor,
    joinedAt: options.host.joinedAt,
  }

  const votes: Record<string, string | null> = {
    [participant.id]: null,
  }

  const room: RoomState = {
    id,
    name: options.name.trim() || 'Sala sem nome',
    deckType: options.deckType,
    deckValues,
    hostId: participant.id,
    participants: {
      [participant.id]: participant,
    },
    votes,
    revealed: false,
    createdAt: Date.now(),
  }

  updateRooms((draft) => {
    draft[id] = room
  })

  return id
}

export interface JoinRoomResult {
  success: boolean
  reason?: string
  room?: RoomState
}

export function joinRoom(roomId: string, profile: ParticipantProfile): JoinRoomResult {
  const currentRoom = rooms[roomId]
  if (!currentRoom) {
    return { success: false, reason: 'Sala não encontrada.' }
  }

  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return

    room.participants[profile.id] = {
      id: profile.id,
      name: profile.name,
      avatarColor: profile.avatarColor,
      joinedAt: room.participants[profile.id]?.joinedAt ?? profile.joinedAt,
    }

    if (!(profile.id in room.votes)) {
      room.votes[profile.id] = null
    }
  })

  return { success: true, room: rooms[roomId] }
}

export function leaveRoom(roomId: string, participantId: string) {
  const currentRoom = rooms[roomId]
  if (!currentRoom) return

  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return

    delete room.participants[participantId]
    delete room.votes[participantId]

    const remainingIds = Object.keys(room.participants)
    if (remainingIds.length === 0) {
      delete draft[roomId]
      return
    }

    if (room.hostId === participantId) {
      room.hostId = remainingIds[0]
    }

    if (room.revealed && remainingIds.length === 0) {
      room.revealed = false
    }
  })
}

export function updateParticipantProfile(
  roomId: string,
  participantId: string,
  updates: Partial<Omit<ParticipantProfile, 'id' | 'joinedAt'>>,
) {
  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return
    const participant = room.participants[participantId]
    if (!participant) return
    room.participants[participantId] = {
      ...participant,
      ...updates,
    }
  })
}

export function submitVote(roomId: string, participantId: string, value: string | null) {
  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return
    if (!(participantId in room.participants)) return
    room.votes[participantId] = value
    if (value === null) {
      room.revealed = false
    }
  })
}

export function revealVotes(roomId: string) {
  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return
    room.revealed = true
  })
}

export function resetVotes(roomId: string) {
  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return
    Object.keys(room.votes).forEach((participantId) => {
      room.votes[participantId] = null
    })
    room.revealed = false
  })
}

export function removeParticipant(roomId: string, participantId: string) {
  leaveRoom(roomId, participantId)
}

export function transferHost(roomId: string, newHostId: string) {
  updateRooms((draft) => {
    const room = draft[roomId]
    if (!room) return
    if (!(newHostId in room.participants)) return
    room.hostId = newHostId
  })
}

function generateRoomId() {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase()
}
