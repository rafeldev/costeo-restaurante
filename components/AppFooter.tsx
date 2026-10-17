import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="w-full bg-white py-10 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded bg-[#c25e19] text-xs font-bold text-white">C</span>
          <span className="text-[13px] text-[#94a3b8]">© {new Date().getFullYear()} CalculaChef. Costeo e inventario para restaurantes.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/glosario" className="text-[13px] text-[#475569] transition-colors hover:text-[#0f172a]">Glosario Gastronómico</Link>
          <Link href="/privacidad" className="text-[13px] text-[#475569] transition-colors hover:text-[#0f172a]">Privacidad</Link>
          <Link href="/terminos" className="text-[13px] text-[#475569] transition-colors hover:text-[#0f172a]">Términos</Link>
          <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-medium text-[#15803d]">• Motor de Costeo Operativo</span>
        </div>
      </div>
    </footer>
  );
}
