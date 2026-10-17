# Staff JWT — qr-service notları

Staff-site tarafında login/refresh sonrası access token çereze yazılır; `/staff/*` istekleri yalnızca `Authorization: Bearer` ile proxy edilir.

Personel login JSON yanıtı yalnızca **`accessToken`** ve **`refreshToken`** içerir; UI profili (`staffId`, `merchantId`, `branchId`, rol) access token claim'lerinden okunur. **`waiterId` kullanılmaz.**

## Staff API erişimi (qr-service)

Staff JWT (`staffId`, `merchantId`, `branchId`, rol claim) login’de `tbl_merchant_staff` satırından üretilir. API tarafında **garson/mutfak/kurye rolü ayrı kontrol edilmez**; rol yalnızca staff-site UI yönlendirmesi içindir. Geçerli token + aktif personel kaydı yeterlidir.

## "Personel bulunamadı" / eski "Garson bulunamadı" (401)

Bu mesaj **algoryqr-service** içinde üretilir. Tipik neden: JWT `staffId` ile `tbl_merchant_staff.id` eşleşmiyor veya kayıt pasif.

### qr-service’te kontrol listesi

1. `Garson bulunamadı` string’ini grep edin; fırlatan filter/resolver’ı bulun.
2. `POST /api/v1/auth/staff/login` cevabında **`staffId`** döndüğünü doğrulayın (garson/mutfak/kurye tek personel kimliği).
3. Staff access JWT payload’ında backend’in lookup’ta kullandığı claim’in **`staffId`** olduğunu doğrulayın (eski `waiterId` claim’i kaldırılmalı).
4. `/staff/orders/today` gibi uçları **doğrudan** token ile deneyin (Next proxy olmadan).
5. Staff refresh (`/api/v1/auth/tokens/refresh`) sonrası yeni access token’da aynı staff claim’lerinin kaldığını doğrulayın.

Staff-site artık login’de `staffId` yoksa 502 döner ve ID’yi body + JWT claim’lerinden (`getStaffIdFromAccessToken`) tamamlamaya çalışır; kalıcı 401 fix genelde **token üretimi / Waiter lookup** tarafındadır.
