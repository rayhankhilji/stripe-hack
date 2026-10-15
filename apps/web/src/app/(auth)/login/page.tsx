import { Suspense } from "react";
import { Logo } from "@/components/ghost/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Ghost" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-forest text-porcelain">
      <header className="px-8 pt-8 md:px-14 md:pt-12">
        <Logo />
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-8 py-16 md:flex-row md:items-center md:justify-between md:gap-20 md:px-14">
        <div className="max-w-xl">
          <p className="mb-5 font-mono text-xs uppercase tracking-widest text-petal">Revenue operator</p>
          <h1 className="font-[family-name:var(--font-fraunces)] text-5xl font-semibold leading-[1.05] text-petal md:text-7xl">
            Find the revenue you already earned.
          </h1>
          <p className="mt-6 max-w-md text-lg text-porcelain/70">
            Ghost reconciles every system of record, shows its evidence, and invoices only after you approve.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-[22px] border border-forest-2 bg-forest-2 p-7">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
