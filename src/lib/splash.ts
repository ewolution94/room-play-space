// The splash screen for the installed app, written by development/plans/splash-rollout/launch.mjs:
// edit there, not here. __root.tsx puts the links in the head, the style and the switch after the
// theme script, and the markup at the top of <body>; RootComponent sends splash:ready.

/** The iOS launch images (public/splash), one per iPhone size and appearance. */
export const SPLASH_LINKS = [
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1320x2868.png",
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1260x2736.png",
    media:
      "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1206x2622.png",
    media:
      "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1290x2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1179x2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1284x2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1170x2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1125x2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-1242x2688.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-828x1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/light-750x1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1320x2868.png",
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1260x2736.png",
    media:
      "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1206x2622.png",
    media:
      "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1290x2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1179x2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1284x2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1170x2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1125x2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-1242x2688.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-828x1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
  {
    rel: "apple-touch-startup-image",
    href: "/splash/dark-750x1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
  },
];

export const SPLASH_CSS =
  "/* The splash screen, written by development/plans/splash-rollout/launch.mjs: edit there, not here.\n   The pre-paint script turns it on in the installed app (or with ?splash) and takes it away. It starts\n   as the launch image left off: the mark, 120 pt, in the middle of the screen on the system's page\n   colour (iOS picks the launch image by the system's appearance, not the app's saved theme). Then\n   the mark makes its move, a glint crosses, and the splash fades into the app. Longhands only:\n   Vite's minifier turns an animation shorthand without a name into `animation: none`. The mark's\n   <svg> is 0 × 0 in the markup, so without this style (offline, a blocked file) nothing shows. */\n#splash { display: none; }\n.splash #splash { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; background: #020618; touch-action: none; }\n@media (prefers-color-scheme: light) { .splash #splash { background: #ffffff; } }\n#splash svg { width: 120px; height: 120px; translate: 0 calc(-1 * var(--splash-lift, 0px)); }\n#splash :where(g[class], .trace) { transform-box: view-box; animation-duration: 560ms; animation-timing-function: cubic-bezier(0.45, 0, 0.25, 1); animation-delay: 60ms; animation-fill-mode: both; }\n#splash .gl { animation-name: splash-glint; animation-duration: 640ms; }\n@keyframes splash-glint { to { transform: translateX(2000px); } }\n#splash .p0, #splash .p3 { transform-origin: 560px 600px; }\n#splash .p4 { transform-origin: 666px 572px; }\n#splash .p3 { animation-name: splash-pl-door; }\n#splash .p0 { animation-name: splash-pl-swing; }\n#splash .p4 { animation-name: splash-pl-s; }\n@keyframes splash-pl-door { 45% { transform: rotate(90deg); } }\n@keyframes splash-pl-swing { 45% { transform: rotate(90deg) scale(0.2); opacity: 0; } }\n@keyframes splash-pl-s { 30% { transform: translateY(-40px); } 56% { transform: translateY(0) scale(1.12, 0.88); } 72% { transform: scale(1); } }\n.splash-out #splash { opacity: 0; pointer-events: none; transition: opacity 320ms ease; }\n.splash-out #splash svg { scale: 1.08; transition: scale 320ms cubic-bezier(0.3, 0, 0.2, 1); }\n@media (prefers-reduced-motion: reduce) {\n  #splash :where(g[class], .trace) { animation: none; }\n  .splash-out #splash { transition-duration: 200ms; }\n  .splash-out #splash svg { scale: none; }\n}";

/** The switch: runs before first paint, beside the theme script. */
export const SPLASH_BOOT =
  "try {\n  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;\n  if (standalone || /[?&]splash\\b/.test(location.search)) {\n    var root = document.documentElement;\n    root.classList.add('splash');\n    // The launch image centres the mark on the whole screen. Should the page start below the\n    // status bar (with viewport-fit=cover it doesn't), lift the mark by half the bar.\n    var lift = (screen.height - innerHeight) / 2;\n    if (standalone && innerHeight > innerWidth && lift > 0 && lift < 60) root.style.setProperty('--splash-lift', lift + 'px');\n    // Clinch keeps its own motion setting on <html data-motion> (set just before this runs).\n    var still = matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'reduced';\n    var played = still;\n    var ready = false;\n    var gone = false;\n    var leave = function () {\n      if (gone) return;\n      gone = true;\n      root.classList.add('splash-out');\n      setTimeout(function () {\n        root.classList.remove('splash', 'splash-out');\n      }, still ? 220 : 340);\n    };\n    document.addEventListener('animationend', function (e) {\n      if (e.animationName !== 'splash-glint') return;\n      played = true;\n      if (ready) leave();\n    });\n    addEventListener('splash:ready', function () {\n      ready = true;\n      if (played) leave();\n    });\n    setTimeout(leave, 1500);\n  }\n} catch (e) {}\n";

/** The mark, its moving parts in groups (#splash's content). */
export const SPLASH_MARKUP =
  '<svg width="0" height="0" viewBox="0 0 1024 1024" aria-hidden="true"><defs><linearGradient id="gAplanum" x1="0.25" y1="0" x2="0.75" y2="1"><stop offset="0" stop-color="#4cc6fb"/><stop offset="1" stop-color="#0478b5"/></linearGradient><linearGradient id="wAplanum" gradientUnits="userSpaceOnUse" x1="0" y1="230" x2="0" y2="800"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef0f6"/></linearGradient><radialGradient id="sAplanum" cx="0.5" cy="-0.1" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="dAplanum" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="16" result="b"/><feOffset in="b" dy="14" result="o"/><feFlood flood-color="#023a5a" flood-opacity="0.38" result="c"/><feComposite in="c" in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="cAplanum"><rect width="1024" height="1024" rx="232"/></clipPath></defs><g clip-path="url(#cAplanum)"><rect width="1024" height="1024" fill="url(#gAplanum)"/><rect width="1024" height="1024" fill="url(#sAplanum)"/><g filter="url(#dAplanum)"><g transform="translate(512 512) scale(1) translate(-512 -512)"><g class="p0"><path d="M560 600 H380 A180 180 0 0 1 560 420 Z" fill="url(#wAplanum)" opacity="0.26" /></g><g class="p1"><path d="M252 252 H772 V772 H252 Z" fill="none" stroke="url(#wAplanum)" stroke-width="80" stroke-linecap="round" stroke-linejoin="round" /></g><g class="p2"><path d="M560 252 V420 M560 600 V772" fill="none" stroke="url(#wAplanum)" stroke-width="60" stroke-linecap="round" stroke-linejoin="round" /></g><g class="p3"><path d="M560 600 H380" fill="none" stroke="url(#wAplanum)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" /></g><g class="p4"><circle cx="666" cy="512" r="60" fill="#0b2a4a" /></g></g></g><defs><linearGradient id="glAplanum"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g transform="translate(-1000 0)"><g class="gl"><rect x="352" y="-400" width="320" height="1824" fill="url(#glAplanum)" transform="rotate(20 512 512)"/></g></g></g></svg>';
