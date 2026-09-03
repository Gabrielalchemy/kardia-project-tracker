import "./globals.css";
import { AppShell } from "./components/AppShell";

export const metadata = { title: "Kardia | Project Tracker", description: "Internal project dashboard for the Kardia team" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
