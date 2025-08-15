interface VotingCardsProps {
  votes: number[]
  selectedVote: number | null
  onVote: (vote: number) => void
}

export function VotingCards({ votes, selectedVote, onVote }: VotingCardsProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Choose Your Estimate</h2>
      <div className="flex flex-wrap gap-3 justify-center">
        {votes.map(value => (
          <button
            key={value}
            onClick={() => onVote(value)}
            className={`
              w-20 h-28 rounded-lg font-bold text-2xl transition-all
              ${selectedVote === value
                ? 'bg-blue-600 text-white scale-105 shadow-lg'
                : 'bg-white/10 hover:bg-white/20 text-gray-200 hover:scale-105'
              }
            `}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}