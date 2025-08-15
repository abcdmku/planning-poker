import type { Player } from '../lib/socket.types'

interface PlayerListProps {
  players: Player[]
  localId: string
  revealed: boolean
  recentlyUpdated: Set<string>
}

export function PlayerList({ players, localId, revealed, recentlyUpdated }: PlayerListProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {players.map(player => {
          const isMe = player.id === localId
          const hasVoted = player.vote !== null
          const isHighlighted = recentlyUpdated.has(player.id)
          
          return (
            <div
              key={player.id}
              className={`
                relative px-4 py-3 rounded-lg border transition-all duration-300
                ${isMe ? 'bg-blue-900/20 border-blue-500/30' : 'bg-white/5 border-white/10'}
                ${isHighlighted ? 'animate-pulse ring-2 ring-blue-500/50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isMe ? 'font-semibold' : ''}`}>
                  {player.name || `Player-${player.id.slice(0, 4)}`}
                  {isMe && ' (You)'}
                </span>
                {!revealed && hasVoted && (
                  <span className="text-xs text-green-400">✓</span>
                )}
                {revealed && hasVoted && (
                  <span className="text-lg font-bold text-blue-400">
                    {player.vote}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}