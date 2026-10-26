# Backend API

Barcha yo‘llar `/api/v1` ostida. To‘liq endpoint/ruxsat ro‘yxati [API_ROUTES.json](API_ROUTES.json)da. U Nest controller metadatasidan `npm run build && node scripts/export-api.cjs` bilan olinadi; DB kerak emas.

## Umumiy kontrakt

- JSON bodyda noma’lum maydonlar rad etiladi (`400`). IDlar UUID, kategoriya IDsi musbat butun son.
- Pul va foizlar satr: `"100000.00"`, `"2.00"`. Javoblarda Decimal qiymatlari satr.
- Tilga bog‘liq nomlar `{ "uz": "...", "ru": "..." }`.
- Sahifalash: `skip=0&take=30`; `take` 1–100.
- `401`: sessiya yo‘q/yaroqsiz; `403`: ruxsat yo‘q; `404`: resurs topilmadi yoki egasi boshqa; `409`: holat/miqdor/parallel amal mos kelmaydi; `429`: kirish limiti; `503`: provayder/infratuzilma sozlanmagan.
- Sozlanmagan integratsiyani server hech qachon muvaffaqiyat deb ko‘rsatmaydi.

## Xaridor oqimi

1. `POST /auth/otp/request` — `{phone:"+998901234567",purpose:"REGISTER"}`. Login uchun `LOGIN`.
2. `POST /auth/otp/verify` — yuqoridagi maydonlar + `code`. Javob `accessToken`, `refreshToken`, `expiresIn`.
3. `POST /auth/refresh` — `{refreshToken}`; ikkala token yangilanadi. `POST /auth/logout-all` — barcha sessiyalar bekor.
4. `GET/PATCH /me`, `/me/addresses`, `/me/favorites/:id` — profil, manzillar, sevimlilar.
5. `GET /search?q=...` — Meilisearch; `GET /catalog/products/:id` — bazadan mahsulot tafsiloti.
6. `PUT /cart/items/:variantId` — `{quantity:1,deliveryType:"STANDARD"}`. Guruhni o‘zgartirish: `PUT /cart/sellers/:sellerId/delivery`.
7. `GET /cart?coupon=...` — haqiqiy narx, mavjud zaxiraga moslashtirilgan miqdor, chegirma, kredit, payable va `quoteHash`. `requestedQuantity` bilan `quantity` farqini UI xaridorga ko‘rsatishi kerak.
8. `POST /orders/checkout` — `{addressId,idempotencyKey,provider,expectedTotal,quoteHash,coupon?}`. `expectedTotal` va `quoteHash` oxirgi tasdiqlangan savat javobidan olinadi. O‘zgargan taklif 409 qaytaradi.
9. `GET /orders`, `GET /orders/:id`. To‘lov qabul qilinmaguncha seller tasdiqlay olmaydi. To‘lov provider adapteri fon ishida yaratiladi.
10. `POST /orders/items/:id/complete`, `/trust/items/:id/dispute`, `/trust/items/:id/return`, `/trust/items/:id/review` — tegishli holatga bog‘liq amallar.
11. `GET /finance/mine`, `/finance/transactions`, `/finance/payouts` — kredit va tarix.

## Sotuvchi oqimi

1. `POST /sellers` — `storeName`, `legalTaxId`, `payoutAccount` (`****1234`), `pickupAddress`.
2. `GET /sellers/mine` — PENDING → APPROVED_AWAITING_DEPOSIT → ACTIVE.
3. `POST /payments/deposit` — `{amount,provider}`; faqat haqiqiy provayder tasdig‘i depozitni ko‘paytiradi.
4. `POST /catalog/products` — categoryId, titleI18n, description?, mxikCodeOverride?, images[], variants[], attributes[]. Har variant: sku, price, stockQuantity, attributes, images[].
5. `POST /media/products` — multipart `file`, PNG/JPEG/WebP, maksimum 10 MB; qaytgan URLni mahsulot/variatsiya rasmlariga qo‘shing. Faqat ommaviy mahsulot rasmlari uchun.
6. Mahsulot: `PATCH /catalog/products/:id`, `POST .../:id/variants`, `PUT .../:id/images`, `PUT .../:id/attributes`. Matn/media yangilanganda qayta submit kerak. Moderator to‘xtatgan mahsulotni seller qayta faollashtira olmaydi.
7. `POST /catalog/products/:id/submit`; `POST /catalog/variants/:id/stock` — `{changeAmount,reason}`; narx/faollik uchun `PATCH /catalog/variants/:id`.
8. `GET /orders/seller-items`; `POST /orders/items/:id/confirm` — `{accept:true|false}`; `POST /delivery/items/:id/ready`.
9. `POST /promotions/seller` va `PATCH /promotions/seller/:id` — minAmount?, discountPercent yoki fixedAmount, couponCode?, firstPurchaseOnly, isActive, startAt?, endAt?.
10. Nizo/qaytarish `/response` endpointlari — `{description,photos}`; qaytarilgan tovar uchun `/trust/returns/:id/received`.
11. `POST /finance/payouts` — payeeType, amount, provider, destinationToken, destinationMasked, idempotencyKey. To‘liq karta raqami qabul qilinmaydi.

