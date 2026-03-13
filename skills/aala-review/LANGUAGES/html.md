# HTML

Reference for code review. Apply to all `.html`, `.hbs` (Handlebars), `.jinja`, `.ejs`, `.jsx`, `.tsx` files that produce markup.

---

## Structure and Semantics

### Semantic Elements

Use the right HTML element for the job. Semantic HTML improves accessibility, SEO, and maintainability.

```html
<!-- IMPORTANT: div soup - no semantic meaning -->
<div class="header">
  <div class="nav">
    <div class="nav-item">Home</div>
  </div>
</div>
<div class="main-content">
  <div class="article">
    <div class="title">Post Title</div>
  </div>
</div>
<div class="footer"></div>

<!-- GOOD: semantic HTML -->
<header>
  <nav>
    <a href="/">Home</a>
  </nav>
</header>
<main>
  <article>
    <h1>Post Title</h1>
  </article>
</main>
<footer></footer>
```

| Wrong | Correct use case |
|-------|-----------------|
| `<div>` for navigation | `<nav>` |
| `<div>` for page header | `<header>` |
| `<div>` for main content | `<main>` |
| `<div>` for article/post | `<article>` |
| `<div>` for sidebar | `<aside>` |
| `<div>` for section | `<section>` |
| `<div>` for page footer | `<footer>` |
| `<br>` for spacing | CSS `margin` / `padding` |
| `<b>` for emphasis | `<strong>` or `<em>` |
| `<i>` for emphasis | `<em>` |
| `<table>` for layout | CSS Grid or Flexbox |

### Heading Hierarchy

```html
<!-- BLOCKING: skipping heading levels -->
<h1>Page Title</h1>
<h3>Section</h3>  <!-- skipped h2 -->

<!-- IMPORTANT: multiple h1 on a page (outside landmark regions) -->
<h1>Title</h1>
<h1>Another Title</h1>

<!-- GOOD: one h1, sequential hierarchy -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Another Section</h2>
```

---

## Security

### XSS Prevention

```html
<!-- BLOCKING: unescaped user content in template -->
<!-- Jinja2 -->
<div>{{ user.bio | safe }}</div>

<!-- Handlebars -->
<div>{{{user.bio}}}</div>

<!-- ERB -->
<div><%== user.bio %></div>

<!-- GOOD: escaped output (default in most templating engines) -->
<!-- Jinja2: autoescaping enabled -->
<div>{{ user.bio }}</div>

<!-- Handlebars: double curly -->
<div>{{user.bio}}</div>
```

Flag any template that disables autoescaping or uses "raw" / "safe" / triple-curly output with user-controlled data.

### Content Security Policy

```html
<!-- BLOCKING: inline scripts (prevents CSP) -->
<script>
  var userId = {{ user.id }};
</script>

<button onclick="doSomething()">Click</button>

<!-- GOOD: external scripts, event listeners in JS files -->
<script src="/app.js"></script>
<!-- JS file attaches event listeners -->
```

Flag any `onclick`, `onload`, `onerror`, or other inline event handlers. They block a strict CSP.

### External Resources

```html
<!-- IMPORTANT: loading from external CDN without integrity check -->
<script src="https://cdn.jsdelivr.net/npm/jquery/dist/jquery.min.js"></script>

<!-- GOOD: Subresource Integrity (SRI) -->
<script
  src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"
  integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
  crossorigin="anonymous">
</script>
```

### Open Redirect via meta refresh

```html
<!-- BLOCKING: meta refresh to user-controlled URL -->
<meta http-equiv="refresh" content="0; url={{ redirect_url }}">
```

---

## Accessibility

### Images

```html
<!-- BLOCKING: missing alt attribute -->
<img src="camera-feed.jpg">

<!-- GOOD: descriptive alt text -->
<img src="camera-feed.jpg" alt="Live camera feed from warehouse entrance">

<!-- GOOD: decorative image, empty alt -->
<img src="decoration.png" alt="">
```

Flag every `<img>` without an `alt` attribute.

### Form Labels

```html
<!-- BLOCKING: input without label -->
<input type="text" placeholder="Enter email">

<!-- GOOD: label with for/id pairing -->
<label for="email">Email address</label>
<input type="email" id="email" name="email">

<!-- GOOD: label wrapping input -->
<label>
  Email address
  <input type="email" name="email">
</label>

<!-- ACCEPTABLE: aria-label when visual label not appropriate -->
<input type="search" aria-label="Search cameras" name="q">
```

### Buttons and Links

```html
<!-- BLOCKING: div used as button -->
<div onclick="submit()">Submit</div>

<!-- GOOD: use button element (keyboard accessible, ARIA role built-in) -->
<button type="submit">Submit</button>

<!-- BLOCKING: link with no meaningful text -->
<a href="/report">Click here</a>

<!-- GOOD: descriptive link text -->
<a href="/report">Download monthly report</a>

<!-- BLOCKING: button with icon only, no accessible label -->
<button><svg>...</svg></button>

<!-- GOOD: aria-label for icon buttons -->
<button aria-label="Close dialog"><svg>...</svg></button>
```

