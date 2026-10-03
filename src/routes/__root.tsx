import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_COLOR } from "@/hooks/use-theme";
import { isRedirectGate, loadCensus } from "@/lib/census";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PLANUM" },
      // Home-screen install (public/manifest.webmanifest, public/sw.js). No
      // status-bar style on purpose: left at the default, iOS colours the bar
      // from theme-color, which the inline script below and useTheme keep in
      // step with the light and dark themes.
      { name: "theme-color", content: THEME_COLOR.light },
      { name: "apple-mobile-web-app-title", content: "PLANUM" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content:
          "Plan real rooms -- including sloped attic ceilings -- and see what actually fits, in 2D and 3D.",
      },
      { property: "og:title", content: "PLANUM" },
      {
        property: "og:description",
        content:
          "Plan real rooms -- including sloped attic ceilings -- and see what actually fits, in 2D and 3D.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://planum.ewolution.cloud/" },
      // Social preview, 1200×630 in public/. Bump ?v= when the image changes.
      { property: "og:image", content: "https://planum.ewolution.cloud/og.png?v=3" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "PLANUM: floor plans in 2D and 3D, sloped ceilings included.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://planum.ewolution.cloud/og.png?v=3" },
      { name: "twitter:title", content: "PLANUM" },
      {
        name: "twitter:description",
        content:
          "Plan real rooms -- including sloped attic ceilings -- and see what actually fits, in 2D and 3D.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/logo.svg",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          try {
            var theme = localStorage.getItem('planner-theme');
            var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (isDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', isDark ? '${THEME_COLOR.dark}' : '${THEME_COLOR.light}');
          } catch (e) {}
        `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // The offline shell -- see public/sw.js for what it does and doesn't cache.
  // Production only, and deliberately: a service worker in front of the dev
  // server caches the very modules Vite is trying to hot-replace. Registered
  // after `load` so it competes with nothing on the first paint, which is the
  // paint this exists to make faster on every visit after it.
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable worker costs the offline shell and nothing else.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  // Visit counting, once the first real page is showing -- see lib/census.ts.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    if (!isRedirectGate(pathname)) loadCensus();
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Shared across every Tooltip in the app so hovering from one
          tooltipped element straight to another shows the next one
          almost instantly (Radix's skipDelayDuration) instead of
          re-waiting the full delayDuration each time -- only works when
          they all share one provider. delayDuration itself is deliberately
          much shorter than a native browser tooltip's (~1000ms+). */}
      <TooltipProvider delayDuration={150}>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
