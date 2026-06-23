#!/bin/bash
# Start server in background
pnpm --filter @workspace/server run start > server.log 2>&1 &
SERVER_PID=$!

# Wait for health check
echo "Waiting for server to start..."
curl --silent --retry 30 --retry-delay 2 --retry-connrefused http://localhost:5000/health > /dev/null

# Call the API
RESPONSE=$(curl -i -s "http://localhost:5000/api/theater/stream?id=maltese-falcon")

# Print status and WWW-Authenticate check
echo "$RESPONSE" | grep "HTTP/" | head -n 1
if echo "$RESPONSE" | grep -qi "WWW-Authenticate"; then
    echo "WWW-Authenticate header: Present"
else
    echo "WWW-Authenticate header: Not present"
fi

# Kill the server
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
