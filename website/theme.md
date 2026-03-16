# Sonar IDE Website Color Palette

Here is the complete color palette for the Sonar IDE website's blue theme, using Tailwind CSS v4 conventions mixed with custom Vercel/Linear-inspired dark mode hex codes.

## 🟢 Primary Accent Colors (The "Sonar Blue")
These are used for buttons, links, active states, and glowing gradients.

*   **Primary Base:** `blue-500` (`#3b82f6`) - *Used for badges, pulses, and dark mode buttons.*
*   **Action Default (Light):** `blue-600` (`#2563eb`) - *Used for primary buttons and text emphasis in light mode.*
*   **Action Hover (Light):** `blue-700` (`#1d4ed8`) - *Used for hover states on primary buttons.*
*   **Secondary/Gradient Transition:** `cyan-500` (`#06b6d4`) - *Replaced indigo; used alongside blue to create that smooth shiny gradient on the hero text ('Strictly supervised.').*

## 🌙 Dark Mode Theme (Native App Match)
Pulled from `global.css` to match the exact aesthetic of the Sonar Electron app.

*   **Main Background:** `#09090b` (Extremely dark zinc/black) - *The absolute background canvas.*
*   **Surface/Card Background:** `#121214` or `white/[0.02]` - *Used for the feature cards and dashboard preview panels.*
*   **Borders & Dividers:** `white/5` to `white/10` (Translucent white) - *Creates subtle depth without harsh gray lines.*
*   **Primary Text:** `white` (`#ffffff`) - *Used for headings.*
*   **Secondary Text:** `zinc-400` (`#a1a1aa`) - *Used for paragraphs and descriptions.*
*   **Subtle Highlights:** `blue-500/10` - *Used for the glowing background behind icons.*

## ☀️ Light Mode Theme (Clean & Crisp)
A high-contrast, universally accessible mode complementing the blue aesthetic.

*   **Main Background:** `white` (`#ffffff`) - *The primary canvas.*
*   **Surface/Section Background:** `zinc-50` (`#fafafa`) to `zinc-100` (`#f4f4f5`) - *Used for alternating sections or feature cards.*
*   **Borders & Dividers:** `zinc-200` (`#e4e4e7`) - *Clean, soft borders matching standard modern UI trends.*
*   **Primary Text:** `zinc-900` (`#18181b`) - *Used for heavy contrast headings.*
*   **Secondary Text:** `zinc-600` (`#52525b`) - *Used for readable paragraph text.*
*   **Subtle Highlights:** `blue-50` (`#eff6ff`) - *Used for soft badge backgrounds.* 

---
*Generated for the Sonar-Code-Editor SvelteKit documentation site.*