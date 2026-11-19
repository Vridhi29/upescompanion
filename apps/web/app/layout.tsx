import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ReminderRuntime } from "@/components/ReminderRuntime";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPES Companion",
  description: "Attendance, marks, assignments and policies in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ReminderRuntime />
        <div id="portal-content" className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
