# TZni amalga oshirish qarorlari

Asos: foydalanuvchi bergan TZ.md. Yangi mahsulot funksiyalari qo‘shilmaydi. Quyidagilar yozilgan biznes qoidalarini ishlaydigan va tekshiriladigan kodga aylantirish tafsilotlaridir. Hali kelishilmagan nuqtalar yakuniy biznes qarori deb qaralmaydi.

| Mavzu | Hozirgi amalga oshirish | TZ bilan bog‘lanish |
|---|---|---|
| Sotuvchi tasdiqlash muddati | To‘lov tasdiqlangandan keyin 24 soat | 4/10, 12–24 soat oralig‘i |
| Bepul jo‘natish oynasi | Tayyor bo‘lgandan keyin 48 soat; mos hudud topilsa oldinroq | 6/12, 36–48 soat |
| Avto-qabul / nizo javob muddati | `AUTO_CONFIRM_HOURS` / `DISPUTE_RESPONSE_HOURS` majburiy konfiguratsiya; avto-qabul taymeri `DELIVERED`dan boshlanadi | Aniq sonlar TZda yo‘q |
| To‘lovga qadar holat | `Order.paymentStatus`, `Payment`, 30 daqiqalik rezerv muddati qo‘shildi. Provayder to‘lovni bekor qilingan deb tasdiqlamaguncha rezerv yechilmaydi | 8/10 uchun texnik holatlar; 30 daqiqa vaqtinchalik texnik qiymat |
| Payout rezervi | `PENDING/PROCESSING` summalar spendable balansdan ayiriladi; muvaffaqiyatgacha ledger o‘zgarmaydi | 8-bandni saqlaydi |
| Xaridor krediti rezervi | To‘lov kutilayotgan buyurtma krediti boshqa checkout/payoutda sarflanmaydi | 8/10, parallel sarflashni oldini oladi |
| Qaytarish | Oldingi settlementning sotuvchi/soliq/komissiya yozuvlari teskari qilinadi; qaytarilgan platforma chegirmasi xaridorga naqd ekvivalent sifatida berilmaydi | `COMPLETED`dan keyin FROZEN allaqachon bo‘shagan. Mablag‘ yetishmasa moliya aralashuvi talab qilinadi; depozitdan avtomatik undirish qo‘shilmadi |
| Qaytarish va payout | Ochiq qaytarishdagi sotuvchi sof summasi yangi payoutlardan rezervlanadi | Qaytarish bajarilguncha mablag‘ni himoya qilish |
| Qisman nizo | Xaridorga qaytadigan summa mahsulot uchun to‘langan qismdan kichik; subsidiya mutanosib teskari qilinadi; yetkazish puli qisman qarorga kiritilmaydi | 14 uchun aniq hisoblash qoidasi, biznes tasdig‘i hali kerak |
| Yetkazish tarifi | Savatda bir sotuvchi guruhiga bitta statik tarif; guruhning birinchi itemida saqlanadi. Shipment TZ sxemasiga muvofiq itemga 1:1 | 12/17 dagi guruh/item ziddiyatini yashirmaslik; keyin aniqlashtiriladi |
| Chegirmalar | Bir do‘kon uchun eng foydali bitta SELLER aksiya, keyin eng foydali bitta PLATFORM aksiya; yaxlitlash qoldig‘i deterministik taqsimlanadi | Bir nechta aksiyani qo‘shish tartibi TZda ochilmagan; keyingi muhokama nuqtasi |
| MEDIUM moderatsiya | Birinchi submitda ACTIVE + moderator navbati; keyingi rescan FLAGGED bo‘lsa SUSPENDED | 9-banddagi bosqichli oqim tanlandi; edge-case matnidagi ziddiyat saqlab qayd etilgan |
| Sotuvchi arizasini rad etish | SUSPENDED + rejectionReason | TZ SellerStatusda REJECTED yo‘q; yangi ommaviy holat qo‘shilmadi |
| Auth | DB tekshiriladigan opaque sessiyalar, hash saqlash, refresh rotation | TZ JWTni majburiy qilmaydi; akkaunt bloklanishi darhol ishlaydi |
| Yangi texnik jadvallar | Payment, LedgerGroup, OutboxEvent, AuthAttempt, Favorite; mavjud modellarga snapshot/vaqt/rezerv maydonlari | To‘lov, idempotentlik, fon ishlar, limit, sevimlilar talablari uchun |
| Audit va ledger | Biznes holati bilan bir tranzaksiyada; ledger append-only va balans SQL trigger bilan ham tekshiriladi | 8/10/18 |
| SQL bloklash | Buyurtma itemlari uchun advisory lock, zaxira uchun FOR UPDATE, balans sarflash uchun egasi bo‘yicha advisory lock | Yo‘q qator va agregat hisoblar uchun ham parallel so‘rovlarni ketma-ketlashtiradi |
| Meilisearch ranking | `sort`, `sellerRating:desc` alohida qoidalar | TZdagi `sort:sellerRating:desc` yozuvi API sintaksisiga moslashtirilgan. Manba: https://specs.meilisearch.dev/specifications/text/0123-ranking-rules-setting-api.html |

DBga ulanish, real provayderni tanlash, OFD jarayonlari va huquqiy masalalar bu ishda hal qilingan deb belgilanmaydi. TZning 19-bandiga chiqarilgan funksiyalar MVPga qo‘shilmaydi.
