interface StatisticsProps {
  stats: {
    average: string
    lowest: number
    highest: number
    consensus: boolean
  }
}

export function Statistics({ stats }: StatisticsProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Results</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-sm text-gray-400">Average</div>
          <div className="text-2xl font-bold">{stats.average}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-sm text-gray-400">Lowest</div>
          <div className="text-2xl font-bold">{stats.lowest}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-sm text-gray-400">Highest</div>
          <div className="text-2xl font-bold">{stats.highest}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-sm text-gray-400">Consensus</div>
          <div className="text-2xl font-bold">
            {stats.consensus ? '✅ Yes!' : '❌ No'}
          </div>
        </div>
      </div>
      {stats.consensus && (
        <div className="mt-4 text-center text-green-400 font-semibold animate-pulse">
          🎉 Perfect consensus achieved! 🎉
        </div>
      )}
    </div>
  )
}