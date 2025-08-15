export interface Player {
  id: string
  name: string
  vote: number | null
  socketId?: string
}

export interface RoomState {
  players: Record<string, Player>
  revealed: boolean
  host: string
}

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string; player: Player }) => void
  'vote': (data: { vote: number | null }) => void
  'reveal': () => void
  'reset': () => void
  'update-name': (data: { name: string }) => void
}

export interface ServerToClientEvents {
  'room-state': (data: RoomState) => void
  'player-joined': (data: { player: Player }) => void
  'player-left': (data: { playerId: string }) => void
  'vote-updated': (data: { playerId: string; vote: number | null }) => void
  'cards-revealed': () => void
  'game-reset': () => void
  'player-updated': (data: { playerId: string; name: string }) => void
  'host-changed': (data: { hostId: string }) => void
}