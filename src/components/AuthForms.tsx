"use client";

import { useActionState, useState } from "react";
import { resetPassword, signIn, signUp, updatePassword, type FormState } from "@/app/logowanie/actions";

const input =
  "w-full rounded-lg border border-[#dde1ea] bg-white px-3 py-2 outline-none focus:border-[#c2410c]";
const button =
  "w-full rounded-lg bg-[#c2410c] px-4 py-2 font-semibold text-white hover:bg-[#9a3412] disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>;
  if (state.info) return <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.info}</p>;
  return null;
}

type Mode = "login" | "register" | "reset";

export function LoginForms({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [mode, setMode] = useState<Mode>("login");
  const action = { login: signIn, register: signUp, reset: resetPassword }[mode];
  const [state, formAction, pending] = useActionState(action, {});

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 border-b-2 pb-2 font-semibold ${mode === m ? "border-[#c2410c] text-[#14213d]" : "border-transparent text-[#5b6478]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#dde1ea]">
      {mode !== "reset" && (
        <div className="mb-5 flex gap-4">
          {tab("login", "Logowanie")}
          {tab("register", "Załóż konto")}
        </div>
      )}
      {mode === "reset" && <h2 className="mb-4 text-lg font-bold">Reset hasła</h2>}

      <form key={mode} action={formAction} className="space-y-3">
        <input type="hidden" name="dalej" value={next ?? ""} />
        {linkError && !state.error && !state.info && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            Link wygasł lub jest nieprawidłowy. Spróbuj ponownie.
          </p>
        )}
        <Message state={state} />
        <label className="block text-sm font-semibold">
          E-mail
          <input name="email" type="email" required autoComplete="email" className={`${input} mt-1 font-normal`} />
        </label>
        {mode !== "reset" && (
          <label className="block text-sm font-semibold">
            Hasło
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={`${input} mt-1 font-normal`}
            />
          </label>
        )}
        <button disabled={pending} className={button}>
          {pending ? "Chwileczkę…" : { login: "Zaloguj się", register: "Załóż konto", reset: "Wyślij link" }[mode]}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        {mode === "reset" ? (
          <button type="button" onClick={() => setMode("login")} className="text-[#c2410c] underline">
            Wróć do logowania
          </button>
        ) : (
          <button type="button" onClick={() => setMode("reset")} className="text-[#5b6478] underline">
            Nie pamiętasz hasła?
          </button>
        )}
      </p>
    </div>
  );
}

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, {});
  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-white p-6 shadow-sm ring-1 ring-[#dde1ea]">
      <Message state={state} />
      <label className="block text-sm font-semibold">
        Nowe hasło
        <input name="password" type="password" required minLength={6} autoComplete="new-password" className={`${input} mt-1 font-normal`} />
      </label>
      <button disabled={pending} className={button}>
        {pending ? "Chwileczkę…" : "Zapisz nowe hasło"}
      </button>
    </form>
  );
}
