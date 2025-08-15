import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from './socket.types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export function useSocket() {
  const [, setConnected] = useState(false)

  useEffect(() => {
    // Only initialize socket on client
    if (typeof window === 'undefined') return

    if (!socket) {
      // Use relative path for production, localhost for development
      const SOCKET_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3002' 
        : ''
      
      socket = io(SOCKET_URL, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }) as TypedSocket

      socket.on('connect', () => {
        setConnected(true)
      })

      socket.on('disconnect', () => {
        setConnected(false)
      })
    }

    return () => {
      // Don't disconnect on component unmount, keep the connection alive
    }
  }, [])

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}