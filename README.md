# Marble Desk

A seated, hands-only marble-run builder for Meta Quest (WebXR).

A glass frame appears on your real desk (you pinch where you want it). Pinch pieces from the tray, place them, press Drop, and guide the marble into the glowing cup. 8 levels plus a sandbox.

## Features
- Hands-first end-to-end: place the frame, grab pieces, press buttons, all with pinches
- Real desk as the play surface via passthrough and hit-testing
- Ramps, bumpers, and fans with physics
- 8 hand-crafted levels + free sandbox
- Share codes to send your layouts to others
- Progress and best times saved locally
- High-contrast mode

## Run
```bash
npm install
npm run dev        # desktop preview (mouse), http://localhost:5173
npm run build      # outputs dist/
node test/solve.mjs 1500   # proves every level is solvable (random search)
```

## Controls (Quest hands)
- First pinch: place the diorama on your desk
- Pinch a piece in the right tray, move, release to place. Pinch a placed piece to move it
- Left-side buttons: Drop, Reset, Hint, Share, Prev, Next, Move, Contrast

## Deploy
Push to a GitHub repo named e.g. `MarbleDesk` on branch `main`, then Settings > Pages > Source: GitHub Actions.
Open the https URL in the Quest browser and tap Enter AR.

Live: https://meenanoolu.github.io/MarbleDesk/
