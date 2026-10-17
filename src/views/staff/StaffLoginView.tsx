"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearStaffProfile,
  loadStaffSession,
  parseStaffRole,
  staffMeFromAccessToken,
  pingStaffAuthCookies,
  rememberStaffApp,
  rememberStaffProfile,
  STAFF_APP_HEADER,
  STAFF_ROLE_LABEL,
  staffAppForRole,
  staffAppMismatchMessage,
  staffHomePath,
  staffRoleFromPath,
  staffRoleMatchesApp,
  waiterLogout,
  type StaffRole,
  type WaiterMe,
} from "@/lib/waiter-api";

const DASHBOARD_LOGIN_URL = `${(
  process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || "http://localhost:3000"
).replace(/\/$/, "")}/login`;

const LOGIN_ROLES: StaffRole[] = ["WAITER", "KITCHEN", "COURIER"];

type StaffLoginViewProps = {
  defaultExpectedRole?: StaffRole;
  onAuthenticated?: (me: WaiterMe) => void;
};

export default function StaffLoginView({ defaultExpectedRole, onAuthenticated }: StaffLoginViewProps) {
  const router = useRouter();
  const [expectedRole, setExpectedRole] = useState<StaffRole>(() => {
    if (defaultExpectedRole) return defaultExpectedRole;
    if (typeof window !== "undefined") {
      return staffRoleFromPath(window.location.pathname) ?? "WAITER";
    }
    return "WAITER";
  });
  const [merchantId, setMerchantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      const session = loadStaffSession();
      if (!session) {
        setChecking(false);
        return;
      }
      const role = parseStaffRole(session.me.staffRole);
      const cookiesOk = await pingStaffAuthCookies(staffAppForRole(role));
      if (!cookiesOk) {
        clearStaffProfile();
        setChecking(false);
        return;
      }
      if (onAuthenticated) {
        onAuthenticated(session.me);
      } else {
        router.replace(staffHomePath(role));
      }
    })();
  }, [onAuthenticated, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const merchant = merchantId.trim();
    if (!/^\d+$/.test(merchant)) {
      setError("İşletme ID sayı olmalı");
      return;
    }
    const app = staffAppForRole(expectedRole);
    setLoading(true);
    try {
      const response = await fetch("/api/staff/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          [STAFF_APP_HEADER]: app,
        },
        body: JSON.stringify({
          merchantId: Number(merchant),
          username: username.trim(),
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
        message?: string;
      };
      if (!response.ok) {
        setError(typeof data.message === "string" ? data.message : "Giriş başarısız");
        return;
      }
      const accessToken =
        typeof data.accessToken === "string"
          ? data.accessToken
          : typeof data.access_token === "string"
            ? data.access_token
            : "";
      if (!accessToken) {
        setError("Access token alınamadı");
        return;
      }
      const me = staffMeFromAccessToken(accessToken);
      if (!me) {
        setError("Personel bilgileri access token içinde eksik (staffId, merchantId, branchId)");
        return;
      }
      const actual = parseStaffRole(me.staffRole);
      if (!staffRoleMatchesApp(actual, expectedRole)) {
        await waiterLogout(app);
        clearStaffProfile();
        setError(staffAppMismatchMessage(expectedRole, actual));
        return;
      }
      rememberStaffProfile(me);
      rememberStaffApp(app);
      const cookiesOk = await pingStaffAuthCookies(app);
      if (!cookiesOk) {
        clearStaffProfile();
        setError("Oturum çerezleri oluşturulamadı. Çerez engelini kapatıp tekrar deneyin.");
        return;
      }
      if (onAuthenticated) {
        onAuthenticated(me);
      } else {
        router.replace(staffHomePath(actual));
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
              Önce giriş türünü seçin, ardından işletme ID ve hesap bilgilerinizle girin.
            </p>
          </div>
          {checking ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <div className="space-y-2">
                <Label>Giriş türü</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LOGIN_ROLES.map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={expectedRole === role ? "default" : "outline"}
                      className="h-10 px-2 text-xs sm:text-sm"
                      onClick={() => setExpectedRole(role)}
                    >
                      {STAFF_ROLE_LABEL[role]}
                    </Button>
                  ))}
                </div>
              </div>
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
