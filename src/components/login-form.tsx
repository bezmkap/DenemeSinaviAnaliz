"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { homePathForRole, type Role } from "@/lib/domain";

function loginDestination(role: Role | undefined, sonraki: string | null) {
  if (sonraki?.startsWith("/") && !sonraki.startsWith("//")) return sonraki;
  return homePathForRole(role ?? "school_user");
}

export function LoginForm() {
  const params = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    let leaving = false;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ login, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Giriş yapılamadı.");
        return;
      }
      leaving = true;
      window.location.assign(loginDestination(data.user?.role, params.get("sonraki")));
    } catch {
      setError("Bağlantı hatası. Yeniden deneyin.");
    } finally {
      if (!leaving) setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Giriş başarısız</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="login">Kurum kodu veya e-posta</Label>
        <Input
          id="login"
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          placeholder="Kurum kodu veya e-posta"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
