import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vivekvari.tech"),
  title: "V Sara Vivek — AI Engineer",
  description: "AI engineer building production LLM, RAG, and computer-vision systems at government scale.",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  openGraph: {
    title: "V Sara Vivek — AI Engineer",
    description: "AI engineer building production LLM, RAG, and computer-vision systems at government scale.",
    type: "website",
    url: "/",
    siteName: "V Sara Vivek",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "V Sara Vivek — AI Engineer" }],
  },
  twitter: { card: "summary_large_image", title: "V Sara Vivek — AI Engineer", description: "LLM systems, computer vision, and technical field notes.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body className="antialiased"><ThemeProvider>{children}<ThemeToggle /></ThemeProvider></body>
    </html>
  );
}
