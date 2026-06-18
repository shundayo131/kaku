# Styling Guide

Kaku styles its UI with **plain CSS and a design-token layer** — no Tailwind, no
shadcn/ui, no CSS framework. This is a deliberate choice (see "Why no framework"
below), and it is enforced. Read this before adding or changing any styles.

## The one rule

**All color comes from tokens.** `src/styles/tokens.css` is the only file allowed
to contain raw color literals (hex or `rgba()`). Every other rule references a
`var(--token)`. This keeps the whole app — chrome and document alike — visually
consistent, and makes future theming (e.g. dark mode) a matter of swapping the
token layer.

`npm run lint:css` enforces this. It fails if a raw `#hex` or `rgba(` appears
outside `tokens.css`. Run it before committing; it is meant to gate CI.

Need a new color? Add a **semantic** token to `tokens.css` (`--danger`,
`--surface-2` — not `--red`, `--grey-7`) and reference it. Don't inline the value.

## The two style domains

An editor app has two kinds of styled DOM, and they're styled differently:

1. **Chrome** — the sidebar, toolbar, titlebar, modals, empty state. You write
   this markup in JSX, so it gets semantic class names (`.sidebar`, `.doc-toolbar`)
   styled in `src/styles/chrome/`.
2. **Document content** — everything inside the editor. Tiptap / ProseMirror
   generates this DOM at runtime, so there is no JSX to put classes on. It can
   only be styled with global descendant rules rooted at `.ProseMirror`, which all
   live in `src/styles/editor.css`. This is structural, not a preference — it's
   why a utility framework wouldn't remove the global CSS here anyway.

Both domains consume the **same tokens**, which is what keeps them coherent.

## File layout

```
src/styles/
  index.css        entry point — @imports everything in cascade order
  tokens.css       the design contract (the only file with raw color literals)
  base.css         reset, html/body, root app grid
  chrome/          one file per UI region (titlebar, sidebar, settings, …)
  editor.css       all .ProseMirror document-content rules
```

`index.css` imports in a fixed order; within equal specificity that order *is* the
cascade order, so keep it stable when adding files.

## Why no framework (for now)

- The document content is global `.ProseMirror` CSS no matter what — Tailwind
  can't touch editor-generated DOM. Running one styling paradigm (tokens + plain
  CSS) everywhere is simpler than mixing utilities for chrome with global CSS for
  the editor.
- The design is a tight, opinionated monochrome system with a single accent
  reserved for AI affordances. A constrained token set expresses that better than
  a large default palette.
- Fewer dependencies suits a local-first desktop app.

This isn't permanent dogma. If outside contribution grows and utility-class
familiarity becomes the bottleneck, Tailwind v4 with these tokens mapped into
`@theme` (so the palette *is* the design system) is a clean later migration. The
token layer this guide describes is exactly what makes that swap low-risk.
