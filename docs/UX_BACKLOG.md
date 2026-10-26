# D1 — TZ ekranlari va backend bog‘lanishi

Bu ekranlar uchun backlog; tayyor interfeys yoki tasdiqlangan dizayn deb hisoblanmaydi. Texnologiyalar TZ bo‘yicha: xaridor mobil ilovasi Flutter, kabinet/admin Next.js.

| Sirt | Ekranlar | Asosiy API |
|---|---|---|
| Xaridor | OTP kirish/ro‘yxatdan o‘tish | auth/otp, auth/refresh |
| Xaridor | Bosh sahifa, katalog, qidiruv/filtr, mahsulot, sotuvchi profili | search, catalog, sellers/:id |
| Xaridor | Sevimlilar | me/favorites |
| Xaridor | Ko‘p sotuvchili savat, checkout | cart, orders/checkout |
| Xaridor | Buyurtmalar, item tafsiloti, qabul/nizo | orders, trust |
| Xaridor | Qaytarish, sharh | trust/items/:id/return, review |
| Xaridor | Profil, manzillar, bildirishnomalar, kredit tarixi | me, notifications, finance |
| Sotuvchi | Ariza, moderatsiya holati, depozit | sellers/mine, payments/deposit |
| Sotuvchi | Dashboard, mahsulot/variatsiya/media, zaxira | catalog/mine, catalog/products, media/products |
| Sotuvchi | Kelgan buyurtmalar, hisoblagich, jo‘natish | orders/seller-items, delivery |
| Sotuvchi | Aksiya, moliya, payout | promotions/seller, finance |
| Sotuvchi | Nizo/return javoblari, sharhga javob, Telegram ulash | trust, notifications |
| Moderator | Arizalar, mahsulot, nizo/qaytarish navbatlari | admin/queues, decision endpoints |
| Moderator | Sharhlar, sanksiyalar, kalit so‘zlar | trust/reviews, sellers/content-sanctions, admin/keywords |
| Super Admin | Payout navbati, ledger, stavka/depozit sozlamalari | admin/queues/payouts, finance, sellers/rates, admin/deposit-tiers |
| Super Admin | Kategoriya/MXIK, platforma aksiyalari, hisobot, audit | catalog/categories, promotions/platform, admin/reports, admin/audit |

Majburiy UX holatlari:

- uz/ru matnlar uzunligini hisobga olish.
- Sotuvchi guruhlarini savat, chegirma va yetkazish tanlovida alohida ko‘rsatish.
- Checkoutdan oldin haqiqiy quantity, narx, kredit va tashqi to‘lov qoldig‘ini ko‘rsatish; quoteHash o‘zgarsa qayta tasdiqlash.
- To‘lov PENDING/FAILED, qisman bekor qilingan buyurtma va kech kelgan to‘lovni tushunarli ko‘rsatish.
- Refundning odatiy yo‘li platforma krediti ekanini va kartaga chiqarish alohida so‘rovligini tushuntirish.
- Seller hisoblagichi serverdagi confirmDeadline asosida; frontend sanog‘i vakolatli manba emas.
- Qaytarish sababiga mos shart va yetkazish xarajati ko‘rsatiladi.
- Moderator va moliya amallari ruxsat bo‘yicha ko‘rinadi; UI yashirish backend tekshiruvini almashtirmaydi.
- Bo‘sh, yuklanayotgan, xatolik, retry va 403 holatlari har ekranda ishlab chiqiladi.
