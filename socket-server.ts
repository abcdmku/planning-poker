import { createServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { setupSocketHandlers } from './src/server/socket/handlers'

const httpServer = createServer()

// Create Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/socket.io/'
})

// Setup socket handlers
setupSocketHandlers(io as any)

const port = process.env.SOCKET_PORT || 3002

httpServer.listen(port, () => {
  console.log(`Socket.io server running at http://localhost:${port}`)
})