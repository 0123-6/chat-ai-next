import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "next模仿豆包网站",
  description: "next模仿豆包网站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <head>
      <meta charSet="UTF-8"/>
      <link rel="icon" href="/logo.webp"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>next模仿豆包网站</title>
    </head>
    <body>
    <div className="w-dvw h-dvh flex flex-col overflow-auto">
      <div className="w-full min-w-200 h-full flex flex-col">
        {children}
      </div>
    </div>
    </body>
    </html>
  );
}
