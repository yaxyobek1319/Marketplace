# TZ bo‘yicha ish holati

TZning 1–19, 21–22 bo‘limlari qayta o‘qildi; 20-bo‘lim hujjatda yo‘q. Source: [TZ.md](TZ.md). Hujjat ko‘rsatmalari foydalanuvchining so‘rovidan alohida, mahsulot spetsifikatsiyasi sifatida olindi. Original TZ o‘zgartirilmadi.

## Hozirgi natija

Bu iteratsiya backend biznes modullarini boshlang‘ich skeletdan funksional service/controller darajasiga olib chiqdi. Hali to‘liq production MVP emas. Frontend/mobile, real tashqi adapterlar va real PostgreSQL bilan oxirigacha tekshirilgan user journey qolgan.

| TZ | Modul | Yozilgan qism | Qolgan / amalda tekshirilmagan |
|---|---|---|---|
| 1,11 | Auth/ruxsat | OTP xeshi/limit/urinishlar, staff scrypt/TOTP, sessiya rotation/revoke, granular guards, operator provisioning | Real SMS, UI orqali 2FA enrollment/recovery; real DB parallel kirish testlari |
| 1,11 | Profil | Profil, uz/ru, manzillar, favorites, marketing sozlamasi | Mobil ekranlar |
| 3,9 | Katalog | Mustaqil mahsulot, variant, media upload/attachment, atribut, SKU, zaxira jurnali, kategoriya/MXIK | Mahsulot/sharh shikoyat oqimi, keyword edit/delete, kategoriya risk o‘zgarishining yakuniy qoidasi, upload lifecycle |
| 7 | Sotuvchi | Ariza/review, depozit payment chegarasi, bosqichlar, faol mahsulotlar limiti, sanksiya, vaqtinchalik blokni ochish | Real depozit to‘lovi, depozitni qaytarish/bo‘shatishning yakuniy moliyaviy jarayoni |
| 4,17 | Savat/aksiya | Seller bo‘yicha guruh, preview, quantity moslashtirish, kupon/first-purchase, platforma subsidiyasi, quoteHash | UI; aksiya qo‘shilish tartibini biznes bilan yakunlash |
| 8,10 | Buyurtma/to‘lov | Snapshot, zaxira/kredit rezervi, ledger, item holatlari, tasdiqlash timeout, callback idempotentlik, polling/expiry, kech to‘lov | Haqiqiy Click/Payme/Uzcard transportlari va provayder sandbox testlari; shubhali to‘lovni bloklash UI/oqimi |
| 8 | Payout | Buyer/seller so‘rovi, rezerv, admin qarori, adapter chegarasi, retry/poll, successful posting, bank fee | Bank adapteri va webhook transporti |
| 5,14 | Nizo/qaytarish | Dalil, muddat, moderator qarori, qisman refund, taymerni to‘xtatish, 7 kun, seller response, received/refund, reversallar | Reverse logistics, hisobda pul yetishmasa moliya yechimi; bular qaror sifatida taxmin qilinmagan |
| 6,12 | Yetkazish | Item shipment, hudud/time grouping, 48 soat fallback, idempotent dispatch, callback holatlari, delivered taymeri | BTS/Fargo/Yandex adapteri, failed operator oqimi va maxsus bildirishnomalar |
| 13 | Sharh | Faqat o‘z COMPLETED xaridi, bitta sharh, tahrir/soft-delete, seller reply, matn tekshirish | Shikoyat navbati, UI, fotosuratlar uchun private evidence upload |
| 15 | Notifications | Kanal siyosati, outbox+BullMQ, retry, templates, push token, Telegram ulash/yuborish | SMS/FCM adapterlari, per-device retry dedup, real delivery testlari |
| 16 | Search | Variant indeksi, filter/sort, seller reytingi, ustuvor yashirish, bulk/rebuild | Haqiqiy Meilisearch bilan integratsion test; rebuildning to‘liq atomik variantini tekshirish |
| 18 | Admin/hisobot | Navbat APIlari, audit, ledger, stavka/tier, moliyaviy va soliq agregatlari, CSV, ko‘rish/sotilish counterlari | Next.js panel; payout/seller samaradorligi alohida hisobotlari, ruxsatli operator retry ekranlari |
| 21 | Infratuzilma | Docker servislar, API Dockerfile, CI, Prisma migratsiya, seed, formatter, testlar | Haqiqiy muhitda deploy, yuk/concurrency testlari, monitoring/backup siyosati |
| 21 D1–D4 | Frontend/dizayn | Ekranlar va API bog‘lanishi backlogi | UX maket, dizayn tizimi, Next.js va Flutter implementatsiyasi |
| 8,21 | Fiskal/OFD | Ichki tax snapshot va ledger reversallari | Real OFD integratsiyasi to‘liq qolgan |

## Tekshiruvlar

- TypeScript strict tekshiruvi va production build.
- Nest DI konteynerida modullar va endpoint ruxsat metadatasi tekshiruvi.
- Xotiradagi PostgreSQL (PGlite)da ikkala SQL migratsiya, ledger append-only/balans, nonnegative stock va stavka constraintlari.
- Chegirma yaxlitlash, kupon shartlari, notification kanal siyosati, parol/TOTP shifrlash.
- Moderator moliyaga kira olmasligi, revoked sessiya, OTP xato urinishlari.
- Takroriy completion ikkinchi marta salesCountni oshirmasligi; qisman nizo subsidy/tax/commission hisoblari.

Test dubli yoki PGlite natijasi real provider/Prisma/PostgreSQL E2E sinoviga teng deb belgilanmaydi. Foydalanuvchining DB ulanishlari ushbu ishda bajarilmadi.

## Navbatdagi ish tartibi

1. Shu backendni foydalanuvchi ulagan sinov DBda integratsion va parallel moliyaviy testlardan o‘tkazish; jadvaldagi backend bo‘shliqlarini yopish.
2. Real SMS va birinchi to‘lov adapteri; moderator/sotuvchi Next.js interfeysini backend bilan birga ishga tushirish.
3. Yetkazish/payout/OFD adapterlari, qaytarish logistikasi, hisobotlarni to‘ldirish.
4. Flutter xaridor ekranlari, barcha user journey E2E, yuk va release tekshiruvlari.

TZning 19-bandiga chiqarilgan funksiyalar qo‘shilmadi. Aniqlashtirish nuqtalari [DECISIONS.md](DECISIONS.md)da ochiq qayd etilgan.
