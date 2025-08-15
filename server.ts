import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import { setupSocketHandlers } from './src/server/socket/handlers'
import type { ClientToServerEvents, ServerToClientEvents } from './src/lib/socket.types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

// Setup Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
})

// Setup socket handlers
setupSocketHandlers(io)

// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist')
  app.use(express.static(distPath))
  
  // Handle client-side routing - serve index.html for all non-static routes
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Start server
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    console.log(`Serving static files from ${path.join(__dirname, 'dist')}`)
  }
  console.log(`Socket.io ready for connections`)
})