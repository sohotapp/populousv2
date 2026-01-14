# RLTX Design System

**Based on Linear App Design Language**

This document serves as the single source of truth for all design decisions in RLTX. Every component, color, spacing value, and interaction pattern should follow these specifications verbatim.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Colors](#colors)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Border Radius](#border-radius)
6. [Shadows](#shadows)
7. [Icons](#icons)
8. [Components](#components)
9. [Interactions](#interactions)
10. [Animations](#animations)
11. [Patterns](#patterns)

---

## Design Philosophy

### Core Principles

1. **Minimal Chrome** - UI elements should have minimal visual weight. No heavy borders, no unnecessary containers.

2. **Typography-Driven** - Text styling (weight, size, color) communicates hierarchy, not boxes or backgrounds.

3. **Hover Reveals** - Interactive elements appear subtle at rest; hover states reveal their interactivity.

4. **Monochromatic** - Strict grayscale palette with rare accent colors for critical actions only.

5. **Single Subject Focus** - Each view/component has one clear purpose. Reduce cognitive load.

6. **Keyboard-First** - Every action should be achievable via keyboard. Show shortcuts.

7. **100ms Interactions** - All UI responses should feel instantaneous (<100ms).

### What Linear Does NOT Do

- No heavy box shadows on cards
- No colorful backgrounds for containers
- No avatars in chat interfaces
- No left/right chat bubble alignment
- No excessive border usage
- No decorative elements
- No unnecessary icons

---

## Colors

### Dark Theme (Primary)

```css
/* Backgrounds */
--bg-base:           hsl(0, 0%, 7%);      /* #121212 - Main background */
--bg-elevated:       hsl(0, 0%, 9%);      /* #171717 - Elevated surfaces */
--bg-surface:        hsl(0, 0%, 10%);     /* #1a1a1a - Cards, panels */
--bg-hover:          hsl(0, 0%, 12%);     /* #1f1f1f - Hover states */
--bg-active:         hsl(0, 0%, 14%);     /* #242424 - Active/pressed states */

/* Borders */
--border-subtle:     hsl(0, 0%, 12%);     /* #1f1f1f - Barely visible */
--border-default:    hsl(0, 0%, 15%);     /* #262626 - Default borders */
--border-hover:      hsl(0, 0%, 20%);     /* #333333 - Hover state */
--border-focus:      hsl(0, 0%, 25%);     /* #404040 - Focus state */

/* Text */
--text-primary:      hsl(0, 0%, 93%);     /* #ededed - Primary text */
--text-secondary:    hsl(0, 0%, 70%);     /* #b3b3b3 - Secondary text */
--text-tertiary:     hsl(0, 0%, 50%);     /* #808080 - Muted text */
--text-quaternary:   hsl(0, 0%, 35%);     /* #595959 - Very muted */
--text-disabled:     hsl(0, 0%, 25%);     /* #404040 - Disabled text */

/* Icons */
--icon-primary:      hsl(0, 0%, 70%);     /* #b3b3b3 */
--icon-secondary:    hsl(0, 0%, 45%);     /* #737373 */
--icon-tertiary:     hsl(0, 0%, 30%);     /* #4d4d4d */

/* Accent (Use Sparingly) */
--accent-primary:    hsl(230, 60%, 60%);  /* #5c6bc0 - Primary actions */
--accent-hover:      hsl(230, 60%, 70%);  /* Hover state */

/* Status Colors (Use Only When Necessary) */
--status-success:    hsl(142, 70%, 45%);  /* Green */
--status-warning:    hsl(38, 90%, 50%);   /* Orange */
--status-error:      hsl(0, 70%, 55%);    /* Red */
--status-info:       hsl(210, 70%, 55%);  /* Blue */
```

### Color Usage Rules

1. **Backgrounds**: Use `--bg-base` for main areas, `--bg-elevated` for panels/modals
2. **Borders**: Default to `--border-subtle`. Only use `--border-default` when separation is critical
3. **Text**: Primary for headings/important content, secondary for body, tertiary for metadata
4. **Icons**: Match icon color to adjacent text color
5. **Accents**: Reserve for primary CTAs only. Never for decoration

### Specific HSL Values for Tailwind

```javascript
// tailwind.config.js color mappings
colors: {
  background: {
    DEFAULT: 'hsl(0, 0%, 7%)',      // #121212
    elevated: 'hsl(0, 0%, 9%)',     // #171717
    surface: 'hsl(0, 0%, 10%)',     // #1a1a1a
    hover: 'hsl(0, 0%, 12%)',       // #1f1f1f
    active: 'hsl(0, 0%, 14%)',      // #242424
  },
  border: {
    subtle: 'hsl(0, 0%, 12%)',
    DEFAULT: 'hsl(0, 0%, 15%)',
    hover: 'hsl(0, 0%, 20%)',
    focus: 'hsl(0, 0%, 25%)',
  },
  text: {
    primary: 'hsl(0, 0%, 93%)',
    secondary: 'hsl(0, 0%, 70%)',
    tertiary: 'hsl(0, 0%, 50%)',
    quaternary: 'hsl(0, 0%, 35%)',
    disabled: 'hsl(0, 0%, 25%)',
  }
}
```

---

## Typography

### Font Family

```css
--font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
             'Helvetica Neue', sans-serif;

--font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono',
             'Monaco', 'Consolas', monospace;
```

### Font Sizes (4px Scale)

```css
--text-2xs:    10px;    /* 0.625rem - Labels, badges */
--text-xs:     11px;    /* 0.6875rem - Captions, metadata */
--text-sm:     12px;    /* 0.75rem - Secondary content */
--text-base:   13px;    /* 0.8125rem - Body text (LINEAR DEFAULT) */
--text-md:     14px;    /* 0.875rem - Emphasized body */
--text-lg:     16px;    /* 1rem - Subheadings */
--text-xl:     18px;    /* 1.125rem - Section titles */
--text-2xl:    20px;    /* 1.25rem - Page titles */
--text-3xl:    24px;    /* 1.5rem - Large headings */
```

### Font Weights

```css
--font-normal:   400;   /* Body text */
--font-medium:   500;   /* Emphasized text, labels */
--font-semibold: 600;   /* Subheadings, buttons */
--font-bold:     700;   /* Headings (rare) */
```

### Line Heights

```css
--leading-none:    1;       /* Headings */
--leading-tight:   1.25;    /* Compact text */
--leading-snug:    1.375;   /* UI elements */
--leading-normal:  1.5;     /* Body text (DEFAULT) */
--leading-relaxed: 1.625;   /* Long-form content */
```

### Letter Spacing

```css
--tracking-tighter: -0.02em;  /* Large headings */
--tracking-tight:   -0.01em;  /* Subheadings */
--tracking-normal:  0;        /* Body text */
--tracking-wide:    0.02em;   /* Uppercase labels */
```

### Typography Scale Reference

| Element          | Size    | Weight | Color           | Letter Spacing |
|------------------|---------|--------|-----------------|----------------|
| Page Title       | 20px    | 600    | text-primary    | -0.01em        |
| Section Header   | 13px    | 600    | text-primary    | normal         |
| Body Text        | 13px    | 400    | text-primary    | normal         |
| Secondary Text   | 13px    | 400    | text-secondary  | normal         |
| Muted Text       | 13px    | 400    | text-tertiary   | normal         |
| Label            | 11px    | 500    | text-tertiary   | 0.02em         |
| Caption          | 11px    | 400    | text-quaternary | normal         |
| Code             | 12px    | 400    | text-secondary  | normal         |

---

## Spacing

### Base Unit: 4px

All spacing should be multiples of 4px.

```css
--space-0:    0px;
--space-0.5:  2px;     /* Micro adjustments only */
--space-1:    4px;     /* Tight spacing */
--space-1.5:  6px;     /* Between related items */
--space-2:    8px;     /* Default gap */
--space-2.5:  10px;    /* Comfortable gap */
--space-3:    12px;    /* Section padding */
--space-4:    16px;    /* Component padding */
--space-5:    20px;    /* Large gap */
--space-6:    24px;    /* Section spacing */
--space-8:    32px;    /* Major sections */
--space-10:   40px;    /* Page margins */
--space-12:   48px;    /* Large separations */
```

### Common Spacing Patterns

```css
/* Component internal padding */
.button      { padding: 6px 10px; }      /* --space-1.5 --space-2.5 */
.input       { padding: 8px 10px; }      /* --space-2 --space-2.5 */
.card        { padding: 12px; }          /* --space-3 */
.panel       { padding: 12px; }          /* --space-3 */
.modal       { padding: 16px; }          /* --space-4 */

/* Gaps between elements */
.icon-gap    { gap: 6px; }               /* Icon to text */
.item-gap    { gap: 8px; }               /* List items */
.section-gap { gap: 16px; }              /* Sections */

/* Message/thread spacing */
.message-gap { gap: 12px; }              /* Between messages */
```

---

## Border Radius

### Scale

```css
--radius-none: 0px;
--radius-sm:   2px;     /* Subtle rounding (tags) */
--radius-md:   4px;     /* Buttons, inputs (DEFAULT) */
--radius-lg:   6px;     /* Cards, panels */
--radius-xl:   8px;     /* Modals, dialogs */
--radius-2xl:  12px;    /* Large containers */
--radius-full: 9999px;  /* Pills, avatars */
```

### Usage Guidelines

| Element        | Radius   |
|----------------|----------|
| Buttons        | 4px      |
| Inputs         | 4px      |
| Dropdowns      | 6px      |
| Cards          | 6px      |
| Modals         | 8px      |
| Tooltips       | 4px      |
| Tags/Badges    | 2px      |
| Avatar         | full     |

---

## Shadows

### Linear's Approach: Minimal Shadows

Linear uses very subtle shadows. Most elevation is communicated through background color changes, not shadows.

```css
/* Use sparingly */
--shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.3);
--shadow-md:   0 2px 4px 0 rgba(0, 0, 0, 0.3),
               0 1px 2px 0 rgba(0, 0, 0, 0.2);
--shadow-lg:   0 4px 8px 0 rgba(0, 0, 0, 0.4),
               0 2px 4px 0 rgba(0, 0, 0, 0.2);

/* Dropdown/popover shadow */
--shadow-dropdown: 0 4px 12px rgba(0, 0, 0, 0.5),
                   0 0 0 1px rgba(255, 255, 255, 0.05);

/* Modal shadow */
--shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.6),
                0 0 0 1px rgba(255, 255, 255, 0.05);
```

### When to Use Shadows

- **Dropdowns/Popovers**: `--shadow-dropdown`
- **Modals**: `--shadow-modal`
- **Floating elements**: `--shadow-lg`
- **Cards**: Usually NO shadow, use border instead
- **Buttons**: NO shadow

---

## Icons

### Style: Outlined, 1.5px Stroke

Linear uses custom icons similar to Lucide/Phosphor style:
- **Stroke width**: 1.5px (not 2px)
- **Style**: Outlined, not filled
- **Corners**: Rounded (2px radius on corners)

### Sizes

```css
--icon-xs:   12px;    /* Inline with small text */
--icon-sm:   14px;    /* Inline with body text */
--icon-md:   16px;    /* Default size */
--icon-lg:   20px;    /* Emphasis */
--icon-xl:   24px;    /* Headers, empty states */
```

### Icon Colors

Icons should match their adjacent text:
- Primary icon: `--icon-primary` (hsl(0, 0%, 70%))
- Secondary icon: `--icon-secondary` (hsl(0, 0%, 45%))
- Muted icon: `--icon-tertiary` (hsl(0, 0%, 30%))

### Common Icons (Lucide equivalents)

```
Navigation:       ChevronRight, ChevronDown, ArrowLeft, ArrowRight
Actions:          Plus, X, Check, Search, Settings, MoreHorizontal
Content:          File, Folder, Hash, Link, Image
Communication:    MessageSquare, Bell, Mail
Status:           AlertCircle, CheckCircle, XCircle, Info
Interface:        Menu, Grid, List, Filter, SortAsc
```

---

## Components

### Buttons

#### Primary Button (Use Sparingly)
```css
.btn-primary {
  background: hsl(0, 0%, 93%);        /* Light on dark */
  color: hsl(0, 0%, 7%);              /* Dark text */
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  transition: background 100ms;
}
.btn-primary:hover {
  background: hsl(0, 0%, 100%);
}
```

#### Secondary Button (Default)
```css
.btn-secondary {
  background: transparent;
  color: hsl(0, 0%, 70%);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid hsl(0, 0%, 15%);
  transition: all 100ms;
}
.btn-secondary:hover {
  background: hsl(0, 0%, 10%);
  border-color: hsl(0, 0%, 20%);
  color: hsl(0, 0%, 85%);
}
```

#### Ghost Button (Most Common)
```css
.btn-ghost {
  background: transparent;
  color: hsl(0, 0%, 50%);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 10px;
  border-radius: 4px;
  border: none;
  transition: all 100ms;
}
.btn-ghost:hover {
  background: hsl(0, 0%, 12%);
  color: hsl(0, 0%, 80%);
}
```

#### Icon Button
```css
.btn-icon {
  background: transparent;
  color: hsl(0, 0%, 45%);
  padding: 6px;
  border-radius: 4px;
  border: none;
  transition: all 100ms;
}
.btn-icon:hover {
  background: hsl(0, 0%, 12%);
  color: hsl(0, 0%, 70%);
}
```

### Inputs

```css
.input {
  background: hsl(0, 0%, 8%);
  color: hsl(0, 0%, 90%);
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid hsl(0, 0%, 15%);
  transition: border-color 100ms;
}
.input::placeholder {
  color: hsl(0, 0%, 40%);
}
.input:hover {
  border-color: hsl(0, 0%, 20%);
}
.input:focus {
  border-color: hsl(0, 0%, 25%);
  outline: none;
}
```

### Cards/Panels

```css
.card {
  background: hsl(0, 0%, 7%);         /* Same as base or slightly elevated */
  border: 1px solid hsl(0, 0%, 12%);  /* Subtle border */
  border-radius: 6px;
  padding: 12px;
}
/* NO box-shadow by default */
```

### Dropdowns/Menus

```css
.dropdown {
  background: hsl(0, 0%, 10%);
  border: 1px solid hsl(0, 0%, 15%);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.dropdown-item {
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: hsl(0, 0%, 70%);
  transition: all 100ms;
}
.dropdown-item:hover {
  background: hsl(0, 0%, 14%);
  color: hsl(0, 0%, 90%);
}
```

### Sidebar Items

```css
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: hsl(0, 0%, 55%);
  transition: all 100ms;
}
.sidebar-item:hover {
  background: hsl(0, 0%, 10%);
  color: hsl(0, 0%, 80%);
}
.sidebar-item.active {
  background: hsl(0, 0%, 12%);
  color: hsl(0, 0%, 90%);
}
```

---

## Interactions

### Hover States

**Key Principle**: Elements should be subtle at rest, reveal on hover.

```css
/* Text links */
.link {
  color: hsl(0, 0%, 55%);
}
.link:hover {
  color: hsl(0, 0%, 85%);
}

/* Interactive rows */
.row {
  background: transparent;
}
.row:hover {
  background: hsl(0, 0%, 10%);
}

/* Icons in buttons */
.btn .icon {
  color: hsl(0, 0%, 35%);
}
.btn:hover .icon {
  color: hsl(0, 0%, 60%);
}
```

### Focus States

```css
/* Keyboard focus - visible ring */
.focusable:focus-visible {
  outline: 2px solid hsl(0, 0%, 25%);
  outline-offset: 2px;
}

/* Input focus - border change */
.input:focus {
  border-color: hsl(0, 0%, 30%);
}
```

### Active/Pressed States

```css
.btn:active {
  background: hsl(0, 0%, 14%);
  transform: scale(0.98);
}
```

### Disabled States

```css
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Animations

### Timing

```css
--duration-instant: 50ms;    /* Micro-interactions */
--duration-fast:    100ms;   /* Hover states (DEFAULT) */
--duration-normal:  150ms;   /* Transitions */
--duration-slow:    200ms;   /* Modals, panels */
--duration-slower:  300ms;   /* Page transitions */
```

### Easing

```css
--ease-out:     cubic-bezier(0, 0, 0.2, 1);      /* Elements entering */
--ease-in:      cubic-bezier(0.4, 0, 1, 1);      /* Elements leaving */
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);    /* Repositioning */
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy (rare) */
```

### Common Transitions

```css
/* Default transition for interactive elements */
transition: all 100ms ease-out;

/* Color-only transitions */
transition: color 100ms, background-color 100ms;

/* Transform transitions */
transition: transform 150ms ease-out;
```

### Animation Patterns

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up (for modals, dropdowns) */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale in (for popovers) */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

---

## Patterns

### Chat/Thread Messages

```css
/* User message - muted, secondary */
.message-user {
  color: hsl(0, 0%, 50%);
  font-size: 13px;
  line-height: 1.5;
}

/* Assistant message - primary */
.message-assistant {
  color: hsl(0, 0%, 88%);
  font-size: 13px;
  line-height: 1.5;
}

/* Message spacing */
.message-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

### Actionable Links (Inline)

```css
/* Links that appear inline with content */
.action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: 4px;
  color: hsl(0, 0%, 55%);
  font-size: 13px;
  transition: all 100ms;
}
.action-link:hover {
  background: hsl(0, 0%, 12%);
  color: hsl(0, 0%, 85%);
}
.action-link .icon {
  color: hsl(0, 0%, 30%);
}
.action-link:hover .icon {
  color: hsl(0, 0%, 55%);
}
```

### Command Palette

```css
.command-palette {
  background: hsl(0, 0%, 10%);
  border: 1px solid hsl(0, 0%, 15%);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  width: 560px;
  max-height: 400px;
}
.command-input {
  padding: 12px 16px;
  font-size: 15px;
  border-bottom: 1px solid hsl(0, 0%, 12%);
}
.command-item {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.command-item:hover {
  background: hsl(0, 0%, 14%);
}
.command-shortcut {
  font-size: 11px;
  color: hsl(0, 0%, 40%);
  font-family: var(--font-mono);
}
```

### Loading States

```css
/* Pulsing dots */
.loading-dots {
  display: flex;
  gap: 4px;
}
.loading-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: hsl(0, 0%, 45%);
  animation: pulse 1s ease-in-out infinite;
}
.loading-dot:nth-child(2) { animation-delay: 150ms; }
.loading-dot:nth-child(3) { animation-delay: 300ms; }

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

### Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}
.empty-state-icon {
  color: hsl(0, 0%, 20%);
  margin-bottom: 16px;
}
.empty-state-title {
  color: hsl(0, 0%, 50%);
  font-size: 13px;
  font-weight: 500;
}
.empty-state-description {
  color: hsl(0, 0%, 35%);
  font-size: 13px;
  margin-top: 4px;
}
```

---

## Quick Reference

### HSL Values Cheat Sheet

```
Background:     hsl(0, 0%, 7%)   → #121212
Elevated:       hsl(0, 0%, 9%)   → #171717
Hover:          hsl(0, 0%, 12%)  → #1f1f1f
Border:         hsl(0, 0%, 15%)  → #262626

Text Primary:   hsl(0, 0%, 93%)  → #ededed
Text Secondary: hsl(0, 0%, 70%)  → #b3b3b3
Text Tertiary:  hsl(0, 0%, 50%)  → #808080
Text Muted:     hsl(0, 0%, 35%)  → #595959
```

### Default Values

- **Font size**: 13px
- **Border radius**: 4px (buttons), 6px (cards)
- **Transition**: 100ms
- **Spacing unit**: 4px
- **Icon size**: 16px
- **Icon stroke**: 1.5px

---

## Sources

- [Linear Brand Guidelines](https://linear.app/brand)
- [How Linear Redesigned Their UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Design Trend Analysis - LogRocket](https://blog.logrocket.com/ux-design/linear-design/)
- [Linear's Delightful Design Patterns](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns)
- [Linear Design System - Figma Community](https://www.figma.com/community/file/1222872653732371433/linear-design-system)
- [Linear Theme Colors](https://linear.style/)
- [Inter Font Family](https://rsms.me/inter/)
