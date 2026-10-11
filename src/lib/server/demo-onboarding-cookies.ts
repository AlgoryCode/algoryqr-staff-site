import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_MAX_AGE_SECONDS } from "@/lib/config";

export const DEMO_TRIAL_ACCOUNT_COOKIE = "algory_demo_trial";
export const DEMO_SETUP_DONE_COOKIE = "algory_demo_setup_done";

const demoCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
};

type CookieReader = Pick<NextRequest["cookies"], "get"> | { get: (name: string) => { value?: string } | undefined };

export function readDemoTrialAccountFromRequest(cookies: CookieReader): boolean {
  return cookies.get(DEMO_TRIAL_ACCOUNT_COOKIE)?.value === "1";
}

export function readDemoSetupDoneFromRequest(cookies: CookieReader): boolean {
  return cookies.get(DEMO_SETUP_DONE_COOKIE)?.value === "1";
}

export function setPersonalDemoTrialCookie(response: NextResponse) {
  response.cookies.set(DEMO_TRIAL_ACCOUNT_COOKIE, "1", demoCookieOptions);
}

export function setDemoSetupDoneCookie(response: NextResponse) {
  response.cookies.set(DEMO_SETUP_DONE_COOKIE, "1", demoCookieOptions);
}

export function clearDemoOnboardingCookies(response: NextResponse) {
  const clear = { ...demoCookieOptions, maxAge: 0 };
  response.cookies.set(DEMO_TRIAL_ACCOUNT_COOKIE, "", clear);
  response.cookies.set(DEMO_SETUP_DONE_COOKIE, "", clear);
}
