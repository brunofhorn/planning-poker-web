import { useEffect, useState } from 'react'
import './App.css'
import {
  createRoom,
  joinRoom,
  leaveRoom,
  updateParticipantProfile,
  useRoom,
} from './roomStore'
import type { DeckType } from './roomStore'
import type { SessionProfile } from './types'
import LandingView from './components/LandingView'
import RoomView from './components/RoomView'

const SESSION_STORAGE_KEY = 'planning-poker-session'
const CURRENT_ROOM_KEY = 'planning-poker-current-room'
const DEFAULT_COLOR = '#3498db'

function loadStoredSession(): SessionProfile | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as SessionProfile
    if (!parsed.id) return null
    return parsed
  } catch (error) {
    console.warn('Não foi possível restaurar a sessão', error)
    return null
  }
}

function loadStoredRoom(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(CURRENT_ROOM_KEY)
}

function generateSessionId() {
  return 'USR-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function parseCustomDeck(input: string) {
  return input
    .split(/\s*[,\n]\s*/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function ensureSession(base: SessionProfile | null): SessionProfile {
  if (base) return base
  const now = Date.now()
  return {
    id: generateSessionId(),
    name: '',
    avatarColor: DEFAULT_COLOR,
    joinedAt: now,
  }
}

function App() {
  const [session, setSession] = useState<SessionProfile | null>(() => ensureSession(loadStoredSession()))
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => loadStoredRoom())
  const [errors, setErrors] = useState({ session: null as string | null, create: null as string | null, join: null as string | null })

  const room = useRoom(currentRoomId)
  const isInRoom = Boolean(room)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!session) return
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (currentRoomId) {
      window.localStorage.setItem(CURRENT_ROOM_KEY, currentRoomId)
    } else {
      window.localStorage.removeItem(CURRENT_ROOM_KEY)
    }
  }, [currentRoomId])

  useEffect(() => {
    if (!room || !session) return
    if (!room.participants[session.id]) {
      setCurrentRoomId(null)
    }
  }, [room, session])

  useEffect(() => {
    if (!room || !session) return
    const participant = room.participants[session.id]
    if (!participant) return
    if (participant.name === session.name && participant.avatarColor === session.avatarColor) return
    updateParticipantProfile(room.id, session.id, {
      name: session.name,
      avatarColor: session.avatarColor,
    })
  }, [room, session])

  function clearErrors() {
    setErrors({ session: null, create: null, join: null })
  }

  function handleSessionUpdate(updates: Partial<SessionProfile>) {
    setSession((previous) => {
      const base = ensureSession(previous)
      const merged: SessionProfile = {
        ...base,
        ...updates,
        joinedAt: base.joinedAt,
      }
      if ('name' in updates) {
        if (!merged.name.trim()) {
          setErrors((current) => ({ ...current, session: 'Informe um nome para continuar.' }))
        } else {
          setErrors((current) => ({ ...current, session: null }))
        }
      }
      return merged
    })
  }

  function handleCreateRoom(values: { roomName: string; deckType: DeckType; customDeck: string }) {
    if (!session) return
    const trimmedName = session.name.trim()
    if (!trimmedName) {
      setErrors((current) => ({ ...current, session: 'Informe um nome antes de criar uma sala.' }))
      return
    }

    const deckValues = values.deckType === 'custom' ? parseCustomDeck(values.customDeck) : undefined
    const hostProfile: SessionProfile = {
      ...session,
      name: trimmedName,
      joinedAt: Date.now(),
    }

    const roomId = createRoom({
      name: values.roomName.trim() || `${trimmedName} - Planning Poker`,
      deckType: values.deckType,
      customDeck: deckValues,
      host: hostProfile,
    })

    setCurrentRoomId(roomId)
    clearErrors()
  }

  function handleJoinRoom(roomIdRaw: string) {
    if (!session) return
    const trimmedName = session.name.trim()
    if (!trimmedName) {
      setErrors((current) => ({ ...current, session: 'Informe um nome antes de entrar em uma sala.' }))
      return
    }

    const roomId = roomIdRaw.trim().toUpperCase()
    const result = joinRoom(roomId, {
      ...session,
      name: trimmedName,
      joinedAt: Date.now(),
    })

    if (!result.success) {
      setErrors((current) => ({ ...current, join: result.reason ?? 'Não foi possível entrar na sala.' }))
      return
    }

    setCurrentRoomId(roomId)
    clearErrors()
  }

  function handleLeaveRoom() {
    if (!room || !session) return
    leaveRoom(room.id, session.id)
    setCurrentRoomId(null)
  }

  const content = isInRoom && room && session && session.name.trim()
    ? (
        <RoomView room={room} session={session} onLeave={handleLeaveRoom} />
      )
    : (
        <LandingView
          session={session}
          onSessionUpdate={handleSessionUpdate}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          errors={errors}
          clearError={clearErrors}
        />
      )

  return <div className="app-shell">{content}</div>
}

export default App
