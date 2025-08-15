# Planning Poker - CapRover Deployment Guide

## Prerequisites

- CapRover installed and configured
- CapRover CLI installed locally
- Git repository with the code

## Deployment Steps

### 1. Create a New App in CapRover

1. Log into your CapRover dashboard
2. Click "Apps" → "One-Click Apps/Databases"
3. Create a new app (e.g., `planning-poker`)
4. Enable "Has Persistent Data" if you want to preserve logs
5. Enable WebSocket Support (IMPORTANT!)

### 2. Configure App Settings

**CRITICAL: Enable WebSocket Support**

In the CapRover dashboard for your app:

1. Go to "HTTP Settings" tab
2. **Enable "WebSocket Support" ✅** (REQUIRED for Socket.io)
3. Enable "Force HTTPS" for production
4. Save & Update

### 3. Deploy Using CapRover CLI

```bash
# Login to your CapRover instance
caprover login

# Deploy the app
caprover deploy -a planning-poker
```

Or deploy from Git:

```bash
# In CapRover dashboard, go to "Deployment" tab
# Enable "App Push WebHook"
# Add your Git repository URL
# Configure branch (e.g., main or master)
```

### 4. Environment Variables (Optional)

If needed, you can set environment variables in CapRover:

1. Go to "App Configs" tab
2. Add environment variables:
   - `NODE_ENV=production`
   - `SOCKET_PORT=3001` (internal port for socket server)

### 5. Custom Domain (Optional)

To use a custom domain:

1. Go to "HTTP Settings" tab
2. Add your custom domain
3. Enable "Force HTTPS" for production use
4. Update your DNS records to point to your CapRover server

## Architecture on CapRover

The app runs as a **single unified server** that:
- Serves the static frontend files (HTML, JS, CSS)
- Handles Socket.io WebSocket connections
- All through a single port (80/443)

This simplified architecture eliminates the need for complex proxy configurations.

## Verifying Deployment

After deployment:

1. Visit `https://planning-poker.your-caprover-domain.com`
2. Create a room and test the real-time features
3. Open multiple tabs to verify WebSocket connections work

## Troubleshooting

### WebSocket Connection Issues

If WebSocket connections fail:

1. **MOST IMPORTANT: Verify WebSocket Support is enabled** in CapRover HTTP Settings
   - Go to your app → "HTTP Settings" tab
   - Make sure "WebSocket Support" checkbox is ✅ enabled
   - Click "Save & Update"
   
2. If using HTTPS, ensure "Force HTTPS" is enabled

3. Check CapRover logs: `App Logs` tab in dashboard

4. The app will automatically fall back to polling if WebSocket fails

### App Won't Start

Check logs in CapRover dashboard:
- Go to your app → "App Logs" tab
- Look for PM2 or Node.js errors

### Socket.io Connection Errors

If you see "CORS" or connection errors:
1. The app automatically uses the same origin for WebSocket connections in production
2. Make sure you're accessing the app through HTTPS if "Force HTTPS" is enabled

## Updating the App

To update your deployed app:

```bash
# Make your changes locally
git add .
git commit -m "Update message"

# Deploy update
caprover deploy -a planning-poker
```

Or if using Git webhook:
```bash
git push origin main
```

## Monitoring

CapRover provides built-in monitoring:
- **App Logs**: Real-time logs from your application
- **Metrics**: CPU and memory usage
- **Web App Statistics**: Request counts and response times

## Scaling

To scale your app:
1. Go to your app in CapRover
2. "App Configs" tab
3. Increase "Instance Count"
4. Note: Session affinity is required for Socket.io

## Backup

To backup your app:
1. The app is stateless (no database)
2. Room data is stored in memory
3. Consider implementing Redis for persistent room storage if needed

## SSL/HTTPS

CapRover automatically handles SSL certificates with Let's Encrypt:
1. Add your custom domain
2. Enable "Force HTTPS"
3. CapRover will automatically obtain and renew SSL certificates

## Advanced Configuration

For production use, consider:
- Adding Redis for session persistence
- Implementing health checks
- Setting up monitoring alerts
- Configuring auto-restart policies