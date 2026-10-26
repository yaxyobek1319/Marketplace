# Marketplace: mahsulot boshqaruvi va xaridor interfeysi rejasi

Sana: 2026-10-23

## Maqsad

Sotuvchi mahsulotni rasmlari, xarakteristikalari va variantlari bilan qo‘shishi, xaridor esa mahsulotlarni ko‘rib, variant tanlab, savatga joylashi va buyurtma berishi uchun to‘liq oqim yaratish.

## Hozirgi holat

### Mavjud mahsulot boshqaruvi

Sotuvchi kabineti: `http://127.0.0.1:3000/workspace/products`.

Mahsulot qo‘shish shaklida quyidagilar mavjud:

- O‘zbekcha va ruscha nom.
- Tavsif va kategoriya.
- Ixtiyoriy MXIK kodi.
- Mahsulot rasmlarini yuklash.
- Umumiy xarakteristikalar: kalit va qiymat, masalan `Brend: Samsung`.
- Variant xarakteristikalari: masalan `Rang: qora`, `Xotira: 128 GB`.
- Har bir variant uchun SKU, narx va ombordagi son.
- Qoralama saqlash va moderatsiyaga yuborish.

Mahsulot boshqaruvi sotuvchi huquqlarini talab qiladi. Oddiy hisob ochish hisobni avtomatik faol sotuvchiga aylantirmaydi.

### Mavjud backend

- Kategoriyalar va ommaga ochiq mahsulot tafsilotlari APIlari.
- Mahsulot, variant, rasm va xarakteristikalarni boshqarish.
- Savat, buyurtma, profil, manzillar va sevimlilar APIlari.
- Moderatsiya va sotuvchi holatlarini boshqarish.
- PostgreSQL bazasi va migratsiyalar.
- Telefon raqami va parol orqali hisob ochish/kirish.

API mavjudligi tegishli oqim real muhitda boshidan oxirigacha tekshirilganini bildirmaydi.

### Qolgan asosiy qism

Hozirgi web interfeys asosan sotuvchi va platforma jamoasi kabinetidir. Bosh sahifa kabinetga yo‘naltiradi. Xaridor uchun alohida ommaviy do‘kon interfeysi hali tayyor emas.

## Xaridor uchun sahifalar

Quyidagi manzillar taklif etiladi; ishlab chiqish vaqtida mavjud kabinet bilan moslashtiriladi.

| Sahifa | Taklif etilgan yo‘l | Vazifa |
|---|---|---|
| Bosh sahifa | `/` | Kategoriyalar va mavjud faol mahsulotlarni ko‘rsatish |
| Katalog | `/catalog` | Mahsulotlar ro‘yxati, qidiruv, filtr, saralash va sahifalash |
| Kategoriya | `/catalog?category=...` | Tanlangan kategoriya mahsulotlari |
| Mahsulot | `/products/[id]` | Rasmlar, tavsif, xarakteristikalar, variantlar, narx va qoldiq |
| Savat | `/cart` | Variantlar, miqdor, sotuvchi bo‘yicha guruhlash va hisob-kitob |
| Buyurtma berish | `/checkout` | Manzil, yetkazish, yakuniy hisob va buyurtma yaratish |
| Kirish | `/login` | Telefon va parol orqali kirish yoki yangi hisob ochish |
| Profil | `/account` | Profil va manzillar |
| Buyurtmalar | `/account/orders` | Foydalanuvchining o‘z buyurtmalari |
| Buyurtma tafsiloti | `/account/orders/[id]` | Buyurtma tarkibi, to‘lov va yetkazish holatlari |
| Sevimlilar | `/account/favorites` | Saqlangan mahsulotlar |

## Funksional talablar

### Mahsulot tafsilotlari

- Rasmlar galereyasi, nom, tavsif va sotuvchi ma’lumotlari.
- Umumiy xarakteristikalarni jadvalda ko‘rsatish.
- Variant tanlash: rang, o‘lcham, xotira kabi qiymatlar.
- Tanlangan variantga tegishli narx va qoldiqni ko‘rsatish.
- Mavjud bo‘lmagan kombinatsiyani sotib olishga yo‘l qo‘ymaslik.
- Savatga qo‘shishda aniq variant identifikatoridan foydalanish.
- Narx va qoldiqni server javobidan olish.
- Mahsulot topilmagan yoki ommaga ko‘rinmaydigan holat uchun tushunarli sahifa.

### Katalog

- Ommaviy kirish: ko‘rish uchun hisob talab qilinmaydi.
- Faol va ommaga ko‘rsatishga ruxsat berilgan mahsulotlargina ko‘rsatiladi.
- Kategoriya, narx va variantlarga mos filtrlarni backend imkoniyatlariga muvofiq ulash.
- Qidiruv va saralash parametrlarini URLda saqlash.
- Sahifalash, yuklanish, bo‘sh natija va xatolik holatlari.
- Qidiruv uchun mavjud backend va Meilisearch integratsiyasini tekshirish; yetishmayotgan ommaviy katalog endpointi kerak bo‘lsa qo‘shish.

### Savat va buyurtma

