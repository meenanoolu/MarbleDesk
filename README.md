# Marble Desk

A seated, hands-first marble-run builder for Meta Quest (WebXR). Pinch on your real desk to place a glass frame, then build paths with ramps, bumpers, and fans. Fully usable with hands only — no controllers required.

Designed for short, satisfying sessions. 5 levels + sandbox.

## Why it fits Meta VR Start Competition
- Hands-first end-to-end (pinch to place frame, pieces, and buttons)
- Seated / desk-optimized (airplane-seat test)
- Purposeful passthrough: the real desk is the play surface
- Fast cold start, complete moment in under 10 minutes
- Original core loop (not a wrapper)

## Run
```
npm install
npm run dev        # desktop preview (mouse)
npm run build      # outputs dist/
node test/solve.mjs 1500   # verifies levels are solvable
```

## Controls (Quest hands)
- First pinch on your desk: place the frame
- Pinch a piece in the right tray → move → release to place
- Pinch a placed piece to move it
- Left buttons: Drop, Reset, Hint, Prev, Next, Move

## Deploy
Push to `main`. GitHub Actions deploys to Pages. Open the HTTPS URL in Quest browser → Enter AR.
