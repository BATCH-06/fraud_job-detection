# Test suites

All commands are run from the **project root**. The commands marked (server) start the app, run the suite and stop the app using `tests/run-with-server.sh` (Linux, macOS, or Git Bash / WSL on Windows). Otherwise start `npm run dev` yourself in a second terminal and run the `node tests/...` command.

Set these first (they keep the runs predictable):
```
export COMPANY_VERIFY_ONLINE=false RATE_LIMIT_PER_MIN=100000 REGISTER_LIMIT_PER_HOUR=1000
export AUTH_SECRET=test-secret-test-secret-123 ADMIN_EMAIL=admin@test.local ADMIN_PASSWORD=AdminPass123
```

| Suite | Command | Tests |
|---|---|---|
| Unit: rule engine | `npx tsx tests/unit.ts` | 27 |
| Unit: new behaviour, bypass attempts, company verification | `npx tsx tests/unit_new.ts` | 56 |
| API: functional, validation, security, history, database (server) | `rm -f data/scam_detection.db; bash tests/run-with-server.sh node tests/api_tests.mjs` | 60 |
| API: accounts, privacy, admin, company verification, limits (server) | `rm -f data/scam_detection.db; bash tests/run-with-server.sh node tests/api_new_tests.mjs` | 49 |
| Vercel handlers (mock requests) | `npx tsx tests/vercel_tests.ts` | 20 |
| Browser UI / system (needs `npm i -D playwright` and `npx playwright install chromium`) (server) | `rm -f data/scam_detection.db; bash tests/run-with-server.sh node tests/ui_tests.mjs` | 44 |
| Performance (server) | `bash tests/run-with-server.sh node tests/perf_tests.mjs` | 2 |
| Rate limit (server) | `RATE_LIMIT_PER_MIN=5 REGISTER_LIMIT_PER_HOUR=3 bash tests/run-with-server.sh node tests/ratelimit_tests.mjs` | 2 |
| Production mode (server; run `npm run build` first) | `SERVER_ARGS="--prod" bash tests/run-with-server.sh node tests/prodcheck_tests.mjs` | 7 |
| Restart persistence (two separate servers) | `bash tests/run-with-server.sh node tests/persist_tests.mjs 1` then `bash tests/run-with-server.sh node tests/persist_tests.mjs 2` | 1 |
| AI service failure (fake key) | `FAKE_KEY=x ...` see script header, or set `GEMINI_API_KEY=fake` and run `node tests/ai_fallback_tests.mjs` against a running server | 1 |

Results are written to `tests/results/` and browser screenshots to `tests/evidence/`.

Not covered by the automatic tests (manual steps are in the testing report): the real Gemini AI, the deployed Vercel site, a real non-existent domain on a working network, and other browsers.
