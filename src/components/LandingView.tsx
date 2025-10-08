import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { DeckType } from '../roomStore'
import type { CreateRoomFormValues, SessionProfile } from '../types'

const AVATAR_COLORS = ['#1abc9c', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#f1c40f', '#2ecc71', '#ff6b6b']

interface LandingViewProps {
  session: SessionProfile | null
  onSessionUpdate: (updates: Partial<SessionProfile>) => void
  onCreateRoom: (values: CreateRoomFormValues) => void
  onJoinRoom: (roomId: string) => void
  errors: {
    session?: string | null
    create?: string | null
    join?: string | null
  }
  clearError: () => void
}

export function LandingView({
  session,
  onSessionUpdate,
  onCreateRoom,
  onJoinRoom,
  errors,
  clearError,
}: LandingViewProps) {
  const [nameInput, setNameInput] = useState(session?.name ?? '')
  const [roomName, setRoomName] = useState('')
  const [deckType, setDeckType] = useState<DeckType>('fibonacci')
  const [customDeck, setCustomDeck] = useState('1, 2, 3, 5, 8, 13')
  const [roomIdInput, setRoomIdInput] = useState('')

  const avatarColor = session?.avatarColor ?? AVATAR_COLORS[0]

  const customDeckPreview = useMemo(() => {
    return customDeck
      .split(/\s*[,\n]\s*/)
      .map((value) => value.trim())
      .filter(Boolean)
  }, [customDeck])

  const hasIdentity = Boolean(session?.name)

  function handleIdentitySubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) {
      return
    }
    onSessionUpdate({ name: trimmed })
    clearError()
  }

  function handleColorChange(color: string) {
    onSessionUpdate({ avatarColor: color })
    clearError()
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    if (!hasIdentity) {
      onSessionUpdate({ name: nameInput.trim() })
      return
    }
    onCreateRoom({ roomName, deckType, customDeck })
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    const cleanId = roomIdInput.trim()
    if (!cleanId) return
    onJoinRoom(cleanId)
  }

  return (
    <div className="landing">
      <section className="landing-panel identity">
        <header>
          <h1>Planning Poker</h1>
          <p>Organize estimativas em tempo real com sua equipe.</p>
        </header>

        <form className="identity-form" onSubmit={handleIdentitySubmit}>
          <span className="avatar-preview" style={{ backgroundColor: avatarColor }}>
            {nameInput ? nameInput.charAt(0).toUpperCase() : '?'}
          </span>
          <label htmlFor="displayName">Seu nome</label>
          <input
            id="displayName"
            type="text"
            value={nameInput}
            placeholder="Digite como deseja ser visto"
            onChange={(event) => setNameInput(event.target.value)}
            onFocus={clearError}
          />
          <div className="color-picker">
            <span>Escolha uma cor:</span>
            <div className="color-grid">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch${color === avatarColor ? ' selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  aria-label={`Selecionar cor ${color}`}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="primary">
            {hasIdentity ? 'Atualizar perfil' : 'Salvar perfil'}
          </button>
          {errors.session ? <p className="form-error">{errors.session}</p> : null}
        </form>
      </section>

      <section className="landing-panel action">
        <div className="action-card">
          <h2>Criar uma nova sala</h2>
          <form onSubmit={handleCreate} className="action-form">
            <label htmlFor="roomName">Nome da sala</label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Time de produto, sprint, etc."
              onFocus={clearError}
            />

            <fieldset className="deck-options">
              <legend>Estilo de pontuação</legend>
              <div className="radio-grid">
                <label>
                  <input
                    type="radio"
                    name="deckType"
                    value="fibonacci"
                    checked={deckType === 'fibonacci'}
                    onChange={() => setDeckType('fibonacci')}
                  />
                  Fibonacci
                </label>
                <label>
                  <input
                    type="radio"
                    name="deckType"
                    value="numeric"
                    checked={deckType === 'numeric'}
                    onChange={() => setDeckType('numeric')}
                  />
                  Numérico (0 - 10)
                </label>
                <label>
                  <input
                    type="radio"
                    name="deckType"
                    value="custom"
                    checked={deckType === 'custom'}
                    onChange={() => setDeckType('custom')}
                  />
                  Customizado
                </label>
              </div>
            </fieldset>

            {deckType === 'custom' ? (
              <div className="custom-deck">
                <label htmlFor="customDeck">Valores das cartas</label>
                <textarea
                  id="customDeck"
                  value={customDeck}
                  onChange={(event) => setCustomDeck(event.target.value)}
                  placeholder="Separe por vírgulas ou linhas. Ex: XS, S, M, L, XL"
                  rows={3}
                />
                <div className="preview-row">
                  <span>Pré-visualização:</span>
                  <div className="preview-cards">
                    {customDeckPreview.length > 0
                      ? customDeckPreview.map((value) => (
                          <span key={value}>{value}</span>
                        ))
                      : 'Nenhum valor informado'}
                  </div>
                </div>
              </div>
            ) : null}

            <button type="submit" className="primary" disabled={!hasIdentity}>
              Criar sala
            </button>
            {errors.create ? <p className="form-error">{errors.create}</p> : null}
          </form>
        </div>

        <div className="action-card join-card">
          <h2>Entrar em uma sala existente</h2>
          <form onSubmit={handleJoin} className="action-form">
            <label htmlFor="roomId">ID da sala</label>
            <input
              id="roomId"
              type="text"
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.target.value.toUpperCase())}
              placeholder="Ex: AB12-CD34"
              onFocus={clearError}
            />
            <button type="submit" className="secondary" disabled={!hasIdentity}>
              Entrar
            </button>
            {errors.join ? <p className="form-error">{errors.join}</p> : null}
          </form>
        </div>
      </section>
    </div>
  )
}

export default LandingView
