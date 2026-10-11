"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseStaffRole,
  rememberStaffApp,
  resolveStaffSession,
  staffAppForRole,
  staffHomePath,
} from "@/lib/waiter-api";

const DASHBOARD_LOGIN_URL = `${(
  process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || "http://localhost:3000"
).replace(/\/$/, "")}/login`;

type StaffLoginViewProps = {
  onAuthenticated?: () => void;
};

export default function StaffLoginView({ onAuthenticated }: StaffLoginViewProps) {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await resolveStaffSession();
        if (cancelled) return;
        if (session) {
          if (onAuthenticated) {
            onAuthenticated();
          } else {
            router.replace(staffHomePath(parseStaffRole(session.me.staffRole)));
          }
          return;
        }
      } catch {
        // Oturum yok.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const merchant = merchantId.trim();
    if (!/^\d+$/.test(merchant)) {
      setError("İşletme ID sayı olmalı");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/staff/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          merchantId: Number(merchant),
          username: username.trim(),
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        staffRole?: string;
      };
      if (!response.ok) {
        setError(data.message || "Giriş başarısız");
        return;
      }
      const role = parseStaffRole(data.staffRole);
      rememberStaffApp(staffAppForRole(role));
      if (onAuthenticated) {
        onAuthenticated();
      } else {
        router.replace(staffHomePath(role));
      }
    } catch {
      setError("Giriş yapılamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <BrandLogo size="lg" />
          <span className="text-2xl font-bold">
            Algory<span className="text-primary">QR</span>
          </span>
        </div>
        <div className="space-y-6 rounded-2xl border border-border bg-card p-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Personel girişi</h1>
            <p className="text-sm text-muted-foreground">
              İşletme ID, kullanıcı adı ve şifre ile girin. Rolünüze göre personel paneli açılır.
            </p>
          </div>
          {checking ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <div className="space-y-1.5">
                <Label htmlFor="staff-merchant-id">İşletme ID</Label>
                <Input
                  id="staff-merchant-id"
                  inputMode="numeric"
                  autoComplete="off"
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-username">Kullanıcı adı</Label>
                <Input
                  id="staff-username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-password">Şifre</Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Giriş yap"}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <a href={DASHBOARD_LOGIN_URL} className="underline-offset-4 hover:underline">
              Yönetim girişi
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
