#!/bin/bash
# Zemichat E2E Full Test Runner
# Usage: ./scripts/run-full-tests.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "========================================"
echo "  Zemichat E2E Test Suite"
echo "========================================"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "[!] Dev server not running on port 5173"
  echo "    Starting dev server in background..."
  npm run dev &
  DEV_PID=$!
  echo "    Waiting for server to start..."
  npx wait-on http://localhost:5173 --timeout 30000 2>/dev/null || {
    sleep 10
  }
  echo "    Dev server started (PID: $DEV_PID)"
else
  echo "[OK] Dev server already running on port 5173"
  DEV_PID=""
fi

# Check if Supabase is running
if ! curl -s http://127.0.0.1:54321 > /dev/null 2>&1; then
  echo "[!] Supabase not running on port 54321"
  echo "    Please start Supabase first: supabase start"
  exit 1
else
  echo "[OK] Supabase running on port 54321"
fi

echo ""
echo "--- Running E2E tests ---"
echo ""

# Clean previous auth states
rm -f tests/e2e/.auth/owner.json
rm -f tests/e2e/.auth/new-owner.json
rm -f tests/e2e/.auth/texter.json
rm -f tests/e2e/.auth/super.json
rm -f tests/e2e/.auth/seed-data.json

# Run all tests with JSON reporter for report generation
npx playwright test --reporter=list,json 2>&1 | tee test-results/e2e-output.txt

TEST_EXIT=$?

echo ""
echo "--- Generating test report ---"
echo ""

# Generate report if results exist
if [ -f test-results/results.json ]; then
  node scripts/generate-test-report.js
fi

# Cleanup dev server if we started it
if [ -n "$DEV_PID" ]; then
  echo "Stopping dev server (PID: $DEV_PID)..."
  kill $DEV_PID 2>/dev/null || true
fi

echo ""
echo "========================================"
if [ $TEST_EXIT -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED (exit code: $TEST_EXIT)"
fi
echo "========================================"

exit $TEST_EXIT
