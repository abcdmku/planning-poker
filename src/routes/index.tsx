import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()

  const createRoom = () => {
    const roomId = Math.random().toString(36).slice(2, 10)
    navigate({
      to: '/room/$roomId',
      params: { roomId }
    })
  }

  const joinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const roomId = formData.get('roomId') as string
    if (roomId) {
      navigate({
        to: '/room/$roomId',
        params: { roomId }
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 p-8 shadow-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Planning Poker</h1>
          <p className="text-gray-300/80 mb-8">Estimate together in real-time</p>
          
          <div className="space-y-4">
              <button
                onClick={createRoom}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Create New Room
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-400">or</span>
                </div>
              </div>
              
              <form onSubmit={joinRoom} className="space-y-3">
                <input
                  name="roomId"
                  type="text"
                  placeholder="Enter Room ID"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                />
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Join Room
                </button>
              </form>
          </div>
        </div>
      </div>
    </div>
  )
}
