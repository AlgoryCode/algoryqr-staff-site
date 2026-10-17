import axios from "axios";
import http from "node:http";
import https from "node:https";

/** Limit parallel upstream sockets so garson mount does not open dozens of connections to local qr-service. */
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 8, maxFreeSockets: 4 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8, maxFreeSockets: 4 });

export const QR_SERVICE_UPSTREAM_TIMEOUT_MS = 20_000;

export const qrServiceAxios = axios.create({
  timeout: QR_SERVICE_UPSTREAM_TIMEOUT_MS,
  validateStatus: () => true,
  httpAgent,
  httpsAgent,
});

export function upstreamTimeoutMessage(target: string): { message: string; code: string; target: string } {
  return {
    message:
      "qr-service yanıt vermiyor (zaman aşımı). Yerelde 8080’deki servisi yeniden başlatın; hâlâ olursa DB bağlantısını kontrol edin.",
    code: "UPSTREAM_TIMEOUT",
    target,
  };
}
