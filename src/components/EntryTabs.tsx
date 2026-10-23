import Link from "next/link";

type Tab = "zmiany" | "projekty" | "druki";

// Zakładki rodzaju wpisów: strona główna (zmiany, projekty) i /druki
export function EntryTabs({ active, hrefs }: { active: Tab; hrefs?: Partial<Record<Tab, string>> }) {
  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "zmiany", label: "Zmiany w przepisach", href: hrefs?.zmiany ?? "/" },
    { id: "projekty", label: "Projekty przepisów", href: hrefs?.projekty ?? "/?widok=projekty" },
    { id: "druki", label: "Druki", href: "/druki" },
  ];
  return (
    <nav aria-label="Rodzaj wpisów" className="mb-5 flex gap-6 border-b border-[#dde1ea]">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={`border-b-2 px-1 pb-2 font-semibold ${
            t.id === active ? "border-[#c2410c] text-[#14213d]" : "border-transparent text-[#5b6478] hover:text-[#14213d]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
