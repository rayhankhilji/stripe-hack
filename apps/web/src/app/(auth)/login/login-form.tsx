"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";

// Only same-origin relative paths; anything else falls back to the workspace.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api<void>("/api/auth/login", { method: "POST", body: { password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label htmlFor="password" className="text-sm font-medium text-porcelain">
        Operator password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "login-error" : undefined}
        className="h-11 rounded-[10px] border border-porcelain/20 bg-forest px-3.5 text-porcelain outline-none transition-colors duration-200 placeholder:text-porcelain/40 focus:border-petal focus-visible:ring-2 focus-visible:ring-petal/40"
        placeholder="Enter password"
      />
      {error ? (
        <p id="login-error" role="alert" className="text-sm text-petal">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || password.length === 0}
        className="h-11 rounded-[10px] bg-petal font-semibold text-forest transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
