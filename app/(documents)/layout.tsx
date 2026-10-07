/** Documents imprimables (factures, avoirs, constats) : page dépouillée, sans en-tête ni pied de site. */
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return <main id="contenu" className="min-h-dvh bg-[#e9edf5] py-6 print:min-h-0 print:bg-white print:py-0">{children}</main>;
}
