# CSS / SCSS

Reference for code review. Apply to all `.css`, `.scss`, `.sass`, `.less` files and inline styles.

---

## Naming Conventions

### BEM (Block Element Modifier)

Use BEM for all component class names. It makes the HTML/CSS relationship explicit and prevents specificity conflicts.

```scss
// Structure: block__element--modifier

// Block: standalone component
.camera-card { }

// Element: part of a block (double underscore)
.camera-card__title { }
.camera-card__thumbnail { }
.camera-card__status-badge { }

// Modifier: variation of a block or element (double dash)
.camera-card--offline { }
.camera-card--selected { }
.camera-card__status-badge--critical { }
```

```html
<div class="camera-card camera-card--offline">
  <h3 class="camera-card__title">Entrance Cam</h3>
  <span class="camera-card__status-badge camera-card__status-badge--critical">Offline</span>
</div>
```

Flag any class name that:
- Describes appearance (`red-text`, `big-button`, `left-col`) rather than purpose
- Uses camelCase (`cameraCard`) or PascalCase (`CameraCard`) in CSS

### Utility Classes

Utility classes are acceptable for spacing, display, and layout when using a system like Tailwind. The rule: either BEM for custom components OR a utility-first framework. Do not mix both inconsistently.

### SCSS Variables and Maps

```scss
// GOOD: descriptive variable names
$color-primary: #1a73e8;
$color-danger: #d93025;
$spacing-md: 16px;
$font-size-body: 1rem;

// IMPORTANT: magic numbers without variable
.button {
  padding: 13px 24px;  // where does 13 come from?
  border-radius: 4px;
  color: #1a73e8;      // hardcoded color not in variable
}

// GOOD: use design tokens
.button {
  padding: $spacing-sm $spacing-md;
  border-radius: $border-radius-sm;
  color: $color-primary;
}
```

---

## SCSS Structure

### File Organization

```
styles/
  _variables.scss      Design tokens (colors, spacing, typography)
  _mixins.scss         Reusable mixins
  _reset.scss          CSS reset / normalize
  _typography.scss     Base typography
  _base.scss           Global base styles
  components/
    _button.scss
    _camera-card.scss
    _alert.scss
  layouts/
    _header.scss
    _sidebar.scss
    _grid.scss
  pages/
    _dashboard.scss
    _settings.scss
  main.scss            Imports only, no rules
```

### Import Order

```scss
// GOOD: variables and mixins first, then base, then components
@use 'variables';
@use 'mixins';
@use 'reset';
@use 'typography';
@use 'components/button';
@use 'components/camera-card';
```

### @use vs @import

```scss
// BLOCKING: @import is deprecated in Dart Sass
@import 'variables';

// GOOD: @use with namespace
@use 'variables' as v;
@use 'mixins' as m;

.button {
  color: v.$color-primary;
  @include m.flex-center;
}

// GOOD: @forward for re-exporting
// _index.scss
@forward 'variables';
@forward 'mixins';
```

---

## Specificity

### Avoid Deep Nesting

```scss
// BLOCKING: deep nesting creates high specificity and fragile selectors
.dashboard {
  .sidebar {
    .nav {
      ul {
        li {
          a {
            color: blue;  // 6 levels deep
          }
        }
      }
    }
  }
}

// GOOD: flat BEM structure
.nav__link {
  color: $color-link;
}

// GOOD: max 3 levels of nesting for state/pseudo
.camera-card {
  &:hover {
    .camera-card__title {
      color: $color-primary;
    }
  }
}
```

Rule: max 3 levels of nesting. Flag anything deeper.

### Avoid !important

```scss
// BLOCKING: !important used to override specificity
.button {
  color: red !important;
}

// Acceptable only: utility override classes and third-party overrides
.u-hidden { display: none !important; }  // utility: acceptable
```

Flag every `!important` outside of utility classes. It signals a specificity problem that needs a structural fix.

### ID Selectors

```scss
// IMPORTANT: ID selectors have very high specificity
#submit-button {
  background: blue;
}

// GOOD: use class
.submit-button {
  background: $color-primary;
}
```

Flag ID selectors used for styling. IDs are for JavaScript hooks and anchor links, not CSS.

---

## Responsive Design

### Mobile First

```scss
// IMPORTANT: desktop-first adds complexity
.container {
  width: 1200px;

  @media (max-width: 768px) {
    width: 100%;
  }
}

// GOOD: mobile-first, add complexity upward
.container {
  width: 100%;
  padding: 0 $spacing-md;

  @media (min-width: 768px) {
    max-width: 960px;
    margin: 0 auto;
  }

  @media (min-width: 1200px) {
    max-width: 1200px;
  }
}
```

### Breakpoints as Variables

