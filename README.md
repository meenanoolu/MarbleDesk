# Marble Desk

A seated, hands-only marble-run builder for Meta Quest (WebXR). A glass frame appears on your real desk
(you pinch where you want it). Pinch pieces from the tray, place them, press Drop, and guide the marble
into the glowing cup. 5 levels plus a sandbox.

## Run
    npm install
    npm run dev        # desktop preview (mouse), http://localhost:5173
    npm run build      # outputs dist/
    node test/solve.mjs 1500   # proves every level is solvable (random search)

## Controls (Quest, hands)
- First pinch: place the diorama on your desk.
- Pinch a piece in the right tray, move, release to place. Pinch a placed piece to move it.
- Pinch the left-side buttons: Drop, Reset, Hint, Prev, Next, Move.

## Deploy
Push to a GitHub repo named e.g. `marble-desk` on branch `main`, then Settings > Pages > Source: GitHub Actions.
Open the https URL in the Quest browser and tap Enter AR.
