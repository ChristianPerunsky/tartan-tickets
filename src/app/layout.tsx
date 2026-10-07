import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tartan Tickets",
  description: "Buy tickets for student club events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Tartan Tickets
          </a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
