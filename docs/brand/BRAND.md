# Ghost — Brand Direction

> Source: the founder's brand board (`docs/brand/brand-board.webp`) and written direction, 2026-10-15. This is the creative brief; `docs/DESIGN_SYSTEM.md` turns it into exact tokens and components. If they disagree, DESIGN_SYSTEM wins for implementation details and this file wins for intent.

**Ghost** is an AI agent that finds lost revenue, automates collections and uncovers growth opportunities across a business. The brand is a **playful, premium fintech** brand: deep forest green, soft pink, electric blue and lemon yellow, expressive typography, and an **agent-first** interface that feels like a real product rather than a generic AI dashboard.

## Character
Playful, sharp, confident and trustworthy. It is closer to a well-designed creative tool than a conventional accounting dashboard, while keeping the reliability expected of a financial product.

**Rule:** Ghost should be recognisable even with the logo removed. Its colours, type, shapes, motion and interface all belong to one product.

## Typography
| Element | Typeface | Weight |
|---|---|---|
| Ghost wordmark | Custom rounded display serif. Until custom lettering exists, it is set in Fraunces and converted to an SVG outline. Recoleta is the reference, but it is commercial, so we do not ship it | SemiBold |
| Hero / editorial headlines (rare) | Fraunces | SemiBold |
| Page headings | Geist | SemiBold |
| Body and descriptions | Geist | Regular |
| Financial figures | Geist, tabular numerals | Medium / SemiBold |
| Metadata, technical IDs, logs | Geist Mono | Regular |

The contrast between the expressive wordmark and the restrained Geist UI is intentional.

## Colour
**Core**
| Name | Hex | Role |
|---|---|---|
| Ghost Forest | `#052018` | Primary dark background, logo panels, dark surfaces |
| Deep Forest | `#0F3730` | Secondary dark surfaces |
| Petal Pink | `#FCB8CD` | Signature brand colour, highlights, logo |
| Punch Pink | `#CB3363` | Strong accent, key actions, emphasis |

**Supporting**
| Name | Hex | Role |
|---|---|---|
| Ocean Navy | `#093C6A` | Secondary dark brand colour |
| Signal Blue | `#479EDD` | Integrations, connected systems, info states |
| Lemon Yellow | `#FED63D` | High-value discoveries, important indicators |
| Fresh Lime | `#BBE49E` | Positive outcomes, completed workflows, recovered revenue |

**Neutral**
| Name | Hex | Role |
|---|---|---|
| Warm Porcelain | `#F8F1EF` | Main light canvas |
| Soft Border | `#E7E0DD` | Separators, understated borders |
| Ink | `#17241E` | Primary text on light |
| White | `#FFFFFF` | Cards, content areas |

**Allocation:** 60–70% forest, porcelain and white; 20–30% pink and deep green; 5–10% blue, yellow and lime. Each screen gets **one dominant brand colour plus one or two accents**. Never use all four accents on one component.

**Meaning (consistent everywhere):**
- **pink** = the agent and what it discovers
- **blue** = connections and information
- **lemon** = especially important or high-value findings
- **lime** = success and recovered revenue

## Logo system
- The logo is a lowercase wordmark "ghost" plus an abstract **four-point symbol**: a soft, folded diamond or "bloom", with one curved fold creating a negative-space crescent. There is no literal ghost mascot.
- Signature combination is petal on forest. The secondary combination is forest on petal.
- The app icon is the symbol alone, centred on a flat forest, petal or navy square with a 22% corner radius. It must read at 16–32px.
- Clear space is at least the width of the symbol's central negative space.
- **Never:** decorative outlines, arbitrary shadows, overlapping symbols, gradient-filled lettering, AI sparkles.

## Brand shapes
Organic shapes, precise geometry and purposeful connections. Signature assets:
- the four-point mark,
- **revenue trails** (thin connector lines between nodes),
- **two-tone colour tiles** (rounded squares in one brand colour carrying a single glyph, e.g. a chart, a link, a document or people).

## Interface philosophy — agent-first
The agent *is* the product. Analytics exist to explain what the agent discovered and did. There are three layers:
1. **Agent workspace.** This is a spacious porcelain or forest surface with a prominent agent activity area. It shows what Ghost is investigating, the evidence found, what it recommends and the next action. Concise activity updates and connected workflow nodes give clear progression states. It feels alive without constant animation.
2. **The opportunity.** This is a focused view of potential value, supporting evidence, the recommended next step and the source records. It is a short, informative panel, not a wall of metrics. The underlying records are always one click away.
3. **The action.** Collections, follow-ups and other workflows appear as a visible sequence of steps, with statuses and human-review gates.

## UI tokens (from the brief)
| Token | Value |
|---|---|
| Light background | `#F8F1EF` |
| Dark background | `#052018` |
| Primary accent | `#FCB8CD` |
| Text on light | `#17241E` |
| Card radius | 16px |
| Large panel radius | 22px |
| Small control radius | 10px |
| Standard border | 1px solid `#E7E0DD` |
| Shadows | Subtle, soft, sparse |
| Gradients | Avoid by default |
| Animation | Short, purposeful, tied to agent activity |

Bright accents go on compact controls, status indicators, charts and selected elements. Large working surfaces stay quiet.

## Motion
Ghost moves to communicate **progress, discovery and completion**:
- connected nodes activate as it investigates,
- an opportunity appears when evidence is verified,
- a revenue figure updates when an action succeeds.

Transitions run 180–280ms, slightly longer for large panels. Respect `prefers-reduced-motion`. There are no infinite decorative loops.

## Avoid
Glowing brains, random sparkles, generic futuristic grids, floating glass panels, gradients without purpose, decorative gradient blobs, twelve-card analytics walls with a chat widget bolted on, made-up charts, meaningless activity feeds.
