import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vivekvar-portfolio.vivekvarrrr.chatgpt.site"),
  title: "V Sara Vivek — AI Engineer",
  description: "AI engineer building production LLM, RAG, and computer-vision systems at government scale.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "V Sara Vivek — AI Engineer",
    description: "AI engineer building production LLM, RAG, and computer-vision systems at government scale.",
    type: "website",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "V Sara Vivek — AI Engineer" }],
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
