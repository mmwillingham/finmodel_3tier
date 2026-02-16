# Design system source

This folder contains the **Design System for Fintech SaaS** (Figma Make export), used for the Model My Retirement UI.

## File

- **`Design_System_for_Fintech_SaaS.make`** — Figma Make export (zip with `canvas.fig`, `meta.json`, `ai_chat.json`, and images). The design brief and tokens were extracted from the export and applied in the repo.

## Tokens applied in code

| Token        | Light              | Dark     |
|-------------|--------------------|----------|
| Surface     | `#f8fafb`          | `#0d1117` |
| Surface card| `#ffffff`          | `#161b22` |
| Primary Navy| `#0F2847`          | —        |
| Primary Teal| `#00a3e0`          | —        |
| Gold accent | `#d4a574`          | —        |
| Focus ring  | 3px teal glow      | —        |

- **Typography:** Inter (UI), Fira Code (financial/data numbers).
- **Spacing:** 8px base grid.
- **Radius:** 6px (small), 12px (modals), 16px (hero).
- **Header:** Navy–Teal gradient; **sidebar active:** Navy–Teal gradient.

Defined in: `tailwind.config.js`, `src/index.css` (CSS variables), and component CSS (sidebar, header, settings).
