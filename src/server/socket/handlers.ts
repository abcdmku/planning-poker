import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, RoomState } from '../../lib/socket.types'

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

// Store room data in memory
const rooms: Record<string, RoomState> = {}

// Store mapping of socket ID to player info for cleanup
const socketToPlayer: Record<string, { roomId: string; playerId: string }> = {}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log('User connected:', socket.id)
    
    // Join room
    socket.on('join-room', (data) => {
      const { roomId, player } = data
      
      // Clean up any previous room association for this socket
      if (socketToPlayer[socket.id]) {
        const prev = socketToPlayer[socket.id]
        if (rooms[prev.roomId] && rooms[prev.roomId].players[prev.playerId]) {
          delete rooms[prev.roomId].players[prev.playerId]
          socket.to(prev.roomId).emit('player-left', { playerId: prev.playerId })
          socket.leave(prev.roomId)
        }
      }
      
      // Store socket to player mapping
      socketToPlayer[socket.id] = { roomId, playerId: player.id }
      
      // Join socket room
      socket.join(roomId)
      
      // Initialize room if it doesn't exist
      if (!rooms[roomId]) {
        rooms[roomId] = {
          players: {},
          revealed: false,
          host: player.id
        }
      }
      
      // Check if player already exists (reconnection)
      const existingPlayer = Object.values(rooms[roomId].players).find(
        p => p.id === player.id && p.socketId !== socket.id
      )
      
      if (existingPlayer) {
        // Remove old socket entry
        console.log(`Player ${player.name} reconnecting, removing old connection`)
        const oldSocketId = existingPlayer.socketId
        if (oldSocketId && socketToPlayer[oldSocketId]) {
          delete socketToPlayer[oldSocketId]
        }
      }
      
      // Add/update player in room
      rooms[roomId].players[player.id] = {
        id: player.id,
        name: player.name,
        vote: existingPlayer?.vote || null,
        socketId: socket.id,
        isSpectator: player.isSpectator || false
      }
      
      console.log(`Player ${player.name} (${player.id}) joined room ${roomId}`)
      
      // Send current room state to the joining player
      // Hide other players' votes if not revealed
      const playersState = { ...rooms[roomId].players }
      if (!rooms[roomId].revealed) {
        Object.keys(playersState).forEach(id => {
          if (id !== player.id && playersState[id].vote !== null) {
            playersState[id] = {
              ...playersState[id],
              vote: -1  // Hide actual vote value
            }
          }
        })
      }
      
      socket.emit('room-state', {
        players: playersState,
        revealed: rooms[roomId].revealed,
        host: rooms[roomId].host
      })
      
      // Notify others in room about new player
      socket.to(roomId).emit('player-joined', {
        player: rooms[roomId].players[player.id]
      })
    })
    
    // Handle vote
    socket.on('vote', (data) => {
      const { vote } = data
      const playerInfo = socketToPlayer[socket.id]
      
      if (!playerInfo) return
      const { roomId, playerId } = playerInfo
      
      if (rooms[roomId] && rooms[roomId].players[playerId]) {
        // Don't allow spectators to vote
        if (rooms[roomId].players[playerId].isSpectator) {
          return
        }
        
        rooms[roomId].players[playerId].vote = vote
        
        // Only broadcast that the player voted, not the actual value
        // Send actual vote value only to the player who voted
        socket.emit('vote-updated', {
          playerId: playerId,
          vote: vote
        })
        
        // For others, just indicate that the player has voted (or cleared their vote)
        socket.to(roomId).emit('vote-updated', {
          playerId: playerId,
          vote: vote !== null ? -1 : null  // -1 means "has voted but hidden"
        })
      }
    })
    
    // Handle reveal
    socket.on('reveal', () => {
      const playerInfo = socketToPlayer[socket.id]
      if (!playerInfo) return
      const { roomId } = playerInfo
      
      if (rooms[roomId]) {
        rooms[roomId].revealed = true
        // Send timestamp so all clients show the same random message
        io.to(roomId).emit('cards-revealed', { timestamp: Date.now() })
        
        // Now send all the actual vote values to everyone
        Object.keys(rooms[roomId].players).forEach(playerId => {
          const player = rooms[roomId].players[playerId]
          if (player.vote !== null) {
            io.to(roomId).emit('vote-updated', {
              playerId: playerId,
              vote: player.vote
            })
          }
        })
      }
    })
    
    // Handle reset
    socket.on('reset', () => {
      const playerInfo = socketToPlayer[socket.id]
      if (!playerInfo) return
      const { roomId } = playerInfo
      
      if (rooms[roomId]) {
        const room = rooms[roomId]
        room.revealed = false
        // Reset all votes
        Object.keys(room.players).forEach(id => {
          room.players[id].vote = null
        })
        io.to(roomId).emit('game-reset')
      }
    })
    
    // Handle name update
    socket.on('update-name', (data) => {
      const { name } = data
      const playerInfo = socketToPlayer[socket.id]
      if (!playerInfo) return
      const { roomId, playerId } = playerInfo
      
      if (rooms[roomId] && rooms[roomId].players[playerId]) {
        rooms[roomId].players[playerId].name = name
        
        // Broadcast name update to room
        io.to(roomId).emit('player-updated', {
          playerId: playerId,
          name
        })
      }
    })
    
    // Handle spectator toggle
    socket.on('toggle-spectator', (data) => {
      const { isSpectator } = data
      const playerInfo = socketToPlayer[socket.id]
      if (!playerInfo) return
      const { roomId, playerId } = playerInfo
      
      if (rooms[roomId] && rooms[roomId].players[playerId]) {
        rooms[roomId].players[playerId].isSpectator = isSpectator
        // Clear vote if becoming spectator
        if (isSpectator) {
          rooms[roomId].players[playerId].vote = null
        }
        
        // Broadcast spectator toggle to room
        io.to(roomId).emit('spectator-toggled', {
          playerId: playerId,
          isSpectator
        })
      }
    })
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
      
      const playerInfo = socketToPlayer[socket.id]
      if (!playerInfo) return
      
      const { roomId, playerId } = playerInfo
      
      if (rooms[roomId] && rooms[roomId].players[playerId]) {
        // Only remove if this socket still owns the player
        // (player might have reconnected from another tab)
        if (rooms[roomId].players[playerId].socketId === socket.id) {
          console.log(`Removing player ${playerId} from room ${roomId}`)
          
          // Remove player from room
          delete rooms[roomId].players[playerId]
          
          // Notify others in room
          socket.to(roomId).emit('player-left', {
            playerId
          })
          
          // If room is empty, delete it
          if (Object.keys(rooms[roomId].players).length === 0) {
            console.log(`Room ${roomId} is empty, deleting`)
            delete rooms[roomId]
          } else {
            // If host left, assign new host
            if (rooms[roomId].host === playerId) {
              const newHost = Object.keys(rooms[roomId].players)[0]
              rooms[roomId].host = newHost
              io.to(roomId).emit('host-changed', {
                hostId: newHost
              })
            }
          }
        }
      }
      
      // Clean up socket mapping
      delete socketToPlayer[socket.id]
    })
  })
}