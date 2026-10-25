"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Couldn't sign in.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <h1 className="font-serif text-[30px] leading-tight font-[420]">Sign in</h1>
      <p className="mt-1.5 mb-7 text-[14px] text-muted">Enter the admin password to manage articles and doctors.</p>
      <Field label="Password" htmlFor="password">
        <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
      </Field>
      {error && <p className="mt-2 text-[13px] text-brick">{error}</p>}
      <Button type="submit" variant="primary" loading={busy} className="mt-5 w-full">
        Continue
      </Button>
    </form>
  );
}
