# Marble Desk

**A seated, hands-first marble-run builder that lives on your real desk.**

Pinch on your actual desk (via passthrough hit-testing) to lock a glass frame into the real world. Then pinch pieces from a spatial tray, place ramps, bumpers and fans, and drop the marble. Guide it into the glowing cup using only your hands. No controllers required.

Built for the Meta VR Start Developer Competition 2026 — Gaming / Productivity track, New Experience.

## Why this scores high

### Innovation & Creativity
- Unique core loop: build physical marble runs that sit on *your* desk using purposeful passthrough and hit-testing.
- Leverages spatial depth, hand tracking, and real-world anchoring in a way that would not work on a flat screen.
- Shareable layouts let players exchange puzzles.

### Experience Design
- Fully hands-first end-to-end (place frame → place pieces → press Drop → reset / next).
- Seated / airplane-seat optimized. Everything happens in a ~40 cm frame.
- Fast cold start. Level 1 is solvable in under a minute.
- Clear onboarding: first pinch places the frame, ghost pieces show valid placement, progressive levels teach mechanics.
- Purposeful passthrough: the real desk *is* the play surface. Contact shadow + grounding ring confirm lock.

### Technical Implementation
- WebXR immersive-ar with hand tracking + hit-test for desk placement.
- Rapier physics shared between browser and headless solver (`test/solve.mjs` proves every level is solvable).
- Performant Three.js + WebXR pipeline targeting 60+ fps on Quest.
- Spatial buttons, pinch grab/release, snap placement, invalid-placement feedback.

### Polish & Presentation
- Cohesive visual language (glass frame, metallic marble, emissive pieces, win particles).
- Spatial audio feedback for every action.
- Progress persistence, share codes, and sandbox mode.

## Special awards alignment
- **Best First Five Minutes**: Immediate payoff. Pinch → place → drop → success in the first session.
- **Best Reason to Come Back**: 8 levels + sandbox + shareable layouts + progress tracking.
- **Boldest Original Concept**: The experience collapses without real-world desk + hands. Passthrough is not a gimmick.
- **Best Accessibility Forward**: Hands-only, large spatial buttons, high-contrast feedback, no required text walls.

## Run
```bash
npm install
npm run dev          # desktop mouse preview → http://localhost:5173
npm run build        # dist/
node test/solve.mjs 1500   # verifies levels are solvable
```

## Controls (Quest hands)
- First pinch on your desk: place the frame (hit-test locks it to the surface).
- Pinch a piece in the right tray → move → release to place.
- Pinch a placed piece to pick it up again.
- Left-side spatial buttons: Drop, Reset, Hint, Prev, Next, Move.

## Deploy
Push to `main`. GitHub Actions builds and deploys to GitHub Pages.  
Open the HTTPS URL in the Quest browser → Enter AR.

Live: https://meenanoolu.github.io/MarbleDesk/
