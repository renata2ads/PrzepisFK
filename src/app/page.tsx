const categories = [
  "Rachunkowość",
  "Finanse publiczne / Rb",
  "VAT i KSeF",
  "JPK",
  "Podatki lokalne",
  "Płace i ZUS",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <header className="bg-[#14213d] px-4 py-10 text-white sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-widest">
            <span className="mr-2 rounded bg-[#c2410c] px-2 py-1">Wkrótce</span>
            Projekt końcowy · Kurs Claude Code
          </p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight sm:text-6xl">
            PrzepisFK
          </h1>
          <p className="mt-3 max-w-xl text-lg opacity-90">
            Zmiany w przepisach finansowo-księgowych, streszczone przez AI
            i dopasowane do Twoich obszarów.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#c2410c]">
          Obszary, które będziemy śledzić
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c}
              className="rounded-full bg-[#fdeee4] px-4 py-1.5 text-sm font-semibold"
            >
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[#5b6478]">
          Pierwsze wpisy pojawią się wkrótce.
        </p>
      </main>
    </div>
  );
}
