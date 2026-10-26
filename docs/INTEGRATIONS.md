# Tashqi tizimlar: tayyor chegaralar va qolgan ishlar

Bu fayl haqiqiy adapter bor deb ko‘rsatmaydi. Hozir `ProviderRegistry`dagi payment/delivery/payout ro‘yxatlari bo‘sh; SMS va Push uchun `Unconfigured*Provider` qaytariladi. Telegram credentiallar bilan ishlaydigan HTTP adapterga ega, ammo real bot bilan tekshirilmagan.

## Ulash tartibi

1. `apps/api/src/integrations/providers.ts`dagi tegishli abstrakt klassni kengaytiradigan adapter yozing. Adapter faqat rasmiy provayder kontraktiga mos ishlasin.
2. Nest provider sifatida ro‘yxatdan o‘tkazing va modul initializationida `ProviderRegistry.payments/deliveries/payouts.set(name, adapter)` orqali nomga ulang. `SmsProvider`/`PushProvider` uchun Nest token bindingni almashtiring.
3. Credentiallarni runtime secret sifatida bering. `DATABASE_URL`ni va haqiqiy kalitlarni repoga yozmang.
4. Sandboxdagi haqiqiy callback, takroriy callback, vaqt tugashi, uzilish, polling va bekor qilish oqimlarini tekshiring.
5. Shundan keyin adapter nomini UI/API konfiguratsiyasida faollashtiring.

## To‘lov — Click / Payme / Uzcard

- `create(paymentId, amount)` idempotent bo‘lishi shart; providerga `paymentId`ni qayta urinishlarda bir xil kalit sifatida yuboring. `reference` va `redirectUrl` qaytadi; checkoutUrl bazada saqlanadi.
- `verifyWebhook(headers, rawBody)` haqiqiy protokol imzosi/basic-auth va tranzaksiya semantikasini tekshiradi; natija normalized paymentId/eventId/reference/amount/status.
- Ayrim provayderlar ko‘p bosqichli RPC javob formatiga ega. Ularga alohida transport controlleri kerak; umumiy webhook endpointi tayyor provayder protokoli deb hisoblanmaydi.
- Amount ichki tizimda UZS o‘nlik satr. Tiyin/so‘m konvertatsiyasini adapter aniqlikni yo‘qotmasdan bajaradi.
- `status` polling backup; `cancel` provayderdagi bekor qilishni yakuniy tasdiqlashi kerak. PENDING yoki tarmoq timeout holatida pul/zaxira rezervi bo‘shatilmaydi.
- Kech kelgan muvaffaqiyatli to‘lov bekor bo‘lgan buyurtmani qayta tiriltirmaydi: summa buyer kreditiga yoziladi.

## Payout

- TZda bank/shlyuz hali tanlanmagan. `transfer` provider idempotency key va tokenlashtirilgan destination qabul qiladi.
- PENDING/PROCESSING paytida summa rezervlangan, ledger o‘zgarmaydi.
- Network timeoutni FAILED deb talqin qilmang. SUCCESS/FAILED yakuniy holati pollingdan keyin qo‘llanadi.
- Seller uchun aniq bank fee provider javobidan olinadi; fee taxminiy 0.1–0.3% deb yozilmaydi.
- Hozir polling orqali yakunlash bor. Tanlangan provayderga xos imzolangan payout webhook transporti hali yozilmagan.

## Yetkazish

- `requestDelivery` pickup/dropoff/telefon, item va batchGroupId oladi; `Shipment.id` idempotency key.
- `chargedAmount` faqat provayder haqiqatda yechgan xarajat; narx taxmini bo‘lmasligi kerak.
- `verifyWebhook` provider reference, eventId va ShipmentStatus qaytaradi. `DELIVERED`dan keyin eski transit event holatni orqaga qaytarmaydi.
- FREE: hudud va vaqt bilan birlashtiriladi. Jismoniy birlashtirish faqat provayder qo‘llasa amalga oshadi.
- Qaytarilgan tovar uchun reverse-shipment integratsiyasi, qo‘lda retry/operator UI va FAILED holatidagi maxsus xabarlar hali yakunlanmagan.

## SMS / Push / Telegram

- SMS provayder TZda nomlanmagan; haqiqiy adapter qolgan. So‘rovga idempotency key beriladi; OTP log yoki HTTP javobida chiqmaydi.
- Push provayder tanlash/credentiallar qolgan. Invalid token javobi qurilmani nofaol qiladi.
- Telegram: token, bot username va webhook secret kerak. Bog‘lash private chatda bir martalik 10 daqiqalik token bilan bajariladi; bazada token xeshi saqlanadi.
- Yetkazish at-least-once. Timeoutdan keyin Telegramda yoki ko‘p qurilmali pushda dublikat xabar ehtimoli qoladi; kanal/qurilma darajasidagi yetkazish kuzatuvini keyingi tekshiruvda mustahkamlash kerak.

## OFD

Soliq stavkasi snapshoti va ichki soliq ledger hisoblari mavjud. Chek chiqarish/qaytarish, OFD autentifikatsiyasi va sertifikatlashtirilgan provayder integratsiyasi **yozilmagan**. Ichki soliq hisobi fiskal integratsiya o‘rnini bosmaydi.
