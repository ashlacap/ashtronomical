import type { Metadata } from "next";
import { Manrope, Poppins, Dongle } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dongle = Dongle({
  variable: "--font-dongle",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://ashtronomical.vercel.app"),
  title: "Ashtronomical — Track Your Finances",
  description: "Your financial universe, mapped. Track every dollar automatically, see exactly where it's going, and stay under budget without lifting a finger.",
  openGraph: {
    title: "Ashtronomical",
    description: "Your financial universe, mapped. Track every dollar automatically and stay under budget without lifting a finger.",
    siteName: "Ashtronomical",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ashtronomical",
    description: "Your financial universe, mapped. Track every dollar automatically and stay under budget without lifting a finger.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${poppins.variable} ${dongle.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
