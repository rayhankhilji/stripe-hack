# Ghost brand kit

Source of truth for the Ghost mark. Every file here is a plain vector SVG built from a `viewBox`. None of them contains raster data, filters, gradients or live text. Single-colour artwork uses `fill="currentColor"`.

| File | Use |
|---|---|
| `symbol.svg` | Four-point bloom, 512 × 512 grid, ink from 32 to 480 on both axes |
| `wordmark.svg` | Lowercase "ghost", outlined |
| `lockup-horizontal.svg` | Symbol + wordmark |
| `app-icon-{forest,petal,navy}.svg` | 1024 × 1024 app icons |
| `scripts/render.mjs` | Renders `og.png`, `apple-icon.png` and `favicon.ico` |

Copies of the SVGs ship in `apps/web/public/brand/`. `apps/web/src/components/ghost/logo.tsx` inlines the same path data.

## Construction

### Symbol
The symbol is two closed cubic Bézier paths (`body` and `fold`) with 12 on-curve nodes in total. There are no self-intersections.

1. **Star.** Start from a four-point star centred on the grid.
   - Each tip is an on-curve node whose tangent is perpendicular to its axis. Short handles keep the tip round.
   - Each concave flank passes through one node on a 45° diagonal, with its tangent perpendicular to that diagonal.
   - The north and east tips sit at radius 0.92 (in tip-radius units), and the west and south tips at 1.02. The south-west flank is shallower (0.80 against 0.62 for the north-east flank), so the folded lobe reads as one soft petal.
2. **Fold.** Two curves run from a point P on the north-west flank to its mirror image Q on the south-east flank.
   - The outer curve is the fold edge. It leaves P tangent to the outline, so the folded lobe stays smooth.
   - The inner curve is the body's edge. It bulges further towards the north-east.
   - The space between the two curves is the negative-space crescent. It reaches the outline at P and Q.
3. **Symmetry.** The star and the fold edge are mirror-symmetric about the north-east / south-west diagonal, as on the brand board. The inner crescent edge is slightly asymmetric, to match the board, where the crescent is widest towards the upper left.

The node positions were fitted to the symbol on `docs/brand/brand-board.webp`, with an overlap (IoU) of about 0.90. The final shape is the clean geometric construction above, not a trace.

### Wordmark
The wordmark is Fraunces SemiBold (OFL) using the "72pt SuperSoft" instance (opsz 72, SOFT 100, WONK 0, wght 600), which is the closest open match to the Recoleta-style lettering on the board. It has font kerning and −1% tracking, and is converted to outlines.

### Lockup
- The symbol's ink height is 1.35 × the wordmark's x-height.
- The gap between symbol and wordmark is 0.35 × the symbol's width.
- The symbol is centred vertically on the x-height band, so it sits optically on the baseline.

### App icons
Each icon is a 1024 × 1024 square with a 22% corner radius (225.28). The symbol's ink width is 56% of the icon, centred.

## Clear space
Keep clear space around the logo at least equal to the widest part of the symbol's central negative space (the crescent).

## Colour
| Variant | Symbol | Background |
|---|---|---|
| Signature | Petal Pink `#FCB8CD` | Ghost Forest `#052018` |
| Secondary | Ghost Forest `#052018` | Petal Pink `#FCB8CD` |
| App icon: forest | Petal Pink `#FCB8CD` | Ghost Forest `#052018` |
| App icon: petal | Punch Pink `#CB3363` | Petal Pink `#FCB8CD` |
| App icon: navy | Petal Pink `#FCB8CD` | Ocean Navy `#093C6A` |

## Do / don't
- **Do** use petal on forest as the signature pairing, and forest on petal as the secondary.
- **Do** use the symbol alone for app icons, centred on a flat forest, petal or navy square with a 22% radius.
- **Don't** add decorative outlines, arbitrary shadows, overlapping symbols, gradient-filled lettering or AI sparkles.
- **Don't** redraw the symbol as a generic four-point sparkle. The folded crescent is the mark.

## Regenerating rasters
```bash
npx -y -p sharp@0.34.5 -c "node brand/scripts/render.mjs"
```
