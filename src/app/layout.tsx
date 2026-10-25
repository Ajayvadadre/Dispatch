import type { Metadata } from "next";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata: Metadata = {
  title: { default: "Dispatch", template: "%s · Dispatch" },
  description: "Scheduled article emails for doctors",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
