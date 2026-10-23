import { NewPasswordForm } from "@/components/AuthForms";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Nowe hasło · PrzepisFK" };

export default function NewPasswordPage() {
  return (
    <div className="min-h-screen bg-[#e9ecf2] text-[#14213d]">
      <SiteHeader subtitle={false} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="mb-5 text-center text-xl font-bold">Ustaw nowe hasło</h1>
        <NewPasswordForm />
      </main>
    </div>
  );
}
