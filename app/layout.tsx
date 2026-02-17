import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CallProvider } from "@/components/providers/call-provider";
import MiniCallBar from "@/components/meetings/mini-call-bar";
import { ThemeProvider } from "@/components/providers/theme-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "EmpManager - Enterprise Management",
  description: "Modern Enterprise Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CallProvider>
            {children}
            <MiniCallBar />
          </CallProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