## Xodimlar

`POST /auth/staff/login`: email, password, code? (Super Admin uchun majburiy). Ommaviy staff ro‘yxatdan o‘tish endpointi yo‘q; operator provisioning buyrug‘i bor.

Moderator: sotuvchi/mahsulot/nizo/qaytarish navbatlari, qarorlar, sharh yashirish, kontent sanksiyalari, kalit so‘zlar. Super Admin: payout tasdiqlash, ledger/hisobotlar, komissiya/soliq, depozit bosqichlari va hold, kategoriya/MXIK, platforma aksiyalari. Ruxsatlar endpoint darajasida tekshiriladi.

Hisobot davri: `from` va `to` ISO datetime. Soliq hisobotida ledgerdagi qaytarish reversallari ham tegishli davrda hisoblanadi. CSV: `/admin/reports/finance.csv`.

## Nizo / qaytarish / sharh payloadlari

- Nizo: `{reason,evidence:{description,photos:[]}}`; reason: ITEM_NOT_RECEIVED, ITEM_SIGNIFICANTLY_DIFFERENT, DAMAGED_IN_TRANSIT, OTHER.
- Nizo qarori: `{resolution,amount?}`; BUYER_FAVOR, SELLER_FAVOR, PARTIAL.
- Return: `{reason,evidence:{description,photos:[]},unusedOriginalPackaging}`; DEFECTIVE, NOT_AS_DESCRIBED, CHANGED_MIND.
- Return qarori: `{approve}`; refund: `{restock}` (jismoniy holati tasdiqlanmagan tovar avtomatik zaxiraga qo‘shilmaydi).
- Review: `{rating:1..5,comment?,photos:[]}`; seller reply: `{reply}`.

## Bildirishnomalar

`GET /notifications`, `POST /notifications/push-tokens` (`token`, `platform`), `POST /notifications/telegram/link`, `DELETE /notifications/telegram/link`. Telegram webhook server secretini tekshiradi. `PATCH /me`da `marketingEnabled` bor.

## Swagger / OpenAPI

API ishga tushganda **http://127.0.0.1:3001/api/docs** ochiladi.
JSON: `/api/docs-json`; YAML: `/api/docs-yaml`.
127 endpoint uchun request/response sxemalari, path/query parametrlari,
status kodlari, enumlar, pagination, multipart rasm yuklash va ruxsatlar kiritilgan.

DBsiz hujjatni ko‘rish: `npm run swagger`, keyin
http://127.0.0.1:3002/api/docs. Bu server faqat hujjatni ko‘rsatadi.
`Try it out` haqiqiy APIga (`SWAGGER_API_URL`, default http://127.0.0.1:3001)
so‘rov yuboradi. API alohida ishlashi kerak; preview uchun uning `CORS_ORIGINS`
qiymatiga `http://127.0.0.1:3002` qo‘shiladi. Preview `.env` faylini avtomatik o‘qimaydi;
`SWAGGER_PORT` / `SWAGGER_API_URL` kerak bo‘lsa shell environment orqali bering.

`Authorize` ichiga OTP verify/staff login qaytargan `accessToken`ni kiriting.
`Bearer ` prefiksini qo‘shmang. Access token 900 soniya amal qiladi. Refresh
qilinganda access va refresh tokenlar birga almashtiriladi. Swagger tokenlarni
browser storage’da saqlamaydi. Staff ruxsatlari har bir operatsiya tavsifida bor.

Frontend checkout ketma-ketligi: savatga variant qo‘shish → manzil yaratish →
GET `/api/v1/cart` → POST `/api/v1/orders/checkout`. `quoteHash` va
`expectedTotal` (`cart.payable`) aynan oxirgi savat javobidan olinadi;
`idempotencyKey` bir xil checkout urinishida o‘zgarmaydi.

Eksport: `npm run swagger:export` → `docs/openapi.json`. Postman yoki OpenAPI
client generatoriga shu faylni import qilish mumkin. Oddiy API build va dev
ishga tushishi ham hujjatni yangilaydi. Generator request sxemalarini amaldagi
Zod validatorlardan, scalar response maydonlarini Prisma DMMF’dan oladi;
relation/projectionlar `scripts/openapi-responses.cjs`da saqlanadi. Yangi
endpointda validator yoki response mapping yetishmasa build xato beradi.
Biznes `refine` tekshiruvlari (summa > 0, sanalar tartibi va hokazo) hamon
serverda bajariladi, OpenAPI ularning hammasini ifodalay olmaydi.

`SWAGGER_ENABLED=false` asosiy API serverida UI va JSON/YAML route’larini o‘chiradi.
Real provider adapterlari hali ulanmagan; SMS/payment/delivery/payout/FCMga
bog‘liq amallar 503 berishi mumkin. Webhook imzo va payloadlari provider
shartnomasiga bog‘liq: ularga soxta universal format belgilanmagan.
