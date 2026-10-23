"use client";

import { useActionState } from "react";
import { deleteAccount, saveSettings } from "@/app/ustawienia/actions";
import type { Category } from "@/lib/supabase";

type Props = { categories: Category[]; selected: number[]; frequency: string };

const FREQ = [
  { value: "none", label: "Nie wysyłaj" },
  { value: "daily", label: "Codziennie" },
  { value: "weekly", label: "Raz w tygodniu" },
];

export function SettingsForm({ categories, selected, frequency }: Props) {
  const [state, formAction, pending] = useActionState(saveSettings, {});

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#dde1ea]">
        <fieldset>
          <legend className="text-lg font-bold">Obszary, które Cię interesują</legend>
          <p className="mt-1 text-sm text-[#5b6478]">Na ich podstawie powstaje Twój feed i e-maile.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-[#dde1ea] has-[:checked]:bg-[#fdeee4] has-[:checked]:ring-[#c2410c]">
                <input type="checkbox" name="kategoria" value={c.id} defaultChecked={selected.includes(c.id)} className="accent-[#c2410c]" />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-bold">E-mail z nowymi wpisami</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {FREQ.map((f) => (
              <label key={f.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-[#dde1ea] has-[:checked]:bg-[#fdeee4] has-[:checked]:ring-[#c2410c]">
                <input type="radio" name="czestotliwosc" value={f.value} defaultChecked={frequency === f.value} className="accent-[#c2410c]" />
                {f.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#5b6478]">Wysyłka e-maili ruszy w kolejnym etapie projektu.</p>
        </fieldset>

        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.info && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.info}</p>}

        <button disabled={pending} className="rounded-lg bg-[#c2410c] px-5 py-2 font-semibold text-white hover:bg-[#9a3412] disabled:opacity-60">
          {pending ? "Zapisuję…" : "Zapisz ustawienia"}
        </button>
      </form>

      <form
        action={deleteAccount}
        onSubmit={(e) => {
          const ok = (e.currentTarget.elements.namedItem("potwierdz") as HTMLInputElement).checked;
          if (!ok) e.preventDefault();
        }}
        className="rounded-lg bg-white p-6 ring-1 ring-red-200"
      >
        <h2 className="font-bold text-red-800">Usuń konto</h2>
        <p className="mt-1 text-sm text-[#5b6478]">Usuniemy konto, wybrane obszary i zakładki. Tego nie da się cofnąć.</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="potwierdz" required /> Rozumiem i chcę usunąć konto
        </label>
        <button className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">
          Usuń konto
        </button>
      </form>
    </div>
  );
}
