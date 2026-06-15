#!/bin/bash
# Configure Redis in WSL to be accessible from Windows
# This script makes Redis bind to all interfaces (0.0.0.0)

echo "Configuring Redis for WSL Windows access..."

# Find Redis config file
REDIS_CONF=""
if [ -f "/etc/redis/redis.conf" ]; then
    REDIS_CONF="/etc/redis/redis.conf"
elif [ -f "/etc/redis.conf" ]; then
    REDIS_CONF="/etc/redis.conf"
elif [ -f "$HOME/redis.conf" ]; then
    REDIS_CONF="$HOME/redis.conf"
else
    echo "Redis config file not found. Please locate it manually."
    echo "Common locations: /etc/redis/redis.conf or /etc/redis.conf"
    exit 1
fi

echo "Found Redis config at: $REDIS_CONF"

# Check if bind is already set to 0.0.0.0
if grep -q "^bind 0.0.0.0" "$REDIS_CONF"; then
    echo "✓ Redis is already configured to bind to 0.0.0.0"
elif grep -q "^bind 127.0.0.1" "$REDIS_CONF"; then
    echo "Updating bind setting from 127.0.0.1 to 0.0.0.0..."
    sudo sed -i 's/^bind 127.0.0.1/bind 0.0.0.0/' "$REDIS_CONF"
    echo "✓ Updated Redis config"
else
    echo "Adding bind 0.0.0.0 to Redis config..."
    echo "bind 0.0.0.0" | sudo tee -a "$REDIS_CONF" > /dev/null
    echo "✓ Added bind 0.0.0.0 to Redis config"
fi

# Apply the change to running Redis instance
echo "Applying configuration to running Redis..."
redis-cli CONFIG SET bind "0.0.0.0"

echo ""
echo "✓ Redis configuration complete!"
echo "Note: If Redis is managed by systemd, you may need to restart it:"
echo "  sudo systemctl restart redis"
echo ""
echo "To test connection from Windows:"
echo "  python -c \"import redis; r = redis.Redis(host='localhost', port=6379); print(r.ping())\""
