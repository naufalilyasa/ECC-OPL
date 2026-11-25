---
name: a11y
description: "Comprehensive accessibility skill across 3 modes: (1) Audit & Tooling (automated WCAG 2.2 scanning, contrast checks, CI/CD), (2) Concepts & Cross-Platform (POUR principles, iOS SwiftUI, Android Compose, Web ARIA mapping), and (3) Frontend Code Patterns (accessible React/Next.js forms, modals, keyboard navigation, focus management). Use when auditing accessibility, fixing a11y violations, checking contrast, or building accessible UI across Web, iOS, or Android."
---

# Accessibility (a11y) — WCAG 2.2 Complete Toolkit

A unified accessibility skill covering auditing, cross-platform architecture, and practical frontend implementation patterns.

## Choose Your Mode

| Mode | Use When | Primary Action |
|---|---|---|
| **Mode 1: Audit & Tooling** | Scanning a codebase, checking color contrast, CI/CD gate, generating compliance reports | Run `a11y_scanner.py` or `contrast_checker.py` |
| **Mode 2: Concepts & Cross-Platform** | Designing UI architecture, multi-platform apps (Web + iOS + Android), WCAG 2.2 POUR standards | Apply cross-platform semantics & POUR checklist |
| **Mode 3: Frontend Code Patterns** | Writing or refactoring React/Next.js components (forms, modals, dropdowns, keyboard navigation, focus trap) | Copy & adapt production-ready code patterns |

---

## Mode 1: Audit & Tooling (Scan, Fix, Verify)

### Three-Phase Workflow

1. **Scan**: Walk source tree, auto-detect framework, classify by severity.
   ```bash
   python scripts/a11y_scanner.py /path/to/project --format table
   python scripts/a11y_scanner.py /path/to/project --json
   ```
2. **Fix**: Apply framework-specific fixes for each violation (see `references/framework-a11y-patterns.md`).
3. **Verify**: Re-run against baseline to confirm zero regressions.
   ```bash
   python scripts/a11y_scanner.py /path/to/project --baseline audit-baseline.json
   ```

### Color Contrast Checker

```bash
# Check specific hex pair against AA (4.5:1) and AAA (7:1)
python scripts/contrast_checker.py --fg "#777777" --bg "#ffffff"

# Scan entire CSS/Tailwind stylesheet for contrast issues
python scripts/contrast_checker.py --file /path/to/styles.css --suggest
```

### Severity SLA

- **Critical** (blocks access: missing alt on informational img, no keyboard access): Fix before release.
- **Major** (degrades experience: insufficient contrast, unlinked form labels): Fix in current sprint.
- **Minor** (friction: redundant ARIA roles, skipped heading levels): Fix within 2 sprints.

---

## Mode 2: Core Concepts & Cross-Platform Architecture

Digital interfaces must be **POUR**: Perceivable, Operable, Understandable, and Robust.

### Cross-Platform Semantic Mapping

| Feature | Web (HTML / WAI-ARIA) | iOS (SwiftUI) | Android (Jetpack Compose) |
|---|---|---|---|
| **Primary Label** | `aria-label` / `<label htmlFor>` | `.accessibilityLabel("...")` | `Modifier.semantics { contentDescription = "..." }` |
| **Secondary Hint** | `aria-describedby` | `.accessibilityHint("...")` | `Modifier.semantics { stateDescription = "..." }` |
| **Action Role** | `<button>` or `role="button"` | `.accessibilityAddTraits(.isButton)` | `Modifier.semantics { role = Role.Button }` |
| **Live Updates** | `aria-live="polite"` | `.accessibilityLiveRegion(.polite)` | `Modifier.semantics { liveRegion = LiveRegionMode.Polite }` |
| **Target Size** | Minimum 24×24px (WCAG 2.2 SC 2.5.8) | Minimum 44×44pt (Apple HIG) | Minimum 48×48dp (Material) |
| **Focus Indicator** | Visible outline (`:focus-visible`) | Native accessibility cursor | Focus indication state |

### Anti-Patterns to Avoid

- **Div-Buttons**: `<div onClick>` without `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space.
- **Color-Only Meaning**: Indicating error/success purely by border or text color without icons or text messages.
- **Uncontained Modal Focus**: Background content remaining focusable while a modal dialog is active. Focus must be trapped inside and escapable with `Escape`.

---

## Mode 3: Frontend Implementation Patterns (React / Next.js)

### 1. Fully Accessible Form

```tsx
export function LoginForm({ onSubmit }: { onSubmit: (data: LoginData) => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : undefined}
          autoComplete="email"
        />
        {error && (
          <span id="email-error" role="alert" className="error-text">
            {error}
          </span>
        )}
      </div>
      <button type="submit">Sign In</button>
    </form>
  );
}
```

### 2. Modal Focus Restoration & Trap

```tsx
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
      <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
    </div>
  );
}
```

### 3. Keyboard-Navigable Dropdown / Combobox

```tsx
export function Dropdown({ options, onSelect }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) onSelect(options[activeIndex]);
        setIsOpen(prev => !prev);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={listId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setIsOpen(prev => !prev)}
    >
      <span>{options[activeIndex]}</span>
      {isOpen && (
        <ul id={listId} role="listbox">
          {options.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => { onSelect(opt); setIsOpen(false); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 4. Reduced Motion Hook

```tsx
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
```

---

## Detailed References

All deep domain documentation is stored in `references/`:

| Reference | Topic |
|---|---|
| `references/cross-platform-concepts.md` | Full POUR breakdown, architecture diagram, SwiftUI/Compose code |
| `references/react-nextjs-patterns.md` | Comprehensive React/Next.js accessibility pattern catalog |
| `references/framework-a11y-patterns.md` | Fix patterns for Vue, Angular, Svelte, and plain HTML |
| `references/wcag-quick-ref.md` | Complete WCAG 2.2 Level A & AA criteria reference |
| `references/wcag-22-new-criteria.md` | New WCAG 2.2 criteria (Focus Appearance, Target Size Minimum, Redundant Entry) |
| `references/aria-patterns.md` | ARIA roles, states, live regions, and combobox 1.2 patterns |
| `references/color-contrast-guide.md` | Contrast calculations, APCA vs WCAG, Tailwind palette audits |
| `references/ci-cd-integration.md` | GitHub Actions, GitLab CI, Azure DevOps pipelines |
| `references/testing-checklist.md` | Manual testing checklist (keyboard, screen reader, zoom 400%) |
| `references/audit-report-template.md` | Stakeholder-ready compliance audit report markdown template |
| `references/examples-by-framework.md` | Before/after audit diffs for React, Vue, Next.js, and Svelte |
