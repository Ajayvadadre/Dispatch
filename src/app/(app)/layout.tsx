import { Sidebar } from "@/components/sidebar";
import { authEnabled, requirePageSession } from "@/lib/auth";
import { getProvider } from "@/lib/email/providers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  const provider = getProvider();
  return (
    <div className="flex min-h-screen">
      <Sidebar provider={provider.label} providerReady={provider.configErrors().length === 0} authEnabled={authEnabled()} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1120px] px-10 pt-10 pb-20">{children}</div>
      </main>
    </div>
  );
}
