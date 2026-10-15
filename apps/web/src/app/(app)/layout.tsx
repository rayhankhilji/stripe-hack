import type { ReactNode } from "react";
import { AppRail } from "../../components/ghost/app-rail";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <AppRail />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-screen-2xl px-5 py-8 md:px-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