```scss
// IMPORTANT: magic numbers in media queries
@media (max-width: 768px) { }
@media (min-width: 1024px) { }

// GOOD: breakpoint variables or map
$breakpoints: (
  'sm': 576px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px,
);

@mixin respond-to($breakpoint) {
  $value: map.get($breakpoints, $breakpoint);
  @media (min-width: $value) {
    @content;
  }
}

.container {
  @include respond-to('md') {
    max-width: 960px;
  }
}
```

---

## Layout

### Flexbox

```scss
// GOOD: flexbox for one-dimensional layouts
.nav {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}
```

### Grid

```scss
// GOOD: grid for two-dimensional layouts
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-lg;
}

.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 250px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
```

### Avoid Absolute Positioning for Layout

```scss
// IMPORTANT: absolute positioning for page layout is fragile
.sidebar {
  position: absolute;
  left: 0;
  top: 60px;
  width: 250px;
}

// GOOD: use grid or flex for layout
// absolute is fine for overlays, tooltips, dropdowns
.tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}
```

---

## Typography

### Relative Units

```scss
// IMPORTANT: px for font sizes prevents user zoom
body {
  font-size: 16px;
}

h1 {
  font-size: 32px;
}

// GOOD: rem for font sizes (relative to root, respects user settings)
:root {
  font-size: 16px;  // 1rem = 16px
}

h1 { font-size: 2rem; }      // 32px
h2 { font-size: 1.5rem; }    // 24px
body { font-size: 1rem; }    // 16px
small { font-size: 0.875rem; }

// GOOD: em for component-relative spacing
.button {
  padding: 0.5em 1em;  // scales with button's font-size
}
```

### Line Height

```scss
// IMPORTANT: px line-height breaks on font-size changes
p {
  line-height: 24px;
}

// GOOD: unitless line-height (multiplied by element's font-size)
p {
  line-height: 1.5;
}
```

---

## Color and Theming

### CSS Custom Properties (Variables)

```scss
// GOOD: CSS custom properties enable runtime theming
:root {
  --color-primary: #1a73e8;
  --color-background: #ffffff;
  --color-text: #202124;
}

// SCSS variables compile away; CSS custom properties survive
.button {
  background-color: var(--color-primary);
  color: var(--color-background);
}

// Dark mode with custom properties
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1a1a2e;
    --color-text: #e0e0e0;
  }
}
```

### Contrast Ratios

Flag colors that likely fail WCAG AA (4.5:1 for normal text, 3:1 for large text):

```scss
// IMPORTANT: light grey on white (low contrast)
.hint-text {
  color: #aaaaaa;  // ~2.3:1 on white - fails AA
}

// GOOD: sufficient contrast
.hint-text {
  color: #767676;  // 4.5:1 on white - passes AA
}
```

---

## Animations and Transitions

### Respect User Preferences

```scss
// GOOD: disable animations for users who prefer reduced motion
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Flag any file with animations or transitions that does not include this media query check.

### Performance-Safe Properties

```scss
// IMPORTANT: animating layout-triggering properties causes repaints
.element {
  transition: width 0.3s, height 0.3s, margin 0.3s;  // forces layout recalc
}

// GOOD: animate transform and opacity only (GPU composited)
.element {
  transition: transform 0.3s, opacity 0.3s;
}

.element--hidden {
  opacity: 0;
  transform: translateY(-8px);
}
```

---

## Maintainability

### Mixins for Repeated Patterns

```scss
// IMPORTANT: copy-pasted vendor prefix blocks
.button {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.card {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

// GOOD: mixin
@mixin no-select {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
}

.button { @include no-select; }
.card { @include no-select; }
```

### Dead CSS

Flag:
- Class names defined in CSS that do not appear in any template file
- Commented-out blocks of rules that were never removed
- Overridden properties in the same rule block

```scss
// IMPORTANT: overridden property in same block
.button {
  color: red;
  color: blue;  // first declaration is dead
}
```

---

## Review Checklist

- [ ] BEM naming or consistent utility system (not mixed ad-hoc)
- [ ] No hardcoded colors outside variable definitions
- [ ] No magic number values: use variables for spacing, colors, border-radius
- [ ] Nesting max 3 levels
- [ ] No `!important` outside utility classes
- [ ] No ID selectors for styling
- [ ] Mobile-first responsive design (min-width queries)
- [ ] Breakpoints defined as variables or map
- [ ] Font sizes in `rem` not `px`
- [ ] Line height unitless
- [ ] CSS custom properties used for theme values
- [ ] `@use` not `@import` (SCSS)
- [ ] Animations on `transform` and `opacity` only
- [ ] `prefers-reduced-motion` media query present for animated files
- [ ] No copy-pasted vendor prefix blocks: use mixins
- [ ] No dead/overridden CSS rules
