"use client";

import { useActionState, useRef } from "react";
import { submitLink } from "@/app/zglos/actions";

export function SubmitForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof submitLink>[0], form: FormData) => {
    const result = await submitLink(prev, form);
    if (result.info) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#dde1ea]">
      <label className="block text-sm font-semibold">
        Link do materiału
        <input
          name="url"
          type="url"
          required
          placeholder="https://legislacja.gov.pl/projekt/…"
          className="mt-1 w-full rounded-lg border border-[#dde1ea] px-3 py-2 font-normal outline-none focus:border-[#c2410c]"
        />
      </label>
      <label className="block text-sm font-semibold">
        Notatka <span className="font-normal text-[#5b6478]">(opcjonalnie — na co zwrócić uwagę)</span>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-[#dde1ea] px-3 py-2 font-normal outline-none focus:border-[#c2410c]"
        />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.info && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.info}</p>}
      <button disabled={pending} className="rounded-lg bg-[#c2410c] px-5 py-2 font-semibold text-white hover:bg-[#9a3412] disabled:opacity-60">
        {pending ? "Wysyłam…" : "Zgłoś link"}
      </button>
    </form>
  );
}
