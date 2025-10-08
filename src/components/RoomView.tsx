import { useMemo, useState } from 'react'
import { revealVotes, resetVotes, submitVote, removeParticipant, transferHost } from '../roomStore'
import type { RoomState } from '../roomStore'
import type { SessionProfile } from '../types'

interface RoomViewProps {
  room: RoomState
  session: SessionProfile
  onLeave: () => void
}

export function RoomView({ room, session, onLeave }: RoomViewProps) {
  const [selectedTransferTarget, setSelectedTransferTarget] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const participants = useMemo(() => {
    return Object.values(room.participants).sort((a, b) => a.joinedAt - b.joinedAt)
  }, [room.participants])

  const votes = room.votes
  const myVote = votes[session.id] ?? null
  const isHost = room.hostId === session.id

  const waitingParticipants = participants.filter((participant) => !votes[participant.id])
  const everyoneVoted = waitingParticipants.length === 0

  const voteSummary = useMemo(() => {
    const counts = new Map<string, number>()
    Object.values(votes).forEach((vote) => {
      if (!vote) return
      counts.set(vote, (counts.get(vote) ?? 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [votes])

  const statusMessage = (() => {
    if (room.revealed) {
      return 'Resultados revelados'
    }
    if (everyoneVoted) {
      return 'Todos os votos recebidos. Revele quando quiser!'
    }
    if (waitingParticipants.length === 1) {
      return `Aguardando ${waitingParticipants[0].name}...`
    }
    if (waitingParticipants.length > 1) {
      return `Aguardando ${waitingParticipants.length} pessoas...`
    }
    return 'Escolha sua carta para votar'
  })()

  const deckValues = room.deckValues

  function handleVote(value: string) {
    if (room.revealed) return
    submitVote(room.id, session.id, value)
  }

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(room.id)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2500)
    } catch (error) {
      console.warn('Falha ao copiar ID da sala', error)
    }
  }

  function handleTransferSubmit() {
    if (!selectedTransferTarget) return
    transferHost(room.id, selectedTransferTarget)
    setSelectedTransferTarget('')
  }

  const layoutSeats = participants.map((participant, index) => {
    const angle = (index / participants.length) * 2 * Math.PI - Math.PI / 2
    const radius = 38
    const x = 50 + radius * Math.cos(angle)
    const y = 50 + radius * Math.sin(angle)
    const vote = votes[participant.id]
    const displayVote = room.revealed ? vote ?? '—' : vote ? '•' : ''
    const voteClass = room.revealed ? 'revealed' : vote ? 'hidden' : 'empty'

    return {
      participant,
      style: {
        left: `${x}%`,
        top: `${y}%`,
      } as const,
      displayVote,
      voteClass,
    }
  })

  return (
    <div className="room-screen">
      <header className="room-header">
        <div className="room-info">
          <h1>{room.name}</h1>
          <p>ID da sala: <strong>{room.id}</strong></p>
        </div>
        <div className="room-actions">
          <button type="button" className="secondary" onClick={handleCopyInvite}>
            {copyState === 'copied' ? 'ID copiado!' : 'Copiar ID' }
          </button>
          <button type="button" className="ghost" onClick={onLeave}>
            Sair da sala
          </button>
        </div>
      </header>

      <div className="room-content">
        <aside className="participants-panel">
          <h2>Jogadores</h2>
          <ul>
            {participants.map((participant) => (
              <li key={participant.id} className={participant.id === session.id ? 'me' : ''}>
                <span className="avatar" style={{ backgroundColor: participant.avatarColor }}>
                  {participant.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>
                    {participant.name}
                    {participant.id === session.id ? ' (você)' : ''}
                    {participant.id === room.hostId ? ' ⭐' : ''}
                  </strong>
                  <span className="vote-status">
                    {room.revealed
                      ? votes[participant.id] ?? 'Sem voto'
                      : votes[participant.id]
                        ? 'Carta selecionada'
                        : 'Aguardando voto'}
                  </span>
                </div>
                {isHost && participant.id !== session.id ? (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeParticipant(room.id, participant.id)}
                  >
                    ✕
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {isHost ? (
            <div className="host-tools">
              <h3>Ferramentas do anfitrião</h3>
              <button
                type="button"
                className="primary"
                onClick={() => revealVotes(room.id)}
                disabled={room.revealed || participants.length === 0}
              >
                Revelar cartas
              </button>
              <button type="button" className="secondary" onClick={() => resetVotes(room.id)}>
                Resetar rodada
              </button>
              <div className="transfer-control">
                <label htmlFor="transferHost">Transferir controle</label>
                <div className="transfer-row">
                  <select
                    id="transferHost"
                    value={selectedTransferTarget}
                    onChange={(event) => setSelectedTransferTarget(event.target.value)}
                  >
                    <option value="">Escolha um jogador</option>
                    {participants
                      .filter((participant) => participant.id !== room.hostId)
                      .map((participant) => (
                        <option value={participant.id} key={participant.id}>
                          {participant.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" onClick={handleTransferSubmit} disabled={!selectedTransferTarget}>
                    Transferir
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {room.revealed && voteSummary.length > 0 ? (
            <div className="vote-summary">
              <h3>Distribuição</h3>
              <ul>
                {voteSummary.map(([value, count]) => (
                  <li key={value}>
                    <span>{value}</span>
                    <span>{count} voto(s)</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        <main className="table-area">
          <div className="table-wrapper">
            <div className={`poker-table ${room.revealed ? 'revealed' : ''}`}>
              <div className="table-status">{statusMessage}</div>
              <ul className="seats">
                {layoutSeats.map(({ participant, style, displayVote, voteClass }) => (
                  <li key={participant.id} className={`seat ${voteClass}`} style={style}>
                    <span className="seat-avatar" style={{ backgroundColor: participant.avatarColor }}>
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="seat-name">
                      {participant.name}
                      {participant.id === room.hostId ? ' ⭐' : ''}
                    </span>
                    <span className="seat-card" data-value={displayVote}>
                      {displayVote}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="deck">
            <h3>Escolha sua carta</h3>
            <div className="card-row">
              {deckValues.map((value) => {
                const isSelected = myVote === value
                return (
                  <button
                    key={value}
                    type="button"
                    className={`card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleVote(value)}
                    disabled={room.revealed}
                  >
                    {value}
                  </button>
                )
              })}
              {myVote ? (
                <button type="button" className="ghost" onClick={() => submitVote(room.id, session.id, null)}>
                  Limpar voto
                </button>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default RoomView
