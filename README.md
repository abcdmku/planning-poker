# Planning Poker - TanStack Start

A real-time Planning Poker application built with TanStack Start, React, and Socket.io. 

## Features

- ✨ Real-time voting synchronization
- 🚀 Server-side rendering with TanStack Start
- 🎯 TypeScript for type safety
- 🎨 Tailwind CSS v4 for styling
- 🔌 Socket.io for WebSocket communication
- 🎊 Confetti animation on consensus
- 📊 Voting statistics and analytics

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

To run the application in development mode, you need to start both servers:

**Terminal 1 - Socket.io server:**
```bash
npm run dev:socket
```
This will start the Socket.io server on port 3002.

**Terminal 2 - TanStack Start dev server:**
```bash
npm run dev
```

The application will be available at http://localhost:3000

## Building For Production

```bash
npm run build
npm start
```

For the Socket.io server in production:
```bash
npx tsx socket-server.ts
```

## Usage

1. Open http://localhost:3000 in your browser
2. Enter your name (optional)
3. Either:
   - Click "Create New Room" to start a new session
   - Enter a Room ID and click "Join Room" to join an existing session
4. Share the room URL with your team members
5. Vote on items and reveal results together

## Project Structure

```
planning-poker-tanstack/
├── src/
│   ├── components/         # React components
│   ├── lib/               # Utilities and Socket client
│   ├── routes/            # TanStack Start routes
│   │   ├── index.tsx      # Home page
│   │   └── room/
│   │       └── $roomId.tsx # Room page
│   ├── server/            # Server-side code
│   │   └── socket/        # Socket.io handlers
│   └── styles.css         # Global styles
├── socket-server.ts       # Standalone Socket.io server
└── package.json
```




## Key Components

- **PlayerList**: Displays all players in the room
- **VotingCards**: Interface for selecting estimates
- **GameControls**: Reveal/Reset buttons for game management
- **Statistics**: Shows voting results and consensus
- **ConnectionStatus**: Indicates socket connection state

## Environment Variables

You can configure the following environment variables:

- `PORT`: Port for the TanStack Start server (default: 3000)
- `SOCKET_PORT`: Port for the Socket.io server (default: 3002)

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000 3001
CMD ["sh", "-c", "npm start & npx tsx socket-server.ts"]
```

Build and run:
```bash
docker build -t planning-poker .
docker run -p 3000:3000 -p 3001:3001 planning-poker
```

## Migration Notes

This is a migration from a Vite + React + Socket.io application to TanStack Start. Key changes include:

- File-based routing instead of hash-based routing
- Server-side rendering capabilities
- TypeScript throughout the codebase
- Improved code organization and component structure

## Known Issues

- Room state is stored in memory and will be lost on server restart
- No persistent storage for rooms or voting history

## Future Enhancements

- [ ] Add database persistence (PostgreSQL/Redis)
- [ ] Implement user authentication
- [ ] Add room history and analytics
- [ ] Support custom voting scales
- [ ] Add export functionality for results
- [ ] Implement room expiration/cleanup

---

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
npm install @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

## License

MIT
