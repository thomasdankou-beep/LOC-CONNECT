import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "LOC'CONNECT — Location de matériel à Abidjan",
  description: "Louez du matériel auprès de loueurs professionnels, avec un paiement unique et une caution sécurisée.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>
          <Header />
          <main>{children}</main>
          <footer className="footer">
            <div className="container">LOC'CONNECT — maquette Lot 1 · données fictives, aucun paiement réel.</div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
