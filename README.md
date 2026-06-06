# Spin Sushi

A Beyblade X–styled sushi restaurant website that secretly transforms into a
playable Beyblade arena when you press the hidden red button.

Plain HTML/CSS/JS — no build step.

## Run

Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Play

Browse the menu, add sushi to your cart, then find the **"DO NOT PRESS"** button
(bottom-right). Press it. Hold to charge, set your launch angle, and release —
last bey spinning wins.

## Test

```bash
npm test
```

Runs unit tests for the cart math (`js/cart.js`) and battle physics (`js/physics.js`).
