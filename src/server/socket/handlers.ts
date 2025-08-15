import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, RoomState } from '../../lib/socket.types'

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

// Store room data in memory
const rooms: Record<string, RoomState> = {}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log('User connected:', socket.id)
    
    let currentRoom: string | null = null
    let playerId: string | null = null
    
    // Join room
    socket.on('join-room', (data) => {
      const { roomId, player } = data
      currentRoom = roomId
      playerId = player.id
      
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
      
      // Add player to room
      rooms[roomId].players[player.id] = {
        id: player.id,
        name: player.name,
        vote: null,
        socketId: socket.id
      }
      
      console.log(`Player ${player.name} (${player.id}) joined room ${roomId}`)
      
      // Send current room state to the joining player
      socket.emit('room-state', {
        players: rooms[roomId].players,
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
      
      if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[playerId!]) {
        rooms[currentRoom].players[playerId!].vote = vote
        
        // Broadcast vote update to room
        io.to(currentRoom).emit('vote-updated', {
          playerId: playerId!,
          vote
        })
      }
    })
    
    // Handle reveal
    socket.on('reveal', () => {
      if (currentRoom && rooms[currentRoom]) {
        rooms[currentRoom].revealed = true
        io.to(currentRoom).emit('cards-revealed')
      }
    })
    
    // Handle reset
    socket.on('reset', () => {
      if (currentRoom && rooms[currentRoom]) {
        const room = rooms[currentRoom]
        room.revealed = false
        // Reset all votes
        Object.keys(room.players).forEach(id => {
          room.players[id].vote = null
        })
        io.to(currentRoom).emit('game-reset')
      }
    })
    
    // Handle name update
    socket.on('update-name', (data) => {
      const { name } = data
      
      if (currentRoom && playerId && rooms[currentRoom] && rooms[currentRoom].players[playerId]) {
        rooms[currentRoom].players[playerId].name = name
        
        // Broadcast name update to room
        io.to(currentRoom).emit('player-updated', {
          playerId: playerId,
          name
        })
      }
    })
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
      
      if (currentRoom && playerId && rooms[currentRoom]) {
        // Remove player from room
        delete rooms[currentRoom].players[playerId]
        
        // Notify others in room
        socket.to(currentRoom).emit('player-left', {
          playerId
        })
        
        // If room is empty, delete it
        if (Object.keys(rooms[currentRoom].players).length === 0) {
          delete rooms[currentRoom]
        } else {
          // If host left, assign new host
          if (rooms[currentRoom].host === playerId) {
            const newHost = Object.keys(rooms[currentRoom].players)[0]
            rooms[currentRoom].host = newHost
            io.to(currentRoom).emit('host-changed', {
              hostId: newHost
            })
          }
        }
      }
    })
  })
}