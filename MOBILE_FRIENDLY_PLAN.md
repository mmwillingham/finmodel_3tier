# Plan: Making the Application Mobile Friendly

This document outlines what it would take to make the Financial Projector / Estate Springboard app mobile friendly. **No code changes have been made**; this is an assessment and implementation plan only.

---

## 1. Layout & Navigation

### Sidebar

- **Current:** The sidebar is always visible (flex layout, ~250px width, min 150px) and not collapsible. On small screens it either dominates the viewport or squeezes the main content.
- **Needed:** A mobile navigation pattern:
  - **Option A:** Hide the sidebar by default on small viewports; use a bottom tab bar or hamburger that opens a slide-out drawer / overlay menu for main nav (Dashboard, Assets, Liabilities, etc.).
  - **Option B:** Replace the sidebar with a bottom navigation bar (e.g. Home, Charts, Settings) and move less-used items into a "More" or secondary menu.
- **Also:** The sidebar resize handle is mouse-oriented; disable or hide it on touch devices.

### Header

- **Current:** Logo, user info, Account Switcher, Points, Logout, and hamburger (Settings) all live in the header. On narrow screens this will overflow or wrap poorly.
- **Needed:** Use `@media (max-width: 768px)` (or similar) to hide "Logged in as…", Account Switcher, and Points on mobile; keep logo, hamburger, and Logout (or move Logout into the hamburger dropdown). Ensure the hamburger dropdown works well on touch (positioning, z-index, tap targets).

---

## 2. Tables

- **Current:** Many tables across the app: projections, accounts, cash flow, custom charts, documents, user management, referrals, etc. Some use `overflow-x: auto`; others assume wider layout. Several have fixed `min-width` columns.
- **Needed:**
  - **Option A:** Rely on horizontal scroll but make it obvious (e.g. "scroll →" hint, sticky first column) and ensure touch scrolling is smooth.
  - **Option B:** Use card/list layouts on mobile: each table row becomes a card (e.g. one card per projection, account, or document) with key fields and actions, instead of a table row.
- **Affected:** ProjectionsTable, CashFlowView tables, CustomChartView table, accounts tables, DocumentsPage, AuthorizedUsersPage, UserManagementPage, referrals table—all need a mobile strategy (scroll vs cards).

---

## 3. Charts

- **Current:** Chart.js via `react-chartjs-2`; CustomChartView, Monte Carlo, Net Worth / Cash Flow charts.
- **Needed:**
  - Ensure chart containers use `width: 100%` and `max-width: 100%` (and avoid fixed pixel width) so they scale down with the viewport.
  - Verify Chart.js `maintainAspectRatio` and `responsive` options work well on small screens; consider a different `aspectRatio` for mobile.
  - If chart + table sit side by side, stack them vertically on small screens (`flex-direction: column` or grid breakpoints).

---

## 4. Forms & Modals

- **Current:** Wizards (Profile, Categories, Accounts, Assets, Liabilities, Income, Expenses, etc.), Asset/Liability/CashFlow form modals, Settings pages, auth forms. Many use grids or side-by-side layouts with `min-width` (e.g. 120px, 150px) on inputs/buttons.
- **Needed:**
  - Add `@media (max-width: 768px)` (or similar) to switch to single-column layout, full-width inputs, and stacked buttons.
  - Modals (ConfirmDialog, PlaidAccountMapping, CategoryEditor, Help, About, etc.): use `max-width: 100%`, `width: 100%` (with padding) on small screens, and consider `max-height: 90vh` + internal scroll so they don't overflow.
  - Auth forms (`AuthForms.css`): already `max-width: 400px`; add padding for small screens and ensure buttons/inputs are at least ~44px tall for touch.

---

## 5. Touch & Interaction

- **Current:** Buttons and nav items vary in size; some icon-only or small buttons may be below recommended touch target size.
- **Needed:** Ensure minimum ~44×44px tap targets for primary actions, nav buttons, and table row actions; increase padding or `min-height` / `min-width` where needed. Disable or hide the sidebar resize handle on touch. Provide visible focus (and, where relevant, active) states for touch users, not only hover.

---

## 6. Global Responsive Basics

- **Breakpoints:** Pick a small set (e.g. 480px, 768px, 1024px) and use them consistently in `@media` across App, Header, SidebarLayout, Settings, and key pages.
- **Typography:** Slightly reduce `font-size` on very small screens if needed; avoid tiny body text.
- **Spacing:** Reduce `padding` / `margin` on containers (e.g. `main-content`, `.container`) on mobile so more space goes to content.
- **CSS:** The app uses Tailwind; add responsive utilities (`md:`, `lg:`) for layout shifts where it helps, or keep custom CSS but add matching `@media` rules.

---

## 7. Third-Party & Platform

- **Plaid Link:** Confirm the Plaid flow (OAuth, MFA, institution list) works well on real mobile devices.
- **Google OAuth:** Same for sign-in redirects and popups on mobile browsers.
- **PWA / standalone:** If using `manifest.json` and optional service worker, ensure "Add to Home Screen" and standalone mode don't break layout; same viewport and responsive rules apply.

---

## 8. Testing & Scope

- **Testing:** Manually test on real phones (e.g. iOS Safari, Android Chrome) and with responsive emulation; fix overflow, tap targets, and layout glitches.
- **Scope:** The app has many routes and components (SidebarLayout, Header, wizards, settings, documents, charts, tables). Making it "mobile friendly" end-to-end means touching most of these. A **phased approach** (e.g. login + dashboard + one main flow first) reduces scope and risk.

---

## 9. Detection: Viewport vs Device

The plan uses **viewport-based responsive design**, not device detection.

- **Layout** switches via CSS `@media (max-width: …)` (e.g. 768px). Same app for all devices; narrow viewports get mobile layout, wide get desktop.
- **No** "computer vs mobile" user-agent or device check. A narrow desktop window can get mobile layout; a tablet in landscape can get desktop layout.
- Optionally use `@media (pointer: coarse)` or `'ontouchstart' in window` to tweak tap targets and hover behavior for touch.

---

## Summary

| Area | Effort | Main Changes |
|------|--------|--------------|
| **Sidebar → mobile nav** | High | Drawer or bottom nav; hide sidebar on small viewports |
| **Header** | Medium | Media queries; hide/collapse elements; dropdown behavior |
| **Tables** | High | Per-table: horizontal scroll UX and/or card layouts |
| **Charts** | Low–Medium | Container sizing; Chart.js config; stacking with tables |
| **Forms & modals** | Medium | Responsive grids → single column; full-width inputs; modal sizing |
| **Touch targets** | Low–Medium | Min sizes; padding; focus/active states |
| **Global (breakpoints, spacing)** | Medium | Shared `@media`; Tailwind or CSS updates |

**Overall:** Medium–high effort, given the number of tables, forms, and the desktop-first sidebar layout. The **single biggest design decision** is how to handle **sidebar + main nav on mobile** (drawer vs bottom nav vs hybrid); that drives much of the layout and component work.
