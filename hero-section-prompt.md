# Animated Hero Section for IncomeMap Landing Page

Build the hero section for incomemap.ca's landing page with an animated compounding curve that draws itself on page load. This is the first thing visitors see.

## Layout (top to bottom)

1. **Nav bar** — "incomemap" wordmark (lowercase serif, Georgia, #2D6B4F) on the left, "Get started free" button on the right (green bg #2D6B4F, white text, 6px radius)
2. **Badge** — "BUILT FOR CANADIAN DIVIDEND INVESTORS" in a green pill (#D4E8DC bg, #2D6B4F text, 11px, letter-spacing 1.5px)
3. **Headline** — "Map your path to financial freedom" (Georgia serif, 44px, #1A3C2A, max-width 520px)
4. **Description** — "Track your dividend income, model DRIP compounding, and see where your portfolio is taking you." (16px sans-serif, #8A7F72, max-width 440px)
5. **CTA button** — "Start mapping your income" (15px, #FDFAF3 text on #2D6B4F bg, 14px 32px padding, 8px radius)
6. **Subtext** — "Free to start. No credit card required." (12px, #B5AA9A)
7. **Animated compounding chart** — SVG chart area below the text content

## Background

Entire hero section uses cream background: #FDFAF3

## Animation Sequence

All animations use CSS keyframes, no JavaScript required.

### Text fade-up (staggered)
Each text element fades up from 12px below with opacity 0 → 1. Stagger timing:
- Badge: 0.3s delay
- Headline: 0.5s delay
- Description: 0.7s delay
- CTA button: 0.9s delay
- Subtext: 1.0s delay
- Duration: 0.6s each, ease timing

### Compounding curve draw (starts at 1.2s)
- An SVG `<path>` that traces an exponential compounding curve from left to right
- Use `stroke-dasharray` and `stroke-dashoffset` animation to create the "drawing" effect
- Line: #2D6B4F, 2.5px stroke, round linecap
- Fill area beneath the curve: #D4E8DC at 40% opacity
- Subtle horizontal grid lines at the back: #E8E0D3, 0.5px
- Y-axis labels on the left: $2K, $10K, $25K, $50K (10px, #B5AA9A)
- Animation duration: 2.5s ease-in-out

### Milestone labels (fade in as line passes)
Four milestone points along the curve, each with a dot, a dollar amount in a small card, and a year label below:

| Milestone | Position | Amount | Label | Fade-in delay |
|-----------|----------|--------|-------|---------------|
| 1 | ~15% along curve | $3.2K | Year 3 | 2.0s |
| 2 | ~40% along curve | $8.4K | Year 10 | 2.5s |
| 3 | ~67% along curve | $22.1K | Year 20 | 3.0s |
| 4 | End of curve | $48.7K | Year 30 | 3.5s |

- Milestones 1-3: green dot (#2D6B4F, 4px radius), white card with light border (#E8E0D3), monospace amount text (#1A3C2A)
- Milestone 4 (final): larger dot (5px), green card (#2D6B4F bg) with white monospace text, year label in green bold instead of gray
- Year labels: 10px sans-serif, #B5AA9A (except final which is #2D6B4F bold)
- Amounts use monospace font: JetBrains Mono / Fira Code / Courier New, 13px, weight 500

## CSS Keyframes Needed

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}
```

## SVG Curve Path

The compounding curve should follow this approximate shape — slow/flat early, accelerating dramatically later:

```
M60 170 C120 168, 180 164, 240 155 C300 142, 360 122, 420 100 C480 72, 540 48, 620 28
```

The fill area uses the same path but closes to the bottom of the chart:

```
M60 170 C120 168, 180 164, 240 155 C300 142, 360 122, 420 100 C480 72, 540 48, 620 28 L620 180 L60 180 Z
```

## Brand Colors Reference

- Green 900 (dark): #1A3C2A
- Green 700 (primary): #2D6B4F
- Green 300 (light accent): #6BAF8D
- Green 100 (light fill): #D4E8DC
- Cream 50 (background): #FDFAF3
- Cream 300 (borders): #E8E0D3
- Cream 700 (muted text): #8A7F72
- Cream 500 (hint text): #B5AA9A

## Typography

- Wordmark and headline: Georgia, serif
- Body, nav, labels: system sans-serif (-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
- Dollar amounts: monospace (JetBrains Mono, Fira Code, Courier New)

## Important Notes

- All text elements start with `opacity: 0` and use `animation-fill-mode: forwards` so they stay visible after animating
- The curve `stroke-dasharray` and `stroke-dashoffset` should both be set to a large value (2000) initially, then animate `stroke-dashoffset` to 0
- Total animation completes in ~3.5 seconds from page load
- Make sure it's responsive — the SVG chart should scale with `width: 100%` and a `viewBox`
