import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Mark } from "@/components/sidebar";
import { authEnabled, isSignedIn } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!authEnabled() || (await isSignedIn())) redirect("/");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-pine px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <Mark className="[&_rect]:fill-white/15" />
          <span className="font-serif text-[21px] font-[480]">Dispatch</span>
        </div>
        <div className="mt-auto max-w-md">
          <p className="font-serif text-[40px] leading-[1.1] font-[380] tracking-[-0.015em]">
            The right article, in every doctor&apos;s inbox, on schedule.
          </p>
          <p className="mt-5 text-[14.5px] text-white/70">Upload the PDF once. Dispatch emails each doctor individually, tracks every delivery and retries what fails.</p>
        </div>
        {/* Decorative envelope lines */}
        <svg className="pointer-events-none absolute -top-10 -right-24 w-[520px] opacity-[0.09]" viewBox="0 0 200 140" fill="none" stroke="#fff" strokeWidth=".6">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${10 + i * 4} ${20 + i * 4}h${180 - i * 8}v${100 - i * 8}H${10 + i * 4}zM${10 + i * 4} ${20 + i * 4}l${90 - i * 4} ${55 - i * 3} ${90 - i * 4}-${55 - i * 3}`} />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-center px-6">
        <LoginForm />
      </div>
    </div>
  );
}
