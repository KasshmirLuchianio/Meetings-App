{
  "product": {
    "name": "GAL MEETINGS",
    "type": "mobile-first PWA",
    "audience": "Echipe de teren (GAL) în localități rurale; utilizare outdoor, uneori cu mănuși; nevoie de UI instant și robust.",
    "brand_attributes": [
      "profesional",
      "de încredere",
      "rapid",
      "clar în lumină puternică",
      "offline-tolerant"
    ],
    "language": "ro-RO"
  },
  "visual_personality": {
    "style_fusion": [
      "Enterprise mobile (claritate + densitate redusă)",
      "Bento/card layout pentru întâlniri",
      "Instrument-panel micro UI (timer, status chips, offline banner)",
      "Soft glass (doar pe suprafețe mici) + solid surfaces pentru lizibilitate"
    ],
    "do_not": [
      "Nu folosi layout centrat global.",
      "Nu folosi gradienturi saturate/dark (vezi regula de gradient).",
      "Nu micșora touch targets sub 48px; preferat 56px pentru acțiuni primare.",
      "Nu ascunde statusurile (offline/procesare) în meniuri; trebuie să fie glanceable."
    ]
  },
  "design_tokens": {
    "css_custom_properties": {
      "notes": "Actualizează /app/frontend/src/index.css tokens shadcn (HSL) + adaugă tokens custom pentru recorder/status. Păstrează compatibilitatea cu shadcn/ui.",
      "light": {
        "--background": "210 40% 98%",
        "--foreground": "222 47% 11%",
        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",
        "--primary": "204 80% 34%",
        "--primary-foreground": "210 40% 98%",
        "--secondary": "210 30% 94%",
        "--secondary-foreground": "222 47% 11%",
        "--muted": "210 30% 94%",
        "--muted-foreground": "215 16% 35%",
        "--accent": "174 45% 92%",
        "--accent-foreground": "222 47% 11%",
        "--destructive": "0 72% 50%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "214 20% 88%",
        "--input": "214 20% 88%",
        "--ring": "204 80% 34%",
        "--radius": "0.9rem",
        "--chart-1": "204 80% 34%",
        "--chart-2": "174 55% 34%",
        "--chart-3": "43 90% 55%",
        "--chart-4": "0 72% 50%",
        "--chart-5": "215 16% 35%",
        "--gal-surface": "0 0% 100%",
        "--gal-surface-2": "210 30% 96%",
        "--gal-shadow": "0 0% 0% / 0.08",
        "--gal-focus": "204 80% 34%",
        "--gal-success": "160 60% 30%",
        "--gal-warning": "38 92% 45%",
        "--gal-info": "204 80% 34%",
        "--gal-danger": "0 72% 50%",
        "--gal-offline": "18 85% 45%"
      },
      "dark": {
        "--background": "222 30% 8%",
        "--foreground": "210 40% 98%",
        "--card": "222 28% 10%",
        "--card-foreground": "210 40% 98%",
        "--popover": "222 28% 10%",
        "--popover-foreground": "210 40% 98%",
        "--primary": "204 85% 60%",
        "--primary-foreground": "222 30% 8%",
        "--secondary": "222 18% 16%",
        "--secondary-foreground": "210 40% 98%",
        "--muted": "222 18% 16%",
        "--muted-foreground": "215 20% 70%",
        "--accent": "174 30% 18%",
        "--accent-foreground": "210 40% 98%",
        "--destructive": "0 62% 45%",
        "--destructive-foreground": "210 40% 98%",
        "--border": "222 18% 18%",
        "--input": "222 18% 18%",
        "--ring": "204 85% 60%",
        "--radius": "0.9rem",
        "--chart-1": "204 85% 60%",
        "--chart-2": "174 55% 45%",
        "--chart-3": "43 90% 60%",
        "--chart-4": "0 62% 45%",
        "--chart-5": "215 20% 70%",
        "--gal-surface": "222 28% 10%",
        "--gal-surface-2": "222 18% 14%",
        "--gal-shadow": "0 0% 0% / 0.35",
        "--gal-focus": "204 85% 60%",
        "--gal-success": "160 55% 45%",
        "--gal-warning": "38 92% 55%",
        "--gal-info": "204 85% 60%",
        "--gal-danger": "0 62% 45%",
        "--gal-offline": "18 85% 55%"
      },
      "spacing": {
        "--space-1": "0.25rem",
        "--space-2": "0.5rem",
        "--space-3": "0.75rem",
        "--space-4": "1rem",
        "--space-5": "1.25rem",
        "--space-6": "1.5rem",
        "--space-8": "2rem",
        "--space-10": "2.5rem"
      },
      "shadows": {
        "--shadow-soft": "0 10px 30px hsl(var(--gal-shadow))",
        "--shadow-card": "0 6px 18px hsl(var(--gal-shadow))",
        "--shadow-fab": "0 14px 40px hsl(var(--gal-shadow))"
      },
      "touch_targets": {
        "--tap": "56px",
        "--tap-sm": "48px"
      }
    },
    "gradients_and_texture": {
      "allowed_usage": "Doar ca accent decorativ în header/hero (max 20% viewport) sau ca overlay subtil în ecranul de înregistrare (în spatele waveform).",
      "safe_gradients": [
        "linear-gradient(135deg, hsl(204 80% 96%), hsl(174 45% 94%), hsl(210 40% 98%))",
        "linear-gradient(180deg, hsl(210 40% 98%), hsl(210 30% 96%))"
      ],
      "noise_overlay": {
        "instruction": "Adaugă un pseudo-element cu noise PNG/SVG foarte subtil (opacity 0.04–0.06) doar pe background, nu pe carduri.",
        "tailwind_example": "relative before:absolute before:inset-0 before:bg-[url('/noise.png')] before:opacity-[0.05] before:pointer-events-none"
      }
    }
  },
  "typography": {
    "font_pairing": {
      "heading": "Space Grotesk (600–700)",
      "body": "Inter (400–600)",
      "mono": "Roboto Mono (timer, timestamps)"
    },
    "implementation": {
      "google_fonts": [
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap"
      ],
      "css": {
        "body": "font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;",
        "headings": "font-family: 'Space Grotesk', Inter, system-ui;",
        "mono": "font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;"
      }
    },
    "text_size_hierarchy": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm sm:text-base",
      "small": "text-xs sm:text-sm"
    },
    "romanian_copy_tone": {
      "principles": [
        "verbe scurte",
        "statusuri explicite",
        "fără jargon AI în UI (spune 'Rezumat' nu 'LLM output')"
      ],
      "labels": {
        "record": "Înregistrează",
        "stop": "Oprește",
        "pause": "Pauză",
        "resume": "Continuă",
        "processing": "Se procesează",
        "pending": "În așteptare",
        "done": "Gata",
        "error": "Eroare",
        "offline": "Offline — salvat local",
        "online": "Online — sincronizat"
      }
    }
  },
  "layout_and_grid": {
    "mobile_first_breakpoints": {
      "primary": "320–428px",
      "tablet": "768px+ (secondary)"
    },
    "app_shell": {
      "top_app_bar": {
        "height": "56px",
        "content": "Titlu pagină + buton meniu (drawer) + toggle dark/light + indicator offline",
        "tailwind": "sticky top-0 z-40 bg-background/90 backdrop-blur border-b"
      },
      "bottom_safe_area": {
        "instruction": "Respectă safe-area pe iOS pentru butonul de înregistrare și bottom sheets.",
        "tailwind": "pb-[calc(env(safe-area-inset-bottom)+16px)]"
      }
    },
    "content_width": {
      "instruction": "Nu centra containerul global; folosește max-w pentru lizibilitate doar pe tablet/desktop.",
      "tailwind": "mx-auto w-full max-w-md md:max-w-2xl"
    },
    "spacing": {
      "rule": "2–3x mai mult spațiu decât pare necesar; listele trebuie să respire.",
      "defaults": {
        "section_padding": "px-4 py-4",
        "card_gap": "gap-3",
        "list_item_padding": "p-4"
      }
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "notes": "Pentru navigație pe mobil: preferă Sheet (drawer) sau Drawer. Pentru filtre/search: Command (command palette) poate fi folosit ca search modal."
    },
    "buttons": {
      "style": "Professional / Corporate cu radius 10–14px (dar touch target mare).",
      "sizes": {
        "primary_fab": {
          "height": "var(--tap)",
          "min_width": "var(--tap)",
          "tailwind": "h-14 w-14 rounded-full"
        },
        "primary_full": {
          "height": "var(--tap)",
          "tailwind": "h-14 w-full rounded-xl"
        },
        "secondary": {
          "height": "var(--tap-sm)",
          "tailwind": "h-12 rounded-xl"
        }
      },
      "micro_interactions": {
        "hover": "desktop only: ușor darken + shadow-card",
        "press": "scale-[0.98] + shadow reduce",
        "disabled": "opacity-50 + cursor-not-allowed",
        "focus": "ring-2 ring-[hsl(var(--gal-focus))] ring-offset-2"
      },
      "data_testid_examples": [
        "data-testid=\"record-start-button\"",
        "data-testid=\"record-stop-button\"",
        "data-testid=\"meeting-export-pdf-button\"",
        "data-testid=\"meeting-export-docx-button\""
      ]
    },
    "status_system": {
      "status_chips": {
        "component": "Badge",
        "variants": {
          "pending": {
            "label": "În așteptare",
            "classes": "bg-secondary text-secondary-foreground border"
          },
          "processing": {
            "label": "Se procesează",
            "classes": "bg-[hsl(var(--gal-info))]/10 text-[hsl(var(--gal-info))] border border-[hsl(var(--gal-info))]/20"
          },
          "done": {
            "label": "Gata",
            "classes": "bg-[hsl(var(--gal-success))]/10 text-[hsl(var(--gal-success))] border border-[hsl(var(--gal-success))]/20"
          },
          "error": {
            "label": "Eroare",
            "classes": "bg-[hsl(var(--gal-danger))]/10 text-[hsl(var(--gal-danger))] border border-[hsl(var(--gal-danger))]/20"
          }
        },
        "placement": "În cardul întâlnirii (dreapta sus) + în header-ul detaliului."
      },
      "offline_indicator": {
        "pattern": "Banner sticky sub top bar: 'Offline — salvat local' cu icon + buton mic 'Detalii'. Auto-hide când revine online.",
        "tailwind": "sticky top-[56px] z-30 px-4 py-2 text-sm bg-[hsl(var(--gal-offline))]/10 text-[hsl(var(--gal-offline))] border-b border-[hsl(var(--gal-offline))]/20",
        "data_testid": "offline-status-banner"
      }
    },
    "recording_screen": {
      "structure": [
        "TopAppBar: titlu 'Înregistrare' + drawer + toggle temă",
        "Offline banner (dacă e cazul)",
        "Recorder panel (card mare): timer + waveform + butoane",
        "Recent meetings (listă scurtă)"
      ],
      "recorder_panel": {
        "card": "Card cu padding mare, colțuri 16px, shadow-card.",
        "timer": {
          "font": "Roboto Mono",
          "size": "text-3xl",
          "data_testid": "recording-timer"
        },
        "waveform": {
          "visual": "Waveform simplu (bars) cu 24–48 bare; animat doar când înregistrează.",
          "colors": {
            "idle": "bg-muted",
            "recording": "bg-[hsl(var(--gal-danger))]",
            "peak": "bg-[hsl(var(--gal-warning))]"
          },
          "implementation_hint": {
            "library_optional": "wavesurfer.js (pentru playback waveform) sau custom canvas pentru live bars.",
            "perf": "Preferă canvas pentru live; wavesurfer doar în detaliu pentru playback."
          },
          "data_testid": "recording-waveform"
        },
        "primary_action": {
          "pattern": "One-tap record: un singur buton mare (FAB) care toggle start/stop; confirmare stop doar dacă durata > 10s.",
          "tailwind": "h-20 w-20 rounded-full bg-[hsl(var(--gal-danger))] text-white shadow-[var(--shadow-fab)]",
          "data_testid": "record-toggle-button"
        },
        "secondary_actions": [
          {
            "label": "Pauză",
            "data_testid": "record-pause-button"
          },
          {
            "label": "Marchează moment",
            "data_testid": "record-marker-button"
          }
        ]
      }
    },
    "meetings_list": {
      "grouping": "Grupare pe Localitate (foldere).",
      "search": {
        "component": "Input + optional Command modal",
        "placeholder": "Caută după localitate, titlu, cuvinte din transcriere…",
        "data_testid": "meetings-search-input"
      },
      "filters": {
        "component": "Sheet/Drawer bottom pentru filtre (Status, Dată).",
        "date_picker": "Folosește shadcn Calendar dacă e nevoie de interval.",
        "data_testid": "meetings-filters-button"
      },
      "meeting_card": {
        "component": "Card",
        "layout": "Titlu + localitate badge + status chip + meta (dată, durată) + chevron.",
        "touch": "Card întreg clickable (min-h 88px).",
        "tailwind": "p-4 rounded-2xl shadow-[var(--shadow-card)]",
        "data_testid": "meeting-card"
      }
    },
    "meeting_detail": {
      "tabs": {
        "component": "Tabs",
        "labels": [
          "Rezumat",
          "Acțiuni",
          "Transcriere"
        ],
        "data_testid": "meeting-detail-tabs"
      },
      "audio_player": {
        "pattern": "Player sticky bottom: play/pause mare + scrubber + timp curent/durată.",
        "components": [
          "Button",
          "Slider",
          "Progress"
        ],
        "data_testid": "meeting-audio-player"
      },
      "export": {
        "pattern": "Două butoane full-width în Sheet: Export PDF / Export DOCX.",
        "data_testid": [
          "meeting-export-pdf-button",
          "meeting-export-docx-button"
        ]
      },
      "action_items": {
        "pattern": "Listă cu checkbox + responsabil + termen (dacă există).",
        "components": [
          "Checkbox",
          "Badge",
          "Separator"
        ],
        "data_testid": "meeting-action-items-list"
      }
    },
    "drawer_navigation": {
      "component": "Sheet (side) pentru localități",
      "structure": [
        "Header: 'Localități' + search",
        "Listă: Toate + localități dinamice (count badges)",
        "Footer: toggle temă + indicator storage/offline"
      ],
      "data_testid": {
        "open": "localities-drawer-open-button",
        "search": "localities-search-input",
        "item": "locality-folder-item"
      }
    }
  },
  "motion_and_microinteractions": {
    "principles": [
      "Performant: animăm opacity/transform doar",
      "Durate scurte: 120–180ms pentru tap feedback",
      "Respectă prefers-reduced-motion"
    ],
    "recording_feedback": {
      "haptics": "Dacă se adaugă Capacitor: haptic light impact la start/stop.",
      "visual": "Ring pulsing în jurul butonului record + waveform active.",
      "tailwind": "after:absolute after:inset-[-10px] after:rounded-full after:border after:border-[hsl(var(--gal-danger))]/30 motion-safe:after:animate-pulse"
    },
    "list_transitions": {
      "pattern": "Skeleton la încărcare + fade-in pe carduri (stagger mic).",
      "avoid": "Nu folosi animații lungi; aplicația trebuie să pară instant."
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast (min 4.5:1)",
      "Focus vizibil pe toate controalele",
      "Touch targets min 48px",
      "Text nu mai mic de 14px pe mobil",
      "Statusurile au și text, nu doar culoare"
    ],
    "aria": {
      "record_button": "aria-label=\"Pornește/Oprește înregistrarea\"",
      "offline_banner": "role=\"status\" aria-live=\"polite\""
    }
  },
  "libraries": {
    "recommended": [
      {
        "name": "framer-motion",
        "why": "micro-animatii controlate (drawer, fade-in, pulse ring) fără CSS global",
        "install": "npm i framer-motion",
        "usage_hint": "Folosește motion.div doar pe elemente cheie (record ring, card enter)."
      },
      {
        "name": "wavesurfer.js",
        "why": "waveform pentru playback în detaliu întâlnire",
        "install": "npm i wavesurfer.js",
        "usage_hint": "Inițializează doar când tab-ul 'Transcriere' sau player e vizibil; cleanup la unmount."
      }
    ],
    "optional": [
      {
        "name": "@capacitor/core + @capacitor/haptics",
        "why": "haptics native-like în PWA instalată",
        "install": "npm i @capacitor/core @capacitor/haptics",
        "usage_hint": "Fallback silent dacă nu e disponibil."
      }
    ]
  },
  "image_urls": {
    "usage_note": "Imaginile sunt opționale; aplicația e utilitară. Folosește doar pentru empty states / onboarding / header accent. Evită imagini grele pentru offline.",
    "categories": [
      {
        "category": "empty_state_background",
        "description": "Fundal subtil pentru ecranul 'Nu există întâlniri încă' (blur + overlay).",
        "urls": [
          "https://images.pexels.com/photos/33319454/pexels-photo-33319454.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        ]
      },
      {
        "category": "onboarding_or_about",
        "description": "Imagine contextuală (echipă în teren cu telefon) pentru un ecran scurt 'Cum funcționează'.",
        "urls": [
          "https://images.pexels.com/photos/13801548/pexels-photo-13801548.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        ]
      }
    ]
  },
  "page_blueprints": {
    "home_recording": {
      "top": "TopAppBar + OfflineBanner",
      "main": [
        "RecorderCard (timer + waveform + record toggle)",
        "QuickStatusRow (badge: Online/Offline, storage, sync queue)",
        "RecentMeetings (max 5)"
      ],
      "cta": "Record toggle (one-tap)"
    },
    "browse": {
      "top": "TopAppBar (titlu 'Întâlniri') + search",
      "main": [
        "LocalitySection headers (sticky) + MeetingCards",
        "FilterSheet"
      ]
    },
    "detail": {
      "top": "TopAppBar (back + titlu + status chip + export)",
      "main": [
        "Tabs: Rezumat / Acțiuni / Transcriere",
        "AudioPlayer sticky bottom"
      ]
    }
  },
  "instructions_to_main_agent": {
    "critical": [
      "Elimină stilurile default din /app/frontend/src/App.css care centrează și face ecran negru; păstrează App.css minimal sau mută în Tailwind.",
      "Actualizează tokens din /app/frontend/src/index.css conform schemei de mai sus (HSL).",
      "UI în română peste tot (buton, status, empty states).",
      "Toate elementele interactive și informațiile cheie trebuie să aibă data-testid (kebab-case).",
      "Folosește shadcn/ui pentru componente (Button, Card, Tabs, Sheet/Drawer, Badge, Slider, Progress, Skeleton, Sonner).",
      "Mobile-first: max-w-md, spacing mare, touch targets 56px pentru acțiuni primare.",
      "Offline indicator persistent + status chips pe fiecare întâlnire.",
      "Nu folosi animații grele; doar micro-interactions (opacity/transform) și respectă prefers-reduced-motion."
    ],
    "suggested_testids": [
      "topbar-theme-toggle",
      "topbar-open-drawer-button",
      "offline-status-banner",
      "record-toggle-button",
      "recording-timer",
      "recording-waveform",
      "meetings-search-input",
      "meeting-card",
      "meeting-detail-tabs",
      "meeting-audio-player",
      "meeting-export-pdf-button",
      "meeting-export-docx-button"
    ]
  },
  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
