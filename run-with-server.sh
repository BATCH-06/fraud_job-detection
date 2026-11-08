#!/bin/bash
# Starts the app, runs one test command, then stops the app.
#   Run from the project root:   bash tests/run-with-server.sh node tests/api_tests.mjs
# Use SERVER_ARGS="--prod" for production mode (run "npm run build" first).
# Recommended settings for the test runs (set them before calling this script):
#   export COMPANY_VERIFY_ONLINE=false RATE_LIMIT_PER_MIN=100000 REGISTER_LIMIT_PER_HOUR=1000
#   export AUTH_SECRET=test-secret-test-secret-123 ADMIN_EMAIL=admin@test.local ADMIN_PASSWORD=AdminPass123
mkdir -p tests/results tests/evidence
npx tsx server.ts $SERVER_ARGS > tests/results/server.log 2>&1 &
SPID=$!
for i in $(seq 1 60); do
  curl -s -o /dev/null --max-time 1 http://localhost:3000/api/system-status && break
  sleep 0.5
done
if ! grep -q "Server running" tests/results/server.log; then echo "The server did not start. See tests/results/server.log"; kill $SPID 2>/dev/null; exit 98; fi
"$@"
RC=$?
pkill -P $SPID 2>/dev/null
kill $SPID 2>/dev/null
exit $RC
