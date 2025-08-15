interface ConnectionStatusProps {
  connected: boolean
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className="mt-1 flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${
        connected ? 'bg-green-500' : 'bg-gray-500'
      }`} />
      <span className="text-xs text-gray-400">
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}