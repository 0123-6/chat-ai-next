import type { Metadata } from "next";
import "@/app/globals.css";
import {AntdRegistry} from "@ant-design/nextjs-registry";

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
    <html lang="zh-CN">
    <head>
      <meta charSet="UTF-8"/>
      <link rel="icon" href="/logo.webp"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>next模仿豆包网站</title>
    </head>
    <body>
    <AntdRegistry>
      <div className="w-dvw h-dvh flex flex-col overflow-auto">
        <div className="w-full h-full flex flex-col">
          {children}
        </div>
      </div>
    </AntdRegistry>
    </body>
    </html>
  );
}