### Keyboard Navigation

```html
<!-- IMPORTANT: tabindex > 0 overrides natural order, confusing keyboard users -->
<div tabindex="5">...</div>

<!-- GOOD: tabindex="0" adds to natural order -->
<div tabindex="0" role="button">...</div>

<!-- GOOD: tabindex="-1" removes from tab order (but focusable via JS) -->
<div tabindex="-1" id="modal-content">...</div>
```

### ARIA

```html
<!-- IMPORTANT: redundant ARIA role -->
<button role="button">Submit</button>  <!-- button already has this role -->
<nav role="navigation">...</nav>       <!-- nav already has this role -->

<!-- GOOD: ARIA only when semantic element not available -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Delete</h2>
</div>

<!-- GOOD: live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true" id="status-message"></div>
```

---

## Forms

### Input Types

```html
<!-- IMPORTANT: using text input when specific type available -->
<input type="text" name="email">
<input type="text" name="phone">
<input type="text" name="date">

<!-- GOOD: use specific types (mobile keyboards, browser validation) -->
<input type="email" name="email">
<input type="tel" name="phone">
<input type="date" name="date">
<input type="number" name="age" min="0" max="120">
<input type="url" name="website">
<input type="password" name="password" autocomplete="current-password">
```

### Form Validation Attributes

```html
<!-- GOOD: browser-native validation as first layer -->
<input
  type="email"
  name="email"
  required
  maxlength="255"
  autocomplete="email"
>

<input
  type="password"
  name="password"
  required
  minlength="8"
  autocomplete="new-password"
>
```

Browser validation is not a substitute for server-side validation. Flag any form that relies only on HTML attributes without server validation.

### CSRF Protection

```html
<!-- GOOD: CSRF token in forms that mutate state -->
<form method="POST" action="/users/delete">
  <input type="hidden" name="_csrf" value="{{ csrf_token }}">
  <button type="submit">Delete</button>
</form>

<!-- IMPORTANT: GET forms that mutate state -->
<form method="GET" action="/users/delete">  <!-- GET must never mutate -->
```

---

## Performance

### Resource Loading

```html
<!-- GOOD: preload critical resources -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preload" href="/images/hero.jpg" as="image">

<!-- GOOD: defer non-critical scripts -->
<script src="/analytics.js" defer></script>
<script src="/app.js" defer></script>

<!-- IMPORTANT: blocking script in head -->
<head>
  <script src="/app.js"></script>  <!-- blocks rendering -->
</head>

<!-- GOOD: scripts at end of body or with defer/async -->
<script src="/app.js" defer></script>
```

### Images

```html
<!-- IMPORTANT: missing width/height causes layout shift (CLS) -->
<img src="photo.jpg" alt="...">

<!-- GOOD: explicit dimensions prevent layout shift -->
<img src="photo.jpg" alt="..." width="800" height="600">

<!-- GOOD: lazy loading for below-fold images -->
<img src="photo.jpg" alt="..." width="800" height="600" loading="lazy">

<!-- GOOD: responsive images -->
<img
  src="photo.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="..."
  width="800"
  height="600"
>

<!-- GOOD: modern format with fallback -->
<picture>
  <source srcset="photo.webp" type="image/webp">
  <img src="photo.jpg" alt="..." width="800" height="600">
</picture>
```

---

## Document Structure

### Required Meta Tags

```html
<!-- BLOCKING: missing charset -->
<!-- BLOCKING: missing viewport (mobile unusable) -->
<!-- GOOD: complete document structure -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <meta name="description" content="Page description">
</head>
<body>
  ...
</body>
</html>
```

Flag any HTML document missing `charset`, `viewport`, or `lang` on `<html>`.

### Language Attribute

```html
<!-- IMPORTANT: missing lang attribute (screen readers default to wrong language) -->
<html>

<!-- GOOD -->
<html lang="en">

<!-- GOOD: specific dialect -->
<html lang="en-US">
<html lang="ar" dir="rtl">
```

---

## Review Checklist

- [ ] Semantic elements used (no div soup)
- [ ] One `h1` per page, sequential heading hierarchy
- [ ] No template "safe" / triple-curly with user content
- [ ] No inline event handlers (`onclick`, etc.)
- [ ] External CDN scripts have SRI integrity hashes
- [ ] Every `<img>` has `alt` attribute
- [ ] Every `<input>` has an associated `<label>`
- [ ] No `<div onclick>` instead of `<button>`
- [ ] Link text is descriptive (not "click here")
- [ ] Forms mutating state use POST with CSRF token
- [ ] Scripts loaded with `defer` or at end of body
- [ ] Images have `width` and `height` attributes
- [ ] Document has `charset`, `viewport`, and `lang`
- [ ] ARIA used only where native semantics are insufficient
