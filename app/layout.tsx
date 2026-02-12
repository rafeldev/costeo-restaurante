import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalculaChef | Costeo Inteligente",
  description: "Sistema de costeo de recetas y precio sugerido de venta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
