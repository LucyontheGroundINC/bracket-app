# Bracket Production Status (2026-03-18)

## Current State

- **Branch/Head:** `main` @ `05c9944`
- **Site:** `https://bracket.lucyontheground.com`
- **Bracket generation:** Region-aware seeded generation fixed and deployed.
- **Admin access:** `/dashboard/brackets` bypasses under-construction when admin is detected (`profiles.is_admin` and email fallback).
- **Non-admin behavior:** Redirected to under-construction page.
- **Pick save stability:** Server-side save path hardened (timeout/auth retry), major timeout/auth/RLS issues reduced.

## Latest 1h Telemetry Snapshot

- `total = 1`
- `byType = { unknown: 1 }`
- latest error text: `(404) Match not found`

### Interpretation

- This is typically caused by stale client state or a pick attempt against a match id that no longer exists after bracket regeneration.
- No fresh 401/504 spikes in the latest window.

## Known Good Seed Pairing Order (Round 1, per region)

1. 1 vs 16
2. 8 vs 9
3. 5 vs 12
4. 4 vs 13
5. 6 vs 11
6. 3 vs 14
7. 7 vs 10
8. 2 vs 15

## Operational Checklist

### After teams import/update
1. Confirm each region has exactly 16 teams in admin.
2. Run **Generate Bracket Matches**.
3. Refresh `/dashboard/brackets` and validate Round 1 match orders/seeds visually.
4. Check telemetry endpoint:
   - `/api/admin/pick-save-telemetry?hours=1`

### If users report save failures
1. Check telemetry `latest` and `byType`.
2. If `404 Match not found` appears:
   - confirm no stale tabs are open,
   - force reload bracket page,
   - verify match IDs are current after regeneration.
3. If 401/504 reappear:
   - capture exact timestamp and error text,
   - correlate with deployment and recent API changes.

## Key Routes Touching This Flow

- Match generation: `app/api/matches/generate-from-teams/route.ts`
- Match fetch: `app/api/matches/route.ts`
- Pick save: `app/api/picks/save/route.ts`
- Telemetry ingest: `app/api/telemetry/pick-save-failure/route.ts`
- Telemetry summary: `app/api/admin/pick-save-telemetry/route.ts`
- Auth gate + construction redirect: `components/RequireAuth.tsx`
- Construction page: `app/dashboard/brackets-under-construction/page.tsx`
