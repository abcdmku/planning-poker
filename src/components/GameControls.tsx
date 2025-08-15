interface GameControlsProps {
  isHost: boolean
  revealed: boolean
  hasVotes: boolean
  onReveal: () => void
  onReset: () => void
}

export function GameControls({ isHost, revealed, hasVotes, onReveal, onReset }: GameControlsProps) {
  return (
    <div className="flex gap-3 justify-center mt-6">
      {!revealed && (
        <button
          onClick={onReveal}
          disabled={!hasVotes}
          className={`
            px-6 py-3 rounded-lg font-semibold transition-all
            ${hasVotes
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
            }
          `}
        >
          Reveal Cards
        </button>
      )}
      
      {revealed && (
        <button
          onClick={onReset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
        >
          New Round
        </button>
      )}
      
      {!isHost && (
        <div className="text-sm text-gray-400 self-center ml-2">
          (Waiting for any player to {revealed ? 'start new round' : 'reveal'})
        </div>
      )}
    </div>
  )
}