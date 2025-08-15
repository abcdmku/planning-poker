import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from './socket.types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<TypedSocket | null>(null)

  useEffect(() => {
    // Only initialize socket on client
    if (typeof window === 'undefined') return

    // Create a new socket connection for this component instance
    if (!socketRef.current) {
      // Use relative path for production, localhost for development
      const SOCKET_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin  // Use same origin for CapRover (proxied through port 80)
      
      socketRef.current = io(SOCKET_URL, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        // Force new connection for each tab
        forceNew: true,
      }) as TypedSocket

      socketRef.current.on('connect', () => {
        console.log('Socket connected', socketRef.current?.id)
        setConnected(true)
      })

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected')
        setConnected(false)
      })
      
      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message)
      })
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  return socketRef.current
}

// This function is no longer needed with the new architecture
// Each component manages its own socket lifecycle