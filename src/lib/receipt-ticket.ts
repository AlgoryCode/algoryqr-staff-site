export type PrintSource = "YEMEK_SEPETI" | "UBER_EATS" | "QR" | "TEST";

export type ReceiptLine = {
  quantity: number;
  name: string;
  detail?: string | null;
  unitPrice?: number | null;
};

export type ReceiptPayload = {
  platformLabel: string;
  orderNumber: string;
  createdAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryType?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
  items: ReceiptLine[];
  totalAmount?: number | null;
  currency?: string | null;
  footerLines?: string[];
};

export type MarketplaceLikeOrder = {
  id: number;
  externalOrderId: string;
  orderNumber?: string | null;
  deliveryType?: string | null;
  paymentMethod?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  note?: string | null;
  packageStatus?: string | null;
  packageCreatedAt?: string | null;
  items?: Array<{
    productName?: string | null;
    quantity: number;
    unitPrice?: number | null;
    options?: string | null;
    detail?: string | null;
  }>;
};

export type KitchenLikeOrder = {
  id: number;
  orderSource?: string | null;
  tableName?: string | null;
  customerName?: string | null;
  note?: string | null;
  waiterNote?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  items?: Array<{
    productName?: string;
    quantity: number;
    unitPrice?: number | string;
    note?: string | null;
    selectedOptions?: Array<{ optionName?: string | null }>;
  }>;
};

export function platformLabelForSource(source: PrintSource): string {
  if (source === "YEMEK_SEPETI") return "Yemek Sepeti";
  if (source === "UBER_EATS") return "Uber Eats";
  if (source === "QR") return "QR / Masa";
  return "Test fisi";
}

function formatAmount(value?: number | string | null, currency = "TRY"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function marketplaceOrderToReceipt(
  order: MarketplaceLikeOrder,
  source: "YEMEK_SEPETI" | "UBER_EATS",
): ReceiptPayload {
  return {
    platformLabel: platformLabelForSource(source),
    orderNumber: order.orderNumber?.trim() || order.externalOrderId || String(order.id),
    createdAt: order.packageCreatedAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryType: order.deliveryType,
    paymentMethod: order.paymentMethod,
    note: order.note,
    items: (order.items ?? []).map((item) => ({
      quantity: item.quantity,
      name: item.productName?.trim() || "Urun",
      detail: item.detail || item.options,
      unitPrice: item.unitPrice,
    })),
    totalAmount: order.totalAmount,
    currency: order.currency ?? "TRY",
  };
}

export function kitchenOrderToReceipt(order: KitchenLikeOrder): ReceiptPayload {
  const source = order.orderSource === "UBER_EATS" ? "Uber Eats" : order.tableName || "QR / Masa";
  return {
    platformLabel: source,
    orderNumber: String(order.id),
    createdAt: order.submittedAt || order.createdAt,
    customerName: order.customerName,
    note: [order.note, order.waiterNote].filter(Boolean).join(" | ") || null,
    items: (order.items ?? []).map((item) => ({
      quantity: item.quantity,
      name: item.productName?.trim() || "Urun",
      detail: [
        item.selectedOptions?.map((option) => option.optionName).filter(Boolean).join(", "),
        item.note,
      ]
        .filter(Boolean)
        .join(" | ") || null,
      unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    })),
    totalAmount: order.totalAmount != null ? Number(order.totalAmount) : null,
    currency: order.currency ?? "TRY",
  };
}

export function testReceiptPayload(): ReceiptPayload {
  return {
    platformLabel: "AlgoryQR Test",
    orderNumber: "TEST",
    createdAt: new Date().toISOString(),
    customerName: "Test",
    note: "Birch CV2-UN baglanti testi",
    items: [{ quantity: 1, name: "Test urun", unitPrice: 1 }],
    totalAmount: 1,
    currency: "TRY",
  };
}

export function formatReceiptText(payload: ReceiptPayload): string {
  const lines: string[] = [
    payload.platformLabel,
    `Siparis: ${payload.orderNumber}`,
  ];
  if (payload.createdAt) lines.push(payload.createdAt);
  if (payload.customerName) lines.push(`Musteri: ${payload.customerName}`);
  if (payload.customerPhone) lines.push(`Tel: ${payload.customerPhone}`);
  if (payload.deliveryAddress) lines.push(`Adres: ${payload.deliveryAddress}`);
  if (payload.deliveryType) lines.push(`Teslimat: ${payload.deliveryType}`);
  if (payload.paymentMethod) lines.push(`Odeme: ${payload.paymentMethod}`);
  lines.push("----------------");
  for (const item of payload.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.detail) lines.push(`  ${item.detail}`);
  }
  if (payload.note) {
    lines.push("----------------");
    lines.push(`Not: ${payload.note}`);
  }
  const total = formatAmount(payload.totalAmount, payload.currency ?? "TRY");
  if (total) {
    lines.push("----------------");
    lines.push(`Toplam: ${total}`);
  }
  if (payload.footerLines?.length) {
    lines.push("----------------");
    lines.push("Odeme detayi");
    for (const line of payload.footerLines) lines.push(line);
  }
  return lines.join("\n");
}

export type BillReceiptSource = {
  tableLabel: string;
  orderNumber: string;
  closedAt?: string | null;
  currency?: string | null;
  totalAmount?: number | string | null;
  paidTotal?: number | string | null;
  items?: Array<{
    quantity: number;
    productName: string;
    note?: string | null;
  }>;
  payments?: Array<{
    amount?: number | string | null;
    paymentMethod?: string | null;
    tip?: boolean;
    itemSummary?: string | null;
  }>;
};

function receiptMethodLabel(method?: string | null): string {
  if (method === "CARD") return "Kredi karti";
  if (method === "CASH") return "Nakit";
  return method?.trim() || "";
}

export function billToReceipt(source: BillReceiptSource): ReceiptPayload {
  const currency = source.currency ?? "TRY";
  const payments = source.payments ?? [];
  const methods = [
    ...new Set(payments.map((payment) => receiptMethodLabel(payment.paymentMethod)).filter(Boolean)),
  ];
  const footerLines = payments.map((payment) =>
    [
      payment.tip ? "Bahsis" : payment.itemSummary?.trim() || "Odeme",
      receiptMethodLabel(payment.paymentMethod),
      formatAmount(payment.amount, currency),
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const paid = formatAmount(source.paidTotal, currency);
  if (paid) footerLines.push(`Odenen: ${paid}`);

  return {
    platformLabel: source.tableLabel.trim() || "Adisyon",
    orderNumber: source.orderNumber,
    createdAt: source.closedAt,
    paymentMethod: methods.join(", ") || null,
    items: (source.items ?? []).map((item) => ({
      quantity: item.quantity,
      name: item.productName?.trim() || "Urun",
      detail: item.note,
    })),
    totalAmount: source.totalAmount != null ? Number(source.totalAmount) : null,
    currency,
    footerLines,
  };
}

export function receiptToHtml(payload: ReceiptPayload): string {
  const text = formatReceiptText(payload).replace(/</g, "&lt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fis ${payload.orderNumber}</title>
<style>
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;margin:16px;white-space:pre-wrap;}
@media print{body{margin:0}}
</style></head><body>${text}
<script>window.onload=()=>{window.print();}</script></body></html>`;
}

export function printReceiptInBrowser(payload: ReceiptPayload) {
  if (typeof window === "undefined") return;
  const popup = window.open("", "_blank", "width=420,height=640");
  if (!popup) return;
  popup.document.write(receiptToHtml(payload));
  popup.document.close();
}
