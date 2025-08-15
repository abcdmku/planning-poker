# Planning Poker - Docker Deployment

## Quick Start with Docker

### Using Docker Compose (Recommended)

1. Build and run the application:
```bash
docker-compose up --build
```

2. Access the application:
   - Frontend: http://localhost:3000
   - Socket Server: http://localhost:3001

3. Stop the application:
```bash
docker-compose down
```

### Using Docker CLI

1. Build the image:
```bash
docker build -t planning-poker .
```

2. Run the container:
```bash
docker run -d \
  --name planning-poker \
  -p 3000:3000 \
  -p 3001:3001 \
  --restart unless-stopped \
  planning-poker
```

3. Stop the container:
```bash
docker stop planning-poker
docker rm planning-poker
```

## Environment Variables

You can customize the ports by setting environment variables:

```bash
docker run -d \
  --name planning-poker \
  -p 8080:3000 \
  -p 8081:3001 \
  -e PORT=3000 \
  -e SOCKET_PORT=3001 \
  --restart unless-stopped \
  planning-poker
```

## Production Deployment

For production deployment, you might want to:

1. Use a reverse proxy (nginx, traefik) to handle SSL
2. Use Docker Swarm or Kubernetes for orchestration
3. Set up proper logging and monitoring
4. Use environment-specific configuration

### Example with Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Health Check

The container includes a health check that monitors the frontend service. You can check the health status:

```bash
docker inspect --format='{{.State.Health.Status}}' planning-poker
```

## Logs

View container logs:
```bash
docker logs planning-poker
```

Follow logs in real-time:
```bash
docker logs -f planning-poker
```

## Updating

To update the application:

1. Pull the latest code
2. Rebuild the image:
```bash
docker-compose build --no-cache
```
3. Restart the services:
```bash
docker-compose up -d
```

## Troubleshooting

### Port Already in Use
If ports 3000 or 3001 are already in use, modify the port mapping in docker-compose.yml:
```yaml
ports:
  - "8080:3000"  # Change 8080 to your desired port
  - "8081:3001"  # Change 8081 to your desired port
```

### Container Won't Start
Check the logs for errors:
```bash
docker logs planning-poker
```

### Can't Connect to Socket Server
Ensure both ports are exposed and the socket client URL is correctly configured for your environment.