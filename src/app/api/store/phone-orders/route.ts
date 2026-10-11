import axios, { AxiosError } from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { API_BASE_URL } from "@/lib/config";
import { markPhoneCustomerName } from "@/lib/phone-order";
import { readAccessTokenFromCookies } from "@/lib/server/auth-cookies";
import { clientContextHeaders } from "@/lib/server/client-headers";
import { parseStoreHandle } from "@/lib/store-public";
import type { StoreOrderDetail, StoreOrderPage, StorePaymentMethod } from "@/lib/store-api";

type PhoneOrderBody = {
  customerName?: unknown;
  customerPhone?: unknown;
  addressText?: unknown;
  paymentMethod?: unknown;
  note?: unknown;
  items?: unknown;
};

const PAYMENT_METHODS = new Set<StorePaymentMethod>(["CASH_ON_DELIVERY", "CARD_ON_DELIVERY"]);

function upstreamMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function upstreamFailure(error: unknown) {
  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED") {
      return NextResponse.json({ message: "Gateway timeout" }, { status: 504 });
    }
    if (error.response) {
      return NextResponse.json(error.response.data ?? {}, { status: error.response.status });
    }
  }
  return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = readAccessTokenFromCookies(cookieStore);
  if (!accessToken) {
    return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
  }

  let body: PhoneOrderBody;
  try {
    body = (await request.json()) as PhoneOrderBody;
  } catch {
    return NextResponse.json({ message: "Geçersiz JSON" }, { status: 400 });
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const addressText = typeof body.addressText === "string" ? body.addressText.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const paymentMethod = body.paymentMethod;
  const items = Array.isArray(body.items)
    ? body.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const productId = Number((item as { productId?: unknown }).productId);
        const quantity = Number((item as { quantity?: unknown }).quantity);
        if (!Number.isInteger(productId) || productId <= 0) return [];
        if (!Number.isInteger(quantity) || quantity <= 0) return [];
        return [{ productId, quantity }];
      })
    : [];

  if (!customerName || !customerPhone || !addressText) {
    return NextResponse.json({ message: "Ad, telefon ve adres zorunludur" }, { status: 400 });
  }
  if (typeof paymentMethod !== "string" || !PAYMENT_METHODS.has(paymentMethod as StorePaymentMethod)) {
    return NextResponse.json({ message: "Ödeme yöntemi seçin" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ message: "En az bir ürün ekleyin" }, { status: 400 });
  }

  const userId = getUserIdFromAccessToken(accessToken);
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(userId != null ? { "X-User-Id": String(userId) } : {}),
    ...clientContextHeaders(request),
  };

  try {
    const merchantResponse = await axios.get<{ handle?: string }>(`${API_BASE_URL}/store/me`, {
      headers: authHeaders,
      validateStatus: () => true,
      timeout: 20_000,
    });
    if (merchantResponse.status < 200 || merchantResponse.status >= 300) {
      return NextResponse.json(
        { message: upstreamMessage(merchantResponse.data, "Online sipariş mağazası bulunamadı") },
        { status: merchantResponse.status || 404 },
      );
    }
    const branchesResponse = await axios.get<
      { content?: Array<{ courierEnabled?: boolean }> } | Array<{ courierEnabled?: boolean }>
    >(`${API_BASE_URL}/branches`, {
      headers: authHeaders,
      validateStatus: () => true,
      timeout: 20_000,
    });
    if (branchesResponse.status < 200 || branchesResponse.status >= 300) {
      return NextResponse.json(
        { message: upstreamMessage(branchesResponse.data, "Şube bilgisi alınamadı") },
        { status: branchesResponse.status || 502 },
      );
    }
    const branchList = Array.isArray(branchesResponse.data)
      ? branchesResponse.data
      : (branchesResponse.data?.content ?? []);
    const courierOn = branchList.some((branch) => branch.courierEnabled === true);
    if (!courierOn) {
      return NextResponse.json({ message: "Bu şubede kurye kapalı. Paket sipariş açılamaz." }, { status: 409 });
    }

    const handle = typeof merchantResponse.data?.handle === "string" ? merchantResponse.data.handle : "";
    const parsed = parseStoreHandle(handle);
    if (!parsed) {
      return NextResponse.json({ message: "Online sipariş mağazası bulunamadı" }, { status: 409 });
    }

    const placed = await axios.post<{ orderNo?: string }>(
      `${API_BASE_URL}/store/public/${parsed.storeNo}/${encodeURIComponent(parsed.token)}/orders`,
      {
        customerName: markPhoneCustomerName(customerName),
        customerPhone,
        deliveryType: "DELIVERY",
        paymentMethod,
        address: { addressText },
        note: note || null,
        items,
      },
      {
        headers: { Accept: "application/json", "Content-Type": "application/json", ...clientContextHeaders(request) },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );
    if (placed.status < 200 || placed.status >= 300) {
      return NextResponse.json(
        { message: upstreamMessage(placed.data, "Telefon siparişi oluşturulamadı") },
        { status: placed.status || 400 },
      );
    }

    const orderNo = typeof placed.data?.orderNo === "string" ? placed.data.orderNo : "";
    const listed = await axios.get<StoreOrderPage>(`${API_BASE_URL}/store/orders`, {
      headers: authHeaders,
      params: { status: "PENDING", page: 0, size: 50 },
      validateStatus: () => true,
      timeout: 20_000,
    });
    const match = listed.data?.content?.find((order) => order.orderNo === orderNo);
    if (!match) {
      return NextResponse.json(
        { message: "Sipariş alındı ama mutfağa iletilemedi. Sipariş listesinden onaylayın." },
        { status: 502 },
      );
    }

    const confirmed = await axios.post<StoreOrderDetail>(
      `${API_BASE_URL}/store/orders/${match.id}/confirm`,
      {},
      { headers: authHeaders, validateStatus: () => true, timeout: 20_000 },
    );
    if (confirmed.status < 200 || confirmed.status >= 300) {
      return NextResponse.json(
        { message: upstreamMessage(confirmed.data, "Sipariş mutfağa iletilemedi") },
        { status: confirmed.status || 400 },
      );
    }
    return NextResponse.json(confirmed.data, { status: 201 });
  } catch (error) {
    return upstreamFailure(error);
  }
}