- Savatdagi variant miqdorini o‘zgartirish va olib tashlash.
- Mahsulotlarni sotuvchi bo‘yicha guruhlash.
- Narx, chegirma, yetkazish va yakuniy summani backenddan olish.
- Checkoutdan oldin mavjud qoldiq va narxni qayta tekshirish.
- Mavjud checkout API talab qiladigan quote va idempotentlik mexanizmlaridan foydalanish.
- Takroriy bosish natijasida bir xil buyurtma qayta yaratilmasligi.
- Har bir foydalanuvchi faqat o‘z savati, manzillari va buyurtmalariga kira olishi.
- Real to‘lov adapteri ulanmaguncha to‘lovni muvaffaqiyatli deb ko‘rsatmaslik.

### Hisob va kirish

- Hozir telefon va parol ishlatiladi; yangi parol kamida 8 belgidan iborat.
- Telefon raqami hozir tasdiqlanmaydi; bu egalikni tasdiqlash o‘rnini bosmaydi.
- Mavjud parolsiz hisoblarga parol avtomatik berilmaydi; ular uchun alohida tiklash yoki xavfsiz parol o‘rnatish oqimi kerak.
- Telegram OTP va SMS integratsiyasi keyingi bosqichga qoldirilgan.
- Oddiy foydalanuvchini kirgandan keyin xaridor sahifasiga, sotuvchi va xodimni tegishli kabinetga yo‘naltirishni moslashtirish.
- Xodimlar uchun mavjud 2FA talablarini saqlash.

### Sotuvchi kabinetini yakunlash

- Mahsulot yaratish oqimini real bazada tekshirish.
- Umumiy va variant xarakteristikalarini saqlash hamda qayta ko‘rsatishni tekshirish.
- Rasmlar, variantlar, narx va qoldiqni tahrirlash imkoniyatlarini UI bilan to‘ldirish.
- Kategoriya bo‘lmasa tushunarli xabar ko‘rsatish; kategoriyalarni administrator orqali tayyorlash.
- Qoralama, tekshiruvda, faol va rad etilgan holatlarni ko‘rsatish.
- Rad etish sababini ko‘rsatish va qayta yuborish oqimini tekshirish.

## Bajarish tartibi

1. Mavjud APIlar va ruxsatlarni tekshirish, xaridor interfeysiga kerak bo‘ladigan bo‘shliqlarni aniqlash.
2. Kategoriyalar va sinov mahsulotlarini tayyorlash; sotuvchi yaratish va moderatsiya oqimini tekshirish.
3. Ommaviy bosh sahifa, katalog va mahsulot tafsilotlarini yaratish.
4. Xaridor uchun kirishdan keyingi yo‘naltirish, profil va manzillarni ulash.
5. Savat va checkoutni backend bilan bog‘lash.
6. Buyurtmalar tarixi, tafsilotlari va sevimlilarni ulash.
7. Real to‘lov va yetkazish integratsiyalarini tanlab, alohida ulash.
8. To‘liq oqimlarni, mobil ekranlarni va ruxsat chegaralarini tekshirish.

## Qabul qilish mezonlari

- [ ] Sotuvchi kamida ikki variantli mahsulotni rasmlari va xarakteristikalari bilan yaratadi.
- [ ] Mahsulot moderatsiyadan o‘tib, ommaviy katalogda paydo bo‘ladi.
- [ ] Mehmon katalog va mahsulot tafsilotlarini kira olmasdan ko‘ra oladi.
- [ ] Qoralama, rad etilgan va yashirilgan mahsulotlar ommaga chiqmaydi.
- [ ] Variant o‘zgarganda tegishli narx va qoldiq ko‘rinadi.
- [ ] Xaridor telefon va parol bilan hisob ochib, qayta kira oladi.
- [ ] Savatdagi miqdor va yakuniy hisob backend bilan mos keladi.
- [ ] Buyurtma takrorlanmasdan yaratiladi va egasining tarixida ko‘rinadi.
- [ ] Boshqa foydalanuvchining shaxsiy ma’lumotlari ochilmaydi.
- [ ] To‘lov ulanmagan bo‘lsa, UI haqiqiy holatni ko‘rsatadi.
- [ ] O‘zbekcha va ruscha matnlar, telefon va kompyuter ekranlari tekshiriladi.
- [ ] Backend/frontend typecheck va build, tegishli testlar o‘tadi.

## Mahalliy ishga tushirish

Loyiha katalogi: `/home/works/Desktop/Marketplace`.

Backend, birinchi terminal:

```bash
npm run dev
```

Frontend, ikkinchi terminal:

```bash
npm run dev:web
```

| Xizmat | Manzil |
|---|---|
| Frontend | `http://127.0.0.1:3000` |
| Backend API | `http://127.0.0.1:3001/api/v1` |
| Swagger | `http://127.0.0.1:3001/api/docs` |
| DB health | `http://127.0.0.1:3001/health` |
| PostgreSQL | `localhost:5432`, baza: `marketplace` |

## Bog‘liq hujjatlar

- [API qo‘llanmasi](API.md)
- [API yo‘llari](API_ROUTES.json)
- [Integratsiyalar](INTEGRATIONS.md)
- [Ish holati](IMPLEMENTATION.md)
- [Texnik topshiriq](TZ.md)

Ushbu fayl ish rejasidir. Belgilanmagan vazifalar hali bajarilgan deb hisoblanmaydi.
