import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS SalApp",
  description: "Point of Sale for Pondok Pesantren",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          {children}
          <Toaster 
            position="top-center" 
            toastOptions={{
              unstyled: true,
              classNames: {
                toast: "flex w-[356px] items-center gap-4 p-4 border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] font-mono uppercase bg-background text-foreground animate-in slide-in-from-top-4",
                title: "font-black text-sm",
                description: "font-mono text-xs opacity-80",
                success: "bg-green-400 border-green-900 text-green-950 dark:bg-green-600 dark:text-green-50",
                error: "bg-red-400 border-red-900 text-red-950 dark:bg-red-600 dark:text-red-50",
                warning: "bg-yellow-400 border-yellow-900 text-yellow-950 dark:bg-yellow-600 dark:text-yellow-50",
                info: "bg-blue-400 border-blue-900 text-blue-950 dark:bg-blue-600 dark:text-blue-50",
                icon: "w-6 h-6 shrink-0",
              }
            }} 
          />
        </Providers>
      </body>
    </html>
  );
}
