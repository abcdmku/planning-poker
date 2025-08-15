import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSocket } from '../../lib/socket.client'
import confetti from 'canvas-confetti'
import type { RoomState, Player } from '../../lib/socket.types'

export const Route = createFileRoute('/room/$roomId')({
  component: RoomPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      name: search.name as string | undefined,
    }
  },
})

const VOTES = [1, 2, 3, 5, 8, 13, 21]
const randId = (n = 6) => Math.random().toString(36).slice(2, 2 + n)

function RoomPage() {
  const { roomId } = Route.useParams()
  const { name: initialName } = Route.useSearch()
  const socket = useSocket()
  
  // Local user
  const localId = useRef(randId(6))
  const [name, setName] = useState(initialName || '')
  const [isHost, setIsHost] = useState(false)
  
  // Game state
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [revealed, setRevealed] = useState(false)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [recentlyUpdated, setRecentlyUpdated] = useState(new Set<string>())
  const [connected, setConnected] = useState(false)
  const hasTriggeredConfetti = useRef(false)

  // Debug console - Define early to avoid circular dependency
  const [showDebug, setShowDebug] = useState(false)
  const [showDebugButton, setShowDebugButton] = useState(false)
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; event: string; data?: any }>>([])
  const debugLogRef = useRef<HTMLDivElement>(null)
  
  const addDebugLog = useCallback((event: string, data?: any) => {
    const time = new Date().toLocaleTimeString()
    setDebugLogs(prev => [...prev.slice(-100), { time, event, data }]) // Keep last 100 logs
  }, [])

  // Auto-scroll debug console to bottom
  useEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight
    }
  }, [debugLogs])

  // Show debug button when mouse is near bottom-right corner
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const threshold = 80 // pixels from corner (reduced from 150)
      const nearCorner = 
        e.clientX > window.innerWidth - threshold && 
        e.clientY > window.innerHeight - threshold
      setShowDebugButton(nearCorner || showDebug)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [showDebug])

  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#bb0000', '#ffffff', '#00bb00', '#0000bb', '#bbbb00']
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#bb0000', '#ffffff', '#00bb00', '#0000bb', '#bbbb00']
      })
    }, 250)
  }

  // Connect to Socket.io server
  useEffect(() => {
    if (!socket) return

    setConnected(socket.connected)
    
    // Join room
    if (socket.connected) {
      socket.emit('join-room', {
        roomId,
        player: {
          id: localId.current,
          name: name || `Player-${localId.current.slice(0, 4)}`,
          vote: null
        }
      })
    }

    const handleConnect = () => {
      setConnected(true)
      addDebugLog('[CONNECT] Connected to server')
      const joinData = {
        roomId,
        player: {
          id: localId.current,
          name: name || `Player-${localId.current.slice(0, 4)}`,
          vote: null
        }
      }
      socket.emit('join-room', joinData)
      addDebugLog('[EMIT] join-room', joinData)
    }

    const handleDisconnect = () => {
      setConnected(false)
      addDebugLog('[DISCONNECT] Disconnected from server')
    }

    const handleRoomState = (data: RoomState) => {
      setPlayers(data.players)
      setRevealed(data.revealed)
      setIsHost(data.host === localId.current)
      addDebugLog('[RECEIVE] Room state', { playerCount: Object.keys(data.players).length, revealed: data.revealed, isHost: data.host === localId.current })
      
      if (data.players[localId.current]?.vote) {
        setMyVote(data.players[localId.current].vote)
      }
    }

    const handlePlayerJoined = (data: { player: Player }) => {
      setPlayers(prev => ({
        ...prev,
        [data.player.id]: data.player
      }))
      addDebugLog('[PLAYER] Joined', { name: data.player.name, id: data.player.id })
    }

    const handlePlayerLeft = (data: { playerId: string }) => {
      setPlayers(prev => {
        const updated = { ...prev }
        delete updated[data.playerId]
        return updated
      })
      addDebugLog('[PLAYER] Left', { playerId: data.playerId })
    }

    const handleVoteUpdated = (data: { playerId: string; vote: number | null }) => {
      setPlayers(prev => ({
        ...prev,
        [data.playerId]: {
          ...prev[data.playerId],
          vote: data.vote
        }
      }))
      
      if (data.playerId === localId.current) {
        setMyVote(data.vote)
      }
      
      addDebugLog('[VOTE] Updated', { playerId: data.playerId.slice(0, 8), vote: data.vote, isMe: data.playerId === localId.current })
      
      setRecentlyUpdated(prev => {
        const newSet = new Set([...prev, data.playerId])
        return newSet
      })
      
      setTimeout(() => {
        setRecentlyUpdated(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.playerId)
          return newSet
        })
      }, 300)
    }

    const handlePlayerUpdated = (data: { playerId: string; name: string }) => {
      setPlayers(prev => ({
        ...prev,
        [data.playerId]: {
          ...prev[data.playerId],
          name: data.name
        }
      }))
      addDebugLog('[PLAYER] Name updated', { playerId: data.playerId.slice(0, 8), name: data.name })
    }

    const handleCardsRevealed = () => {
      setRevealed(true)
      hasTriggeredConfetti.current = false
      addDebugLog('[GAME] Cards revealed')
    }

    const handleGameReset = () => {
      setRevealed(false)
      setMyVote(null)
      hasTriggeredConfetti.current = false
      setRecentlyUpdated(new Set())
      setPlayers(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(id => {
          updated[id].vote = null
        })
        return updated
      })
      addDebugLog('[GAME] Reset')
    }

    const handleHostChanged = (data: { hostId: string }) => {
      setIsHost(data.hostId === localId.current)
      addDebugLog('[HOST] Changed', { newHostId: data.hostId.slice(0, 8), isMe: data.hostId === localId.current })
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('room-state', handleRoomState)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('player-left', handlePlayerLeft)
    socket.on('vote-updated', handleVoteUpdated)
    socket.on('player-updated', handlePlayerUpdated)
    socket.on('cards-revealed', handleCardsRevealed)
    socket.on('game-reset', handleGameReset)
    socket.on('host-changed', handleHostChanged)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room-state', handleRoomState)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('player-left', handlePlayerLeft)
      socket.off('vote-updated', handleVoteUpdated)
      socket.off('player-updated', handlePlayerUpdated)
      socket.off('cards-revealed', handleCardsRevealed)
      socket.off('game-reset', handleGameReset)
      socket.off('host-changed', handleHostChanged)
    }
  }, [socket, roomId, name, addDebugLog])

  // Update name
  const updateName = useCallback((newName: string) => {
    setName(newName)
    if (socket && connected) {
      socket.emit('update-name', { name: newName })
      addDebugLog('[EMIT] update-name', { name: newName })
    }
  }, [socket, connected, addDebugLog])

  // Vote
  const vote = useCallback((value: number) => {
    if (!socket || !connected) return
    
    const newVote = myVote === value ? null : value
    setMyVote(newVote)
    socket.emit('vote', { vote: newVote })
    addDebugLog('[EMIT] vote', { vote: newVote, action: newVote === null ? 'unvote' : 'vote' })
  }, [socket, connected, myVote, addDebugLog])

  // Reveal cards
  const reveal = useCallback(() => {
    if (!socket || !connected) return
    socket.emit('reveal')
    addDebugLog('[EMIT] reveal')
  }, [socket, connected, addDebugLog])

  // Reset game
  const reset = useCallback(() => {
    if (!socket || !connected) return
    socket.emit('reset')
    addDebugLog('[EMIT] reset')
  }, [socket, connected, addDebugLog])

  // Copy invite link
  const copyInviteLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
  }, [])

  // Copy room ID
  const [copiedRoomId, setCopiedRoomId] = useState(false)
  const [hoveringRoomId, setHoveringRoomId] = useState(false)
  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedRoomId(true)
    setTimeout(() => setCopiedRoomId(false), 2000)
  }, [])

  // Calculate statistics
  const stats = (() => {
    if (!revealed) return null
    
    const votes = Object.values(players)
      .map(p => p.vote)
      .filter((v): v is number => v !== null)
    
    if (votes.length === 0) return null
    
    const average = votes.reduce((a, b) => a + b, 0) / votes.length
    const sorted = [...votes].sort((a, b) => a - b)
    const consensus = new Set(votes).size === 1 && votes.length > 1
    
    return {
      average: average.toFixed(1),
      lowest: sorted[0],
      highest: sorted[sorted.length - 1],
      consensus
    }
  })()

  // Trigger confetti when consensus is reached
  useEffect(() => {
    if (stats && stats.consensus && revealed && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true
      setTimeout(() => {
        triggerConfetti()
      }, 500)
    }
  }, [stats, revealed])

  const playerList = Object.values(players).sort((a, b) => 
    (a.name || '').localeCompare(b.name || '')
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 p-6 shadow-2xl">
          <header className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Planning Poker</h1>
              <p className="mt-1 text-sm text-gray-300/80">
                Estimate together in real-time
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-300/70">Room</div>
              <button
                onClick={copyRoomId}
                onMouseEnter={() => setHoveringRoomId(true)}
                onMouseLeave={() => setHoveringRoomId(false)}
                className="font-mono text-sm hover:text-blue-400 transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                title="Click to copy room URL"
              >
                {roomId}
                {copiedRoomId ? (
                  <span className="text-green-400">✓</span>
                ) : hoveringRoomId ? (
                  <span className="text-gray-400">📋</span>
                ) : null}
              </button>
              <div className="mt-1">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                  connected ? 'bg-green-500' : 'bg-gray-500'
                }`}></span>
                <span className="text-xs text-gray-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <section className="md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <input
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex-1"
                  value={name}
                  onChange={(e) => updateName(e.target.value)}
                  placeholder="Enter your name"
                />
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  📋 Copy Invite Link
                </button>
              </div>

              <div className="rounded-xl bg-black/30 p-4">
                <div className="text-sm text-gray-300/80 mb-3">Players ({playerList.length})</div>
                <div className="grid gap-2 mb-4">
                  {playerList.map(p => (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        recentlyUpdated.has(p.id) 
                          ? 'vote-shimmer' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">
                          {p.name}
                          {p.id === localId.current && ' (You)'}
                          {isHost && p.id === localId.current && ' 👑'}
                        </div>
                        <div className="text-xs text-gray-400">{p.id.slice(0, 8)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {revealed ? (
                            <span className={p.vote ? 'text-blue-400' : 'text-gray-500'}>
                              {p.vote ?? '—'}
                            </span>
                          ) : (
                            p.vote ? '✓' : '—'
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {playerList.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-4">
                      Waiting for players to join...
                    </div>
                  )}
                </div>

                {stats && (
                  <div className="border-t border-white/10 pt-3 mb-4">
                    {stats.consensus && (
                      <div className="text-center mb-3 py-2 px-4 bg-green-500/20 rounded-lg border border-green-500/30">
                        <div className="text-green-400 font-bold text-lg">🎉 Consensus Reached! 🎉</div>
                        <div className="text-sm text-gray-300">The team agrees on {stats.lowest} points!</div>
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-xs text-gray-400">Average</div>
                        <div className="text-lg font-bold text-blue-400">{stats.average}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Lowest</div>
                        <div className="text-lg font-bold text-green-400">{stats.lowest}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Highest</div>
                        <div className="text-lg font-bold text-orange-400">{stats.highest}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Consensus</div>
                        <div className="text-lg font-bold">
                          {stats.consensus ? (
                            <span className="text-green-400 animate-pulse">✅</span>
                          ) : (
                            <span className="text-gray-400">❌</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-300/80 mb-3">Your Vote</div>
                  <div className="flex gap-3 flex-wrap">
                    {VOTES.map(v => (
                      <button
                        key={v}
                        onClick={() => vote(v)}
                        disabled={!connected}
                        className={`px-5 py-3 rounded-lg font-bold text-xl transition-all ${
                          myVote === v
                            ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-500/50'
                            : 'bg-white/10 hover:bg-white/20'
                        } ${!connected && 'opacity-50 cursor-not-allowed'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl bg-black/30 p-4">
                <h3 className="font-semibold mb-3">Game Controls</h3>
                {!revealed ? (
                  <button
                    onClick={reveal}
                    disabled={!Object.values(players).some(p => p.vote)}
                    className={`w-full px-4 py-3 rounded-lg font-semibold transition-all ${
                      Object.values(players).some(p => p.vote)
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Reveal Cards
                  </button>
                ) : (
                  <button
                    onClick={reset}
                    className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
                  >
                    New Round
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-black/30 p-4">
                <h3 className="font-semibold mb-3">How to Play</h3>
                <ol className="text-sm text-gray-300 space-y-2">
                  <li>1. Select your estimate</li>
                  <li>2. Wait for all players to vote</li>
                  <li>3. Click "Reveal Cards" to see results</li>
                  <li>4. Discuss and reach consensus</li>
                  <li>5. Start a new round</li>
                </ol>
              </div>

              <div className="rounded-xl bg-black/30 p-4">
                <h3 className="font-semibold mb-3">Fibonacci Scale</h3>
                <p className="text-sm text-gray-300">
                  Points represent complexity, not time. Higher numbers = more complex.
                </p>
              </div>
            </aside>
          </main>
        </div>
      </div>

      {/* Debug Console */}
      <div className="fixed bottom-4 right-4 z-50">
        {/* Toggle Button - Only visible when mouse is near corner or debug is open */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`absolute bottom-0 right-0 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex items-center justify-center shadow-lg transition-all duration-300 cursor-pointer ${
            showDebugButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          title={showDebug ? "Hide debug console" : "Show debug console"}
        >
            {showDebug ? (
              // Close icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Terminal/Debug icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
        </button>

        {/* Debug Console Panel */}
        {showDebug && (
          <div className="absolute bottom-14 right-0 w-96 h-80 bg-black/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300">Debug Console</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {debugLogs.length} events
                </span>
                <button
                  onClick={() => setDebugLogs([])}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Logs */}
            <div 
              ref={debugLogRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono"
            >
              {debugLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No events yet...</div>
              ) : (
                debugLogs.map((log, index) => {
                  // Color code based on event type
                  let eventColor = 'text-gray-300'
                  if (log.event.includes('[EMIT]')) eventColor = 'text-blue-400'
                  else if (log.event.includes('[RECEIVE]')) eventColor = 'text-green-400'
                  else if (log.event.includes('[CONNECT]')) eventColor = 'text-emerald-400'
                  else if (log.event.includes('[DISCONNECT]')) eventColor = 'text-red-400'
                  else if (log.event.includes('[PLAYER]')) eventColor = 'text-purple-400'
                  else if (log.event.includes('[VOTE]')) eventColor = 'text-yellow-400'
                  else if (log.event.includes('[GAME]')) eventColor = 'text-orange-400'
                  else if (log.event.includes('[HOST]')) eventColor = 'text-pink-400'
                  
                  return (
                    <div key={index} className="text-gray-300">
                      <span className="text-gray-600">[{log.time}]</span>{' '}
                      <span className={eventColor}>{log.event}</span>
                      {log.data && (
                        <div className="ml-4 text-gray-500 text-[10px] mt-0.5 font-mono">
                          {JSON.stringify(log.data, null, 2)}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
              <div className="flex justify-between items-center">
                <span>Room: {roomId}</span>
                <span>ID: {localId.current.slice(0, 8)}</span>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}