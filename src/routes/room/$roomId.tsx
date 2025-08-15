import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSocket } from '../../lib/socket.client'
import confetti from 'canvas-confetti'
import type { RoomState, Player } from '../../lib/socket.types'

export const Route = createFileRoute('/room/$roomId')({
  component: RoomPage,
})

const VOTES = [1, 2, 3, 5, 8, 13, 21]
const randId = (n = 6) => Math.random().toString(36).slice(2, 2 + n)

function RoomPage() {
  const { roomId } = Route.useParams()
  const socket = useSocket()
  
  // Local user
  const localId = useRef(randId(6))
  const [name, setName] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [isSpectator, setIsSpectator] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(true)
  
  // Game state
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [revealed, setRevealed] = useState(false)
  const [revealTime, setRevealTime] = useState<number>(0)
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

  // Play losing sound effect using the sadtrombone.mp3 file
  const playLosingSound = () => {
    const audio = new Audio('/sadtrombone.mp3')
    audio.volume = 0.5 // Set volume to 50% to not be too loud
    audio.play().catch(error => {
      console.error('Failed to play sad trombone sound:', error)
    })
  }

  // Join room function
  const joinRoom = useCallback((joinName: string, joinAsSpectator: boolean) => {
    if (!socket || !socket.connected) return
    
    setName(joinName)
    setIsSpectator(joinAsSpectator)
    setHasJoined(true)
    setShowJoinModal(false)
    
    socket.emit('join-room', {
      roomId,
      player: {
        id: localId.current,
        name: joinName,
        vote: null,
        isSpectator: joinAsSpectator
      }
    })
    addDebugLog('[EMIT] join-room', { name: joinName, isSpectator: joinAsSpectator })
  }, [socket, roomId, addDebugLog])

  // Connect to Socket.io server
  useEffect(() => {
    if (!socket) return

    // Check initial connection state
    setConnected(socket.connected)
    
    // If already connected, we can allow joining immediately
    if (socket.connected && !hasJoined) {
      // Socket is already connected, user can join
      console.log('Socket already connected, ready to join')
    }
    
    const handleConnect = () => {
      setConnected(true)
      addDebugLog('[CONNECT] Connected to server')
      // Don't auto-join, wait for user to fill join modal
      if (hasJoined && name) {
        const joinData = {
          roomId,
          player: {
            id: localId.current,
            name: name,
            vote: null,
            isSpectator: isSpectator
          }
        }
        socket.emit('join-room', joinData)
        addDebugLog('[EMIT] join-room', joinData)
      }
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
      
      const myPlayer = data.players[localId.current]
      if (myPlayer) {
        setMyVote(myPlayer.vote)
        setIsSpectator(myPlayer.isSpectator || false)
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
      
      // Only update myVote if it's actually my vote (not the hidden value)
      if (data.playerId === localId.current && data.vote !== -1) {
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

    const handleCardsRevealed = (data: { timestamp: number }) => {
      setRevealed(true)
      setRevealTime(data.timestamp)
      hasTriggeredConfetti.current = false
      addDebugLog('[GAME] Cards revealed', { timestamp: data.timestamp })
    }

    const handleGameReset = () => {
      setRevealed(false)
      setRevealTime(0)
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

    const handleSpectatorToggled = (data: { playerId: string; isSpectator: boolean }) => {
      setPlayers(prev => ({
        ...prev,
        [data.playerId]: {
          ...prev[data.playerId],
          isSpectator: data.isSpectator,
          vote: data.isSpectator ? null : prev[data.playerId].vote
        }
      }))
      
      if (data.playerId === localId.current) {
        setIsSpectator(data.isSpectator)
        if (data.isSpectator) {
          setMyVote(null)
        }
      }
      
      addDebugLog('[SPECTATOR] Toggled', { playerId: data.playerId.slice(0, 8), isSpectator: data.isSpectator, isMe: data.playerId === localId.current })
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
    socket.on('spectator-toggled', handleSpectatorToggled)

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
      socket.off('spectator-toggled', handleSpectatorToggled)
    }
  }, [socket, roomId, hasJoined, name, isSpectator, addDebugLog])

  // Update name
  const updateName = useCallback((newName: string) => {
    setName(newName)
    if (socket && connected) {
      socket.emit('update-name', { name: newName })
      addDebugLog('[EMIT] update-name', { name: newName })
    }
  }, [socket, connected, addDebugLog])

  // Toggle spectator mode
  const toggleSpectator = useCallback(() => {
    if (!socket || !connected) return
    const newSpectatorState = !isSpectator
    socket.emit('toggle-spectator', { isSpectator: newSpectatorState })
    addDebugLog('[EMIT] toggle-spectator', { isSpectator: newSpectatorState })
  }, [socket, connected, isSpectator, addDebugLog])

  // Vote
  const vote = useCallback((value: number) => {
    if (!socket || !connected || isSpectator) return
    
    const newVote = myVote === value ? null : value
    setMyVote(newVote)
    socket.emit('vote', { vote: newVote })
    addDebugLog('[EMIT] vote', { vote: newVote, action: newVote === null ? 'unvote' : 'vote' })
  }, [socket, connected, myVote, isSpectator, addDebugLog])

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
      .filter(p => !p.isSpectator) // Only count votes from players
      .map(p => p.vote)
      .filter((v): v is number => v !== null)
    
    if (votes.length === 0) return null
    
    const average = votes.reduce((a, b) => a + b, 0) / votes.length
    const sorted = [...votes].sort((a, b) => a - b)
    const consensus = new Set(votes).size === 1 && votes.length > 1
    const noConsensus = votes.length >= 4 && new Set(votes).size === votes.length
    
    return {
      average: average.toFixed(1),
      lowest: sorted[0],
      highest: sorted[sorted.length - 1],
      consensus,
      noConsensus,
      uniqueVotes: new Set(votes).size,
      totalVotes: votes.length
    }
  })()

  // Trigger confetti when consensus is reached or losing sound when no consensus
  useEffect(() => {
    if (stats && revealed && !hasTriggeredConfetti.current) {
      if (stats.consensus) {
        hasTriggeredConfetti.current = true
        setTimeout(() => {
          triggerConfetti()
        }, 500)
      } else if (stats.noConsensus) {
        hasTriggeredConfetti.current = true
        setTimeout(() => {
          playLosingSound()
        }, 500)
      }
    }
  }, [stats, revealed])

  const playerList = Object.values(players)
    .filter(p => !p.isSpectator)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  
  const spectatorList = Object.values(players)
    .filter(p => p.isSpectator)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  // Join modal state
  const [joinName, setJoinName] = useState('')
  const [joinAsSpectator, setJoinAsSpectator] = useState(false)
  const [showWatchers, setShowWatchers] = useState(false)

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
                  disabled={!hasJoined}
                />
                <button
                  onClick={toggleSpectator}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isSpectator 
                      ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400' 
                      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                  }`}
                  disabled={!hasJoined}
                  title={isSpectator ? 'Switch to Player mode' : 'Switch to Spectator mode'}
                >
                  {isSpectator ? (
                    <>
                      <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="ml-1">Watching</span>
                    </>
                  ) : (
                    '🎮 Playing'
                  )}
                </button>
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  📋 Copy Link
                </button>
              </div>

              <div className="rounded-xl bg-black/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-300/80">Participants ({playerList.length + spectatorList.length})</div>
                  {spectatorList.length > 0 && (
                    <button
                      onClick={() => setShowWatchers(!showWatchers)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs transition-colors"
                    >
                      <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{spectatorList.length} watching</span>
                      <span className={`transition-transform ${showWatchers ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                  )}
                </div>
                
                <div className="grid gap-2 mb-4">
                  {/* Players */}
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
                              {p.vote === -1 ? '?' : p.vote ?? '—'}
                            </span>
                          ) : (
                            p.vote ? '✓' : '—'
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Spectators */}
                  {spectatorList.map(s => (
                    <div 
                      key={s.id} 
                      className={`flex items-center justify-between rounded-lg p-3 bg-purple-900/20 border border-purple-700/30 ${
                        !showWatchers && 'hidden'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-purple-300">
                          {s.name}
                          {s.id === localId.current && ' (You)'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Watching
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {playerList.length === 0 && spectatorList.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-4">
                      Waiting for participants to join...
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
                    {stats.noConsensus && (
                      <div className="text-center mb-3 py-2 px-4 bg-red-500/20 rounded-lg border border-red-500/30">
                        <div className="text-red-400 font-bold text-lg animate-pulse">😅 Complete Chaos!</div>
                        <div className="text-sm text-gray-300">
                          {(() => {
                            const messages = [
                              "Everyone picked a different number! Time for coffee ☕",
                              "Not even close! Did you read the same ticket? 🤔",
                              "The estimates are as aligned as a broken compass 🧭",
                              "Consensus level: 404 Not Found 💻",
                              "You're all unique snowflakes... too unique! ❄️"
                            ]
                            // Use the reveal timestamp for consistent but changing message selection
                            const messageIndex = revealTime ? Math.floor(revealTime / 1000) % messages.length : 0
                            return messages[messageIndex]
                          })()}
                        </div>
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
                  {!isSpectator && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl bg-black/30 p-4">
                <h3 className="font-semibold mb-3">Game Controls</h3>
                {!revealed ? (
                  <button
                    onClick={reveal}
                    disabled={!Object.values(players).some(p => !p.isSpectator && p.vote)}
                    className={`w-full px-4 py-3 rounded-lg font-semibold transition-all ${
                      Object.values(players).some(p => !p.isSpectator && p.vote)
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
                <h3 className="font-semibold mb-3">Estimation Tips</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Points represent complexity, not time. Higher numbers = more complex.
                </p>
                <div className="text-sm text-gray-300 space-y-3">
                  <div>
                    <div className="font-medium text-gray-200 mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Complexity
                    </div>
                    <p className="text-xs text-gray-400">Consider technical difficulty, number of components affected, and solution clarity.</p>
                  </div>
                  <div>
                    <div className="font-medium text-gray-200 mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Risk & Unknowns
                    </div>
                    <p className="text-xs text-gray-400">Account for unclear requirements, potential bugs, and areas needing investigation.</p>
                  </div>
                  <div>
                    <div className="font-medium text-gray-200 mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Dependencies
                    </div>
                    <p className="text-xs text-gray-400">Factor in external services, team coordination, and blocked work.</p>
                  </div>
                  <div>
                    <div className="font-medium text-gray-200 mb-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Testing & Review
                    </div>
                    <p className="text-xs text-gray-400">Include effort for writing tests, code review, and QA validation.</p>
                  </div>
                </div>
              </div>
            </aside>
          </main>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h2 className="text-2xl font-bold mb-4">Join Planning Poker</h2>
            <p className="text-gray-400 mb-4">Room ID: {roomId}</p>
            
            <div className="bg-black/30 rounded-lg p-3 mb-4">
              <h3 className="font-semibold text-sm mb-2">How to Play</h3>
              <ol className="text-xs text-gray-300 space-y-1">
                <li>1. Select your estimate from the cards</li>
                <li>2. Wait for all players to vote</li>
                <li>3. Click "Reveal Cards" to see results</li>
                <li>4. Discuss and reach consensus</li>
                <li>5. Start a new round</li>
              </ol>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="join-name" className="block text-sm font-medium mb-2">
                  Your Name
                </label>
                <input
                  id="join-name"
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  id="spectator-checkbox"
                  type="checkbox"
                  checked={joinAsSpectator}
                  onChange={(e) => setJoinAsSpectator(e.target.checked)}
                  className="w-4 h-4 bg-white/10 border border-white/20 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="spectator-checkbox" className="text-sm">
                  Join as spectator (watch only, no voting)
                </label>
              </div>
              
              <button
                onClick={() => {
                  if (joinName.trim()) {
                    joinRoom(joinName.trim(), joinAsSpectator)
                  }
                }}
                disabled={!joinName.trim() || !connected}
                className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors ${
                  joinName.trim() && connected
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {joinAsSpectator ? 'Join as Spectator' : 'Join as Player'}
              </button>
              
              {!connected && (
                <p className="text-center text-sm text-yellow-400">
                  Connecting to server...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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