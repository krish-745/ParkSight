---
name: Tactical Utility System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  sidebar-width: 260px
---

## Brand & Style

This design system is engineered for high-stakes, high-density environments where clarity and speed of information processing are paramount. The aesthetic is **Corporate Modern** with a lean toward **Minimalism**, stripping away decorative elements in favor of functional precision. 

The system prioritizes structural integrity and high performance, mimicking the reliability of enterprise-grade developer tools. It avoids visual fatigue through a restrained palette and systematic alignment, ensuring that law enforcement personnel can navigate complex traffic data, incident reports, and real-time alerts without cognitive overhead. The emotional response is one of authority, stability, and surgical efficiency.

## Colors

The color strategy utilizes a **Slate-Zinc Dark Mode** to reduce screen glare during night shifts while maintaining high contrast for daytime visibility. 

- **Primary Interface Framework**: Built on deep navy-grays (`#0f172a`) and zinc surfaces (`#18181b`) to create a sophisticated, non-distracting backdrop.
- **Primary Action**: Professional Blue (`#3b82f6`) is reserved strictly for primary calls-to-action and active navigation states.
- **Semantic Logic**: 
  - **Red**: Immediate threats, critical violations, or stopped vehicles.
  - **Amber**: Warnings, pending status, or approaching limits.
  - **Green**: Online systems, cleared status, or active flow.
- **Borders**: Elements are separated by a consistent 1px Slate border (`#334155`) rather than shadows to maintain a flat, technical appearance.

## Typography

The system uses **Inter** for all UI elements to ensure maximum legibility across different display resolutions. 

- **Data Strings**: License plates, VINs, GPS coordinates, and timestamps must use **JetBrains Mono**. This prevents character confusion (e.g., '0' vs 'O', '1' vs 'l') which is critical for law enforcement accuracy.
- **Hierarchy**: Use `label-caps` for section headers in sidebars and table headers to create clear structural boundaries.
- **Density**: Body text is set primarily at 14px (`body-md`) to allow for high information density without sacrificing readability.

## Layout & Spacing

The layout follows a **Fluid Grid** model designed for high-density dashboards. 

- **Grid System**: A 12-column grid is used for the main content area, while the primary navigation is housed in a fixed 260px left sidebar.
- **Tight Rhythm**: A 4px baseline grid ensures tight vertical rhythm. Internal component padding should favor 8px (`sm`) and 12px increments to keep elements compact.
- **Breakpoints**: 
  - **Desktop (1280px+)**: Full 12-column display with visible sidebar.
  - **Tablet (768px - 1279px)**: Sidebar collapses to icons; grid shifts to 6 columns.
  - **Mobile (<767px)**: Stacked layout; full-width cards; bottom navigation bar for primary actions.

## Elevation & Depth

In alignment with a professional utility aesthetic, this design system eschews heavy drop shadows. 

- **Low-Contrast Outlines**: Hierarchy is established through 1px solid borders (`#334155`). Surfaces use slight tonal variations—primary backgrounds are `#0f172a`, while elevated cards or modals use `#18181b`.
- **Tonal Layers**: Use "Surface-on-Surface" styling. A container might be 1 shade lighter than the background it sits on to denote focus.
- **State Changes**: On hover, borders should brighten to `#475569`. Active focus states on inputs use a subtle 2px outer glow of the primary blue at 20% opacity.

## Shapes

The shape language is disciplined and "Medium-Soft." 

- **Radius**: All standard components (buttons, inputs, cards) use a **6px (0.375rem)** radius. This provides a modern, balanced look that is more approachable than sharp corners but feels more "professional" and "tooled" than pill-shaped elements.
- **Consistency**: Large containers like sidebars or main panels should maintain the same radius or remain sharp where they meet the screen edge.

## Components

- **Buttons**: Primary buttons are solid `#3b82f6` with white text. Secondary buttons use a transparent background with a 1px slate border. Use `body-sm` bold for button labels.
- **Input Fields**: Backgrounds must be darker than the container surface. Use a 1px border. Placeholder text should be `#64748b`.
- **Data Tables**: The core of the application. Use `body-sm` for rows. Rows should have a subtle hover state (`#1e293b`). Use **JetBrains Mono** for license plate columns.
- **Chips/Badges**: Use "Subtle" styling—lightly tinted backgrounds with high-contrast text (e.g., a dark red background with bright red text for "High Speed Alert").
- **Status Indicators**: Small 8px circles. Use the semantic color palette. Use a "pulsing" animation only for "Critical" alerts.
- **Cards**: Minimalist containers. No shadow. 1px border. 16px internal padding. Headers within cards should have a subtle bottom border to separate controls from data.