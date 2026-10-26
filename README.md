# Marketplace MVP

[TZ](docs/TZ.md) asosida qurilayotgan NestJS backend. Hozirgi ish holati [modullar jadvalida](docs/IMPLEMENTATION.md), amalga oshirish qarorlari [DECISIONS.md](docs/DECISIONS.md)da.

Backend modullari yozilgan va avtomatik tekshiruvlar mavjud. **To‘liq ishga tushiriladigan MVP hali tayyor emas:** Real SMS/to‘lov/payout/kuryer/OFD adapterlari va real PostgreSQL bilan integratsion tekshiruvlar qolgan. Foydalanuvchining oxirgi topshirig‘iga ko‘ra faol ish doirasi — faqat backend. Provider chegaralari real muvaffaqiyatni taqlid qilmaydi: sozlanmagan integratsiya `503` qaytaradi.

## Texnologiyalar

Node.js 22, NestJS, Prisma/PostgreSQL, Redis/BullMQ, Meilisearch. Pul qiymatlari API orqali o‘nlik **satr** (`"100000.00"`) sifatida uzatiladi. Hisob-kitoblar `Prisma.Decimal` bilan bajariladi.

## Tekshirish — tashqi DB kerak emas

```bash
npm ci
npm run check
npm run format:check -w @marketplace/api
```

Testlar xotiradagi PGlite PostgreSQL, test dublari va Nest modul konteyneridan foydalanadi. Sizning `DATABASE_URL` manzilingizga test ulanishi yo‘q. Real PostgreSQL orqali barcha Prisma oqimlari va parallel so‘rovlar uchun integratsion/yuk tekshiruvi hali alohida kerak.

## DB ulanishi — loyiha egasi bajaradi

```bash
cp apps/api/.env.example apps/api/.env
# apps/api/.env ichida DATABASE_URL va kerakli sozlamalarni belgilang.
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Tayyor SQL migratsiyalar `apps/api/prisma/migrations/`da. `db:deploy` ularni qo‘llaydi; `db:seed` boshlang‘ich depozit bosqichlari va uz/ru bildirishnoma shablonlarini yaratadi, mavjud sozlamalarni almashtirmaydi. Ishchi DBga ulashdan oldin migratsiyalarni o‘zingizning sinov muhitida tekshiring.

Mahalliy servislar kerak bo‘lsa: `docker compose up -d`. Bu buyruq ushbu ish davomida bajarilmadi.

API: `http://127.0.0.1:3001/api/v1`. `GET /health/live` jarayonni, `GET /health` DB holatini tekshiradi.

## Kirish va sozlamalar

- Xaridor/sotuvchi: hozir telefon + parol (`POST /auth/register`, `POST /auth/login`), yangi parol kamida 8 belgi. Telefon raqami bu oqimda tasdiqlanmaydi. Mavjud hisoblarga parol avtomatik berilmaydi. SMS OTP endpointlari keyingi integratsiya uchun saqlangan. `SmsProvider` real adapterini ulash kerak. API OTP kodini javob yoki logga chiqarmaydi.
- Xodim: email + parol; Super Admin uchun TOTP majburiy.
- Access/refresh tokenlar tasodifiy opaque tokenlar; DBda faqat xeshi saqlanadi. Access 15 daqiqa, refresh 30 kun. Refresh bir marta ishlaydi; barcha sessiyalardan chiqish darhol amal qiladi.
- HTTP: `Authorization: Bearer <accessToken>`.
- `SECRET_ENCRYPTION_KEY`: 32 tasodifiy baytning hex ko‘rinishi; TOTP sirini shifrlash uchun. Bo‘sh qiymat bilan xodim yaratish ishlamaydi.
- `AUTO_CONFIRM_HOURS`, `DISPUTE_RESPONSE_HOURS`, statik yetkazish tariflari va asosiy provayderni belgilang. TZda yo‘q muddatlar avtomatik taxmin qilinmagan.
- Fon ishlarini faollashtirish: `RUN_WORKERS=true`. DB, Redis va Meilisearch tayyor bo‘lishi kerak.
- `PUBLIC_API_BASE_URL`: rasm yuklash natijasidagi ommaviy URL. `UPLOAD_DIR` uchun productionda doimiy volume kerak. Bu endpoint faqat ommaviy mahsulot rasmlari uchun.

Xodim yaratish: `npm run staff:provision -w @marketplace/api`. Buyruq JSONni stdin orqali oladi: `email`, `fullName`, `password`, `role`, ixtiyoriy `totpSecret` (Super Admin uchun majburiy). Sirlarni Gitga yozmang. Demo parol yoki yashirin test kirishi yo‘q.

## API va integratsiyalar

[API qo‘llanmasi](docs/API.md), [koddan chiqarilgan yo‘llar](docs/API_ROUTES.json), [provayder ulash talablari](docs/INTEGRATIONS.md).

Web va mobil ishlar to‘xtatilgan. Avval yozilgan `apps/web` fayllari saqlangan, ammo standart `build`, `typecheck`, `check` va CI faqat backendni tekshiradi. [Ekranlar ro‘yxati](docs/UX_BACKLOG.md) TZning D1 qismini qamrab oladi.

### Frontendchi uchun Swagger

- API ishlaganda: http://127.0.0.1:3001/api/docs
- DB ulanmasdan ko‘rish: `npm run swagger` → http://127.0.0.1:3002/api/docs
- OpenAPI eksport: `npm run swagger:export` → [docs/openapi.json](docs/openapi.json)
- JSON/YAML: `/api/docs-json`, `/api/docs-yaml`; Bearer token uchun **Authorize**.
- Ishlatish va token/checkout ketma-ketligi: [API qo‘llanmasi](docs/API.md#swagger--openapi).

Preview faqat hujjatni ochadi; endpointlarni bajarish uchun haqiqiy backend va
uning integratsiyalari ishlashi kerak. `SWAGGER_ENABLED=false` bilan asosiy
serverdagi Swagger’ni o‘chirish mumkin.

### API ishga tushmasa

`DATABASE_URL berilmagan` chiqsa, `apps/api/.env.example`dan `apps/api/.env`
yarating va o‘zingizning DB ulanish ma’lumotlarini kiriting. API aynan shu faylni
ishga tushirilgan katalogdan qat’i nazar o‘qiydi; shell environment qiymatlari
ustun turadi. `.env.example` avtomatik yuklanmaydi. DB ulanmaguncha asosiy API
ishga tushmaydi. Hujjat uchun `npm run swagger` ishlating (3002-port).
`P1001` DB serveriga yetib bo‘lmasligini, `P1000` login/parol muammosini,
`EADDRINUSE` port bandligini bildiradi. Xato loglariga ulanish sirlari chiqarilmaydi.
