import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Geist carries body + UI. Space Grotesk is the display face — reserved for
// headings and, in Phase 2, the oversized stat numerals (via `font-display`).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tikas — Your Fitness Companion",
    template: "%s · Tikas",
  },
  description:
    "AI-powered fitness companion: workout planning, calorie counting, weight and body tracking, and three AI coaches.",
};

// Let the mobile keyboard shrink the layout viewport so the chat sheet's
// composer stays above it (h-dvh in the sheet reacts to this).
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

// Runs before first paint to apply the saved theme (dark by default) so there's
// no flash of the wrong theme. Keep in sync with components/theme-toggle.tsx.
const themeScript = `
  try {
    var t = localStorage.getItem('tikas-theme');
    if (t === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  } catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
