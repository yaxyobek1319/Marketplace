# Texnik topshiriq (TZ) — Marketpleys loyihasi

*Ishlab chiqish jarayonida yangilanib boriladigan hujjat*

## 1. Rollar

Platformaning o'zida alohida "Kuryer" roli yo'q — yetkazib berish tashqi kuryerlik tarmoqlari (BTS/Fargo/Yandex Delivery) orqali; shaxsiy kuryer tarmog'i keyingi bosqichda qo'shiladi (6-bandga qarang). Admin ikkiga ajratilgan (xavfsizlik uchun — moliyaviy va kontent operatsiyalari alohida):

- **Mehmon** — ro'yxatdan o'tmagan foydalanuvchi
- **Xaridor**
- **Sotuvchi**
- **Moderator** — kontent/nizo/sanksiya bilan ishlaydi, pulga tegmaydi
- **Super Admin (Moliya)** — pul, payout, komissiya, depozit, platforma darajasidagi katalog/aksiyalar

### Xaridor

| Modul | Imkoniyatlar |
| --- | --- |
| Profil/Auth | Telefon+SMS orqali ro'yxatdan o'tish, profil/manzillarni tahrirlash, ko'p manzil saqlash |
| Katalog | Qidirish/filtrlash, kategoriya bo'yicha ko'rish, sotuvchi profilini ko'rish, **sevimlilar**ga qo'shish |
| Savat/Buyurtma | Savatga qo'shish (bir nechta sotuvchidan bo'lishi mumkin), buyurtma berish, tarixni ko'rish, holatni kuzatish |
| Yetkazib berish | Buyurtma berishda turini tanlash: **Tezkor** (kuryer, o'zi to'laydi, tez) / **Standart** (o'zi to'laydi, arzonroq) / **Bepul** (platforma to'laydi, sekinroq — hududiy birlashtirish orqali) |
| To'lov | Click/Payme/Uzcard orqali to'lash; mavjud **platforma krediti** checkout'da avtomatik qo'llanadi, kartaga chiqarishni alohida so'rash mumkin |
| Qabul/Nizo | "Qabul qildim"ni tasdiqlash (yoki avto-tasdiqlashni kutish), nizo ochish |
| Qaytarish | `COMPLETED` buyurtma bo'yicha qaytarish so'rovi yuborish (sabab va dalil bilan) |
| Sharh | `COMPLETED` buyurtmaga sharh/reyting qoldirish |
| Bildirishnoma | Buyurtma holati o'zgarganda SMS/push |

### Sotuvchi

| Modul | Imkoniyatlar |
| --- | --- |
| Ro'yxatdan o'tish | Do'kon ochish, STIR, payout hisob raqami → moderatsiya → **xavfsizlik depoziti to'lash** (`PENDING → APPROVED_AWAITING_DEPOSIT → ACTIVE`) |
| Katalog | O'z mustaqil tovar kartochkasini yaratadi (nomi, tavsifi, rasmlari, texnik parametrlari — boshqa sotuvchidan mutlaqo mustaqil, hatto bir xil tovar bo'lsa ham); **bir nechta rasm yuklash, har bir variatsiya (rang/hajm) uchun alohida rasm va narx belgilash** |
| Zaxira | Zaxira qoldig'ini qo'lda tuzatish (jismoniy yo'qotilish va h.k., sabab bilan). *Keyingi bosqich: platformadan tashqarida sotilgan tovarni "chiqim" qilish* |
| Buyurtma tasdiqlash | Kelgan buyurtmani **12-24 soat** ichida tasdiqlash yoki bekor qilish; javob bermasa avtomatik bekor qilinadi va reytingdan **Y ball** ayiriladi |
| Aksiya/chegirma | O'z do'koni doirasida qoida asosida chegirma (masalan, summadan % yoki birinchi xaridga kupon) |
| Moliya | Balans/frozen balans/depozitni ko'rish, payout so'rash, tranzaksiyalar tarixi, **soliq inobatga olingan holda hisobot olish** |
| Nizo/Qaytarish | Xaridor ochgan nizoga yoki qaytarish so'roviga dalil bilan javob berish |

### Moderator

| Modul | Imkoniyatlar |
| --- | --- |
| Sotuvchi | Arizalarni tasdiqlash/rad etish, shubhali do'konni to'xtatish |
| Katalog | Yangi mahsulot takliflarini (`PENDING_REVIEW`) ko'rib chiqish/tasdiqlash/rad etish, qoidabuzar mahsulotni yashirish |
| Nizo/Qaytarish | Ochilgan nizo va qaytarish so'rovlarini ko'rib chiqish, qaror chiqarish |
| Sanksiya | Sotuvchiga reyting jarimasi, vaqtinchalik bloklash qo'llash |
| Sharh | Qoidabuzar sharhlarni o'chirish |

### Super Admin (Moliya)

| Modul | Imkoniyatlar |
| --- | --- |
| Tranzaksiya | Barcha to'lov/payout/ledger tarixi, shubhali tranzaksiyani bloklash |
| Payout | Sotuvchi pul yechish so'rovini tasdiqlash/rad etish |
| Komissiya/Soliq | Sotuvchi bo'yicha komissiya va soliq stavkasini o'zgartirish |
| Depozit | Sotuvchi depozitini qisman/to'liq bloklash yoki bo'shatish |
| Sanksiya | Depozitni bloklash, akkauntni butunlay bloklash (`PERMANENT_BAN`) |
| Katalog boshqaruvi | Kategoriya/taksonomiyani va **MXIK kodlarini** boshqarish |
| Platforma aksiyalari | Butun platforma bo'yicha aksiya/kupon yaratish (to'liq platforma hisobidan qoplanadi) |
| Hisobot | Moliyaviy va soliq hisobotlarini eksport qilish |

> **Kengaytirish tayyorligi:** kodda rol emas, granular ruxsat (`permission`) tekshiriladi (masalan `promotions:platform:create`). Kelajakda marketing jamoasi ajralib chiqsa, faqat yangi rolga tegishli ruxsatlar biriktiriladi — modul kodiga tegilmaydi.

## 2. User journey

**Xaridor:** ro'yxatdan o'tish → katalog/sevimlilar → savat (ko'p sotuvchidan bo'lishi mumkin) → yetkazib berish turi tanlash → to'lov → **har bir sotuvchi o'z item'ini 12-24 soat ichida tasdiqlaydi** → jo'natiladi → qabul qilish (qo'lda yoki avto) / nizo / qaytarish so'rovi → sharh.

**Sotuvchi:** ro'yxatdan o'tish → moderatsiya → depozit to'lash → o'z mustaqil tovar kartochkasini (rasm/variatsiya bilan) yaratish → buyurtma kelganda 12-24 soat ichida tasdiqlash → jo'natish → escrow bo'shatilgach balansga o'tish (soliq/komissiya ushlangan holda) → payout so'rash.

## 3. Katalog arxitekturasi — sotuvchi mustaqil kartochkalari, ko'p tillilik, MXIK

**Har bir sotuvchi o'z tovar kartochkasini to'liq mustaqil yaratadi** — nomi, tavsifi, rasmlari, texnik parametrlari boshqa sotuvchining kartochkasidan mutlaqo bog'liq emas, hatto haqiqatda bir xil tovar bo'lsa ham (masalan ikkita sotuvchida ham "iPhone 17 128GB" bo'lishi mumkin — ikkalasi alohida kartochka, alohida rasm/tavsif bilan). Nomlar ikki tilda (`uz`/`ru`) saqlanadi — 2 til uchun oddiy JSON ustun yetarli, til ko'payganda migratsiya kerak emas:

```prisma
model Category {
  id       Int      @id @default(autoincrement())
  parentId Int?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  nameI18n Json       // {"uz": "Telefonlar", "ru": "Телефоны"}
  mxikCode String?    // standart MXIK kodi — Product darajasida override qilinishi mumkin
  riskLevel CategoryRiskLevel @default(LOW)
  products Product[]
}
enum CategoryRiskLevel { LOW  HIGH }

model Product {
  id               String        @id @default(uuid())
  seller           Seller        @relation(fields: [sellerId], references: [id])
  sellerId         String        // har bir kartochka bitta sotuvchiga tegishli
  category         Category      @relation(fields: [categoryId], references: [id])
  categoryId       Int
  titleI18n        Json          // {"uz": "...", "ru": "..."}
  description      String?
  mxikCodeOverride String?       // kategoriya kodidan farq qilsa
  status           ProductStatus @default(DRAFT)
  viewCount        Int           @default(0)   // Redis'dan davriy batch orqali yangilanadi — 18-bo'lim
  variants         ProductVariant[]
  images           ProductImage[]
  attributes       ProductAttribute[]
  reviews          Review[]
  scans            ProductScan[]
}
enum ProductStatus { DRAFT  PENDING_REVIEW  ACTIVE  REJECTED  SUSPENDED }

model ProductVariant {
  id            String   @id @default(uuid())
  product       Product  @relation(fields: [productId], references: [id])
  productId     String
  attributes    Json     // masalan {"xotira":"128GB","rang":"qora","ishlab chiqarilgan mamlakat":"Indoneziya"}
  sku           String
  price         Decimal  @db.Decimal(12, 2)   // narx — har sotuvchining o'z kartochkasida mustaqil
  stockQuantity Int      @default(0)
  salesCount    Int      @default(0)   // OrderItem COMPLETED bo'lganda oshiriladi, RETURNED'da kamaytirilmaydi — 18-bo'lim
  isActive      Boolean  @default(true)
  orderItems    OrderItem[]
  cartItems     CartItem[]   // 17-bo'lim
  stockMovements StockMovement[]
  images        ProductImage[]
}

model ProductImage {
  id        String          @id @default(uuid())
  product   Product         @relation(fields: [productId], references: [id])
  productId String
  variant   ProductVariant? @relation(fields: [variantId], references: [id])
  variantId String?         // null bo'lsa — umumiy mahsulot rasmi
  url       String
  sortOrder Int             @default(0)
}

model StockMovement {
  id           String   @id @default(uuid())
  variant      ProductVariant @relation(fields: [variantId], references: [id])
  variantId    String
  changeAmount Int
  type         StockMovementType
  reason       String?
  createdBy    String
  createdAt    DateTime @default(now())
}
enum StockMovementType { INITIAL  MANUAL_ADJUSTMENT  SALE  WRITE_OFF  RETURN }
```

**Nega MXIK ikki darajada (Category + Product override):** bir kategoriyadagi tovarlarning MXIK kodi turlicha bo'lishi mumkin. Kategoriya kodi — standart/tezkor to'ldirish uchun, `mxikCodeOverride` — aniqroq kod kerak bo'lganda.

## 4. Buyurtma — item darajasida mustaqil tasdiqlash, soliq

```prisma
model Order {
  id              String   @id @default(uuid())
  buyer           User     @relation(fields: [buyerId], references: [id])
  buyerId         String
  items           OrderItem[]
  totalAmount     Decimal  @db.Decimal(15, 2)
  deliveryAddress Json
  creditApplied   Decimal  @default(0) @db.Decimal(12, 2)  // BUYER_CREDIT'dan checkout'da avtomatik qo'llangan summa
  createdAt       DateTime @default(now())
}
enum DeliveryType { EXPRESS  STANDARD  FREE }

model OrderItem {
  id                  String       @id @default(uuid())
  order               Order        @relation(fields: [orderId], references: [id])
  orderId             String
  variant              ProductVariant @relation(fields: [variantId], references: [id])
  variantId           String
  quantity            Int
  priceAtPurchase     Decimal      @db.Decimal(12, 2)
  discountAmount      Decimal      @default(0) @db.Decimal(12, 2)  // shu item'ga tegishli chegirma (do'kon darajasida)
  appliedPromotionId  String?
  taxRateAtPurchase   Decimal      @db.Decimal(5, 2)  // sotuvchining o'sha paytdagi soliq stavkasi (tarix uchun)
  taxAmount           Decimal      @db.Decimal(12, 2)  // hisoblab qo'yilgan soliq summasi
  deliveryType        DeliveryType // endi item/sotuvchi guruhi darajasida — 17-bo'limga qarang
  status              OrderItemStatus @default(PENDING_SELLER_CONFIRMATION)
  confirmDeadline     DateTime?
  autoConfirmAt       DateTime?
  returnRequest       ReturnRequest?
  dispute             Dispute?   // Order emas, OrderItem'ga bog'liq — har sotuvchi bo'yicha mustaqil nizo (14-bo'lim)
  shipment            Shipment?  // 12-bo'lim
  review              Review?    // 9/13-bo'lim
}
enum OrderItemStatus {
  PENDING_SELLER_CONFIRMATION
  CONFIRMED
  SHIPPED
  COMPLETED
  DISPUTED
  RETURNED
  CANCELLED
}

model Promotion {
  id              String          @id @default(uuid())
  scope           PromotionScope  // SELLER — faqat shu sotuvchi tovarlariga; PLATFORM — Super Admin yaratadi
  sellerId        String?         // SELLER bo'lsa
  minAmount       Decimal?        @db.Decimal(12, 2)   // masalan 500,000 — chegara summasi
  discountPercent Decimal?        @db.Decimal(5, 2)
  fixedAmount     Decimal?        @db.Decimal(12, 2)    // kupon bo'lsa (masalan birinchi xaridga)
  isActive        Boolean         @default(true)
  startAt         DateTime?
  endAt           DateTime?
}
enum PromotionScope { SELLER  PLATFORM }

model SellerRatingEvent {
  id          String   @id @default(uuid())
  seller      Seller   @relation(fields: [sellerId], references: [id])
  sellerId    String
  orderItemId String?  // aniq qaysi item sabab bo'lgani (orderId emas — item darajasida aniqroq)
  points      Decimal  @db.Decimal(4, 2)
  reason      RatingEventReason
  createdAt   DateTime @default(now())
}
enum RatingEventReason { MISSED_CONFIRMATION  SELLER_CANCELLED  FAST_RESPONSE_BONUS }
```

**Sotuvchi soliq stavkasi:** `Seller.taxRate` (1%, 6%, 12% va h.k.) — har `OrderItem`da sotuv paytidagi stavka bilan hisoblab, o'zgarmas holda saqlanadi.

**Chegirma — do'kon darajasida, buyurtma darajasida emas:** `SELLER` ko'lamli aksiya faqat o'sha sotuvchining o'z tovarlariga ta'sir qiladi — savat sotuvchi bo'yicha guruhlanadi, har guruh o'z subtotal'i `Promotion.minAmount`ga yetganda, **faqat o'sha guruh** `OrderItem`lariga `discountAmount` yoziladi. Boshqa sotuvchilarning item'lariga tegmaydi. Xaridorga "yana X so'mlik tovar olsangiz chegirmaga ega bo'lasiz" eslatmasi — backend'da alohida jadval kerak emas, savat sahifasida `Promotion.minAmount − joriy_do'kon_subtotal` sifatida hisoblanadi (frontend/savat logikasi).

**Muddat o'tishi qoidasi (MVP — reassignment yo'q):** `confirmDeadline` o'tganda item bekor qilinadi (`status = CANCELLED`), pul to'liq qaytariladi, asl sotuvchiga `SellerRatingEvent(MISSED_CONFIRMATION, points = -1)` yoziladi (5 balllik shkalada, shartli boshlang'ich qiymat — amaliyotda kerak bo'lsa sozlanadi). Boshqa sotuvchiga avtomatik o'tkazish — MVP'dan keyingi bosqich.

## 5. Tovarni qaytarish (Return) — Dispute'dan alohida oqim

`Dispute` (14-bo'limda to'liq aniqlangan) — "pul noto'g'ri hisoblandi" holatiga (tovar kelmadi va h.k., hali `SHIPPED` bosqichida), `ReturnRequest` esa — "tovar qabul qilindi (`COMPLETED`), lekin xaridor endi qaytarmoqchi" holatiga tegishli. Ikkalasini aralashtirmaslik kerak:

```prisma
model ReturnRequest {
  id                    String       @id @default(uuid())
  orderItem             OrderItem    @relation(fields: [orderItemId], references: [id])
  orderItemId           String       @unique
  reason                ReturnReason
  evidencePhotos        Json?
  status                ReturnStatus @default(REQUESTED)
  deadlineDays           Int         @default(7)   // barcha sabablar uchun 7 kun — hal qilindi
  returnShippingPaidBy   ReturnShippingPayer @default(PLATFORM)
  createdAt             DateTime     @default(now())
}
enum ReturnReason { DEFECTIVE  NOT_AS_DESCRIBED  CHANGED_MIND }
enum ReturnStatus { REQUESTED  APPROVED  REJECTED  ITEM_RECEIVED  REFUNDED }
enum ReturnShippingPayer { PLATFORM  BUYER }
```

**Qoida — hal qilindi:** muddat barcha sabab turlari uchun **7 kun** (bir xil), lekin qaytarish **sharti** (holat talabi) sabab bo'yicha farqlanadi: `DEFECTIVE`/`NOT_AS_DESCRIBED` (sotuvchi aybi) — osonroq/tezroq tasdiqlanadi, `returnShippingPaidBy = PLATFORM`; `CHANGED_MIND` (xaridor fikridan qaytishi) — qat'iyroq shart (tovar ishlatilmagan, original qadoqda), `returnShippingPaidBy = BUYER`. Bu — Uzum'dagi "ishlatib qaytarish" muammosining yechimi sifatida mo'ljallangan.

## 6. Yetkazib berish — hududiy birlashtirish, shaxsiy kuryer (keyingi bosqich)

`FREE` turini tanlagan buyurtmalar bir hududdagi boshqa buyurtmalar (pullik yoki bepul) bilan bitta kuryerga birlashtiriladi. **36-48 soatlik** oyna ichida juft topilmasa, buyurtma yakka tartibda, to'liq platforma hisobidan yuboriladi. MVP'da aniq marshrut optimallashtirish (VRP) emas, hudud+vaqt oynasi bo'yicha oddiy guruhlash yetarli.

**Dispetcherlik (kuryer tayinlash):** MVP'da bu — tashqi provayderning (BTS/Fargo/Yandex Delivery) o'z vazifasi: platforma faqat manzillar+buyurtma ma'lumotini ularning API'siga yuboradi, ular eng yaqin kuryerni tayinlaydi. **Shaxsiy kuryer tarmog'i — MVP'dan keyin**, alohida mikroservis sifatida: `DeliveryProvider` interfeysi orqali (BTS/Fargo bilan bir xil interfeys) qo'shiladi.

## 7. Sotuvchi ishonch mexanizmlari — depozit va sanksiyalar

```prisma
model Seller {
  id                 String       @id @default(uuid())
  user               User         @relation(fields: [userId], references: [id])
  userId             String       @unique
  storeName          String
  legalTaxId         String?      // STIR — huquqiy/soliq talabi uchun
  payoutAccount      String?      // payout uchun bank/karta ma'lumoti (masked, 10-bo'lim)
  commissionRate     Decimal      @default(2.0) @db.Decimal(5, 2)
  taxRate            Decimal      @default(0) @db.Decimal(5, 2)
  rating             Decimal      @default(5.0) @db.Decimal(3, 2)   // operatsion ishonchlilik — mahsulot reytingidan alohida (9-bo'lim)
  status             SellerStatus @default(PENDING)
  depositBalance     Decimal      @default(0) @db.Decimal(15, 2)
  depositHeldAmount  Decimal      @default(0) @db.Decimal(15, 2)  // shubhali holatda bloklangan qism
  createdAt          DateTime     @default(now())
  products           Product[]
  ratingEvents       SellerRatingEvent[]
  sanctions          SellerSanction[]
}
enum SellerStatus { PENDING  APPROVED_AWAITING_DEPOSIT  ACTIVE  SUSPENDED }

model DepositTier {
  id              Int      @id @default(autoincrement())
  minProductCount Int      // masalan 0, keyin 20 — sotuvchining faol mahsulot soniga qarab
  depositAmount   Decimal  @db.Decimal(12, 2)
}

model SellerSanction {
  id        String       @id @default(uuid())
  seller    Seller       @relation(fields: [sellerId], references: [id])
  sellerId  String
  type      SanctionType
  reason    String
  appliedBy String        // admin id
  startAt   DateTime      @default(now())
  endAt     DateTime?     // vaqtinchalik bo'lsa
}
enum SanctionType { RATING_PENALTY  TEMP_SUSPENSION  DEPOSIT_HOLD  PERMANENT_BAN }
```

**Depozit — bosqichli, koddan mustaqil sozlanadigan (hal qilindi):** `DepositTier` jadvali Super Admin tomonidan admin panel orqali (18-bo'lim) boshqariladi, kod o'zgarishisiz. Boshlang'ich qiymat sifatida: 0 tovargacha — 500,000 so'm, 20+ faol tovarda — 1,000,000 so'm (aniq raqamlar ishga tushirishdan oldin sozlanishi mumkin). Sotuvchidan talab qilinadigan depozit — uning faol mahsulotlari soniga mos keladigan eng yuqori `minProductCount` qatoridan olinadi; bosqich oshganda (masalan 20-tovarni qo'shganda) depozitni to'ldirish talab qilinadi, bajarilmaguncha yangi mahsulot qo'shish cheklanadi.

**Ro'yxatdan o'tish oqimi — tuzatildi:** `PENDING` (ariza yuborildi) → **Moderator tasdiqlaydi** → `APPROVED_AWAITING_DEPOSIT` → depozit to'lanadi → `ACTIVE`. Moderator rad etsa, `PENDING`dan to'g'ridan-to'g'ri yopiladi — depozit hech qachon tasdiqlanmagan sotuvchidan so'ralmaydi. Depozit harakatlari `LedgerEntry`da alohida hisob turi (`SELLER_DEPOSIT`) orqali kuzatiladi.

**Adolat prinsipi:** platforma faqat xaridor tarafida emas — qaytarish (5-bo'lim) va sanksiya tizimi ikkala tomonni ham himoya qilish uchun birga loyihalangan.

## 8. To'lov va billing — ichki ledger (real "HOLD" yo'q)

O'zbekiston to'lov shlyuzlari (Click, Payme) haqiqiy authorization-hold funksiyasini qo'llab-quvvatlamaydi — xaridor to'lagan pul **darhol** yechiladi va platformaning bitta umumiy tranzaksion hisobiga tushadi. Shuning uchun escrow to'liq **ichki hisob-kitob (double-entry ledger)** darajasida amalga oshiriladi:

```prisma
model LedgerEntry {
  id          String            @id @default(uuid())
  groupId     String            // bitta biznes hodisasiga tegishli barcha yozuvlarni bog'laydi
  account     LedgerAccountType
  ownerId     String?           // SELLER_* bo'lsa sellerId
  direction   LedgerDirection
  amount      Decimal           @db.Decimal(15, 2)
  orderId     String?
  orderItemId String?           // bitta sotuvchi bir buyurtmada 2+ item sotgan holatlarni aniq ajratish uchun
  createdAt   DateTime          @default(now())
}
enum LedgerAccountType {
  PLATFORM_CASH                 // platformaning real bank/tranzaksion hisobi
  SELLER_FROZEN                 // sotuvchiga tegishli, hali muzlatilgan
  SELLER_AVAILABLE              // sotuvchi yecha oladigan balans
  SELLER_DEPOSIT                // sotuvchi xavfsizlik depoziti
  BUYER_CREDIT                  // xaridorning platforma krediti (bekor qilingan/qaytarilgan buyurtmalar shu yerga tushadi)
  PLATFORM_COMMISSION_REVENUE
  PLATFORM_SUBSIDY_EXPENSE      // bepul yetkazish/PLATFORM aksiyasi xarajati
  PLATFORM_BANK_FEE_EXPENSE     // payout paytidagi bank xizmat foizi (0.1-0.3%)
  PLATFORM_TAX_PAYABLE          // sotuvchilardan ushlab qolingan, davlatga to'lanadigan soliq
}
enum LedgerDirection { DEBIT  CREDIT }

model Payout {
  id                String       @id @default(uuid())
  payeeType         PayeeType    // SELLER yoki BUYER — bitta mexanizm, ikkalasiga ham xizmat qiladi
  payeeId           String       // sellerId yoki buyerId
  amount            Decimal      @db.Decimal(15, 2)
  status            PayoutStatus @default(PENDING)
  provider          String
  providerRef       String?      @unique
  destinationMasked String       // faqat oxirgi 4 raqam — to'liq karta raqami DBda saqlanmaydi
  requestedAt       DateTime     @default(now())
  processedAt       DateTime?
  failureReason     String?
}
enum PayeeType { SELLER  BUYER }
enum PayoutStatus { PENDING  PROCESSING  SUCCESS  FAILED }
```

**Oqim:**

1. To'lov → `DEBIT PLATFORM_CASH` / `CREDIT SELLER_FROZEN`
2. Buyurtma `COMPLETED` → `DEBIT SELLER_FROZEN` / `CREDIT SELLER_AVAILABLE` (soliq va komissiya ushlangan sof summa) + `CREDIT PLATFORM_COMMISSION_REVENUE` + `CREDIT PLATFORM_TAX_PAYABLE`
3. Payout (avtomatik, bank/shlyuz API orqali, `payeeType=SELLER` yoki `BUYER`) — provayderdan **muvaffaqiyat tasdig'i** kelgandan keyingina tegishli hisobdan (`SELLER_AVAILABLE` yoki `BUYER_CREDIT`) `DEBIT` / `CREDIT PLATFORM_CASH` yoziladi (`SELLER` uchun `PLATFORM_BANK_FEE_EXPENSE` ham qo'shiladi) — PENDING/PROCESSING bosqichida ledger o'zgarmaydi, xavfsiz retry uchun
4. **Item bekor qilinsa/nizo-qaytarish xaridor foydasiga hal bo'lsa** → `DEBIT SELLER_FROZEN` / `CREDIT BUYER_CREDIT` (**standart holat — real bank refundi emas, xaridor krediti**)
5. Xaridor keyingi buyurtma berganda mavjud `BUYER_CREDIT` **checkout'da avtomatik** qo'llanadi (`Order.creditApplied`) → `DEBIT BUYER_CREDIT` / `CREDIT SELLER_FROZEN` (yangi buyurtma bo'yicha)
6. Xaridor kreditni kartaga chiqarishni **alohida so'rasa** → `Payout(payeeType=BUYER)` — 3-bandidagi bilan bir xil oqim

**Qoidalar:**

- Bepul yetkazib berish va platforma (`PLATFORM`) aksiyalari — `PLATFORM_SUBSIDY_EXPENSE` orqali, sotuvchi ulushiga tegmaydi; `SELLER` ko'lamli aksiya esa sotuvchining o'z ulushidan kamayadi (subsidiya yozuvi kerak emas)
- Bank xizmat foizi (0.1-0.3%) — komissiya (1-2%) ichida yashiringan deb hisoblanadi, lekin hisobot uchun alohida kuzatiladi
- Har bir tashqi chaqiruv (to'lov webhooki, payout natijasi) `providerRef` bo'yicha unique — idempotentlik uchun
- Balans/ledger yozuvlari faqat Postgres tranzaksiyasi ichida, `SELECT ... FOR UPDATE` bilan
- Soliq: hisob-kitob mantiqi (yuqorida) MVP'da; davlat fiskal tizimi (OFD)ga real vaqtli ulanish — alohida, sertifikatlashtirilgan integratsiya, ishga tushirishdan oldin hal bo'lishi shart bo'lgan huquqiy talab (parallel oqim sifatida yuritiladi)

## 9. Modul: Katalog/Mahsulotlar (to'liq spetsifikatsiya)

### Maqsad

Barcha sotuvchilarga o'z mustaqil tovar kartochkalarini yaratish imkonini berish, ierarxik kategoriyalar bilan tartiblash, taqiqlangan/xavfli tovarlar sotilishining oldini olish, va buni katalog o'sishiga qaramay resurs jihatidan barqaror qilib qurish.

### Kategoriya tuzilishi

Ierarxik, chuqurligi cheklanmagan (o'z-o'ziga bog'langan `parentId`) — sxema 3-bo'limda. Kategoriyalarni faqat Super Admin yaratadi/tahrirlaydi. *MVP chegarasi:* chuqurlik cheklanmagan, lekin tezkor "ota-bobo" so'rovlari uchun `materialized path` optimallashtiruvi keyinroq qo'shiladi.

### Imkoniyatlar (rol bo'yicha)

- **Sotuvchi:** o'z mustaqil `Product` kartochkasini (kamida bitta `ProductVariant` bilan) yaratadi — mavjud kartochkalarga "qo'shilish" yo'q, har doim yangi yaratiladi; o'z kartochkasiga istalgancha variatsiya (rang/hajm/mamlakat) qo'shadi
- **Moderator:** `HIGH` xavfli kategoriyadagi va `FLAGGED`/`BLOCKED` deb belgilangan mahsulotlarni ko'rib chiqadi, tasdiqlaydi/rad etadi; taqiqlangan so'zlar ro'yxatini (`ProhibitedKeyword`) yuritadi
- **Super Admin:** kategoriya daraxtini va har birining `riskLevel`ini boshqaradi, MXIK kodlarini belgilaydi

### Moderatsiya oqimi — xavf darajasiga qarab

```prisma
model ProductScan {
  id        String     @id @default(uuid())
  product   Product    @relation(fields: [productId], references: [id])
  productId String
  type      ScanType
  result    ScanResult
  details   Json?
  createdAt DateTime   @default(now())
}
enum ScanType { SUBMISSION_KEYWORD  PERIODIC_RESCAN  USER_REPORT_TRIGGERED }
enum ScanResult { CLEAN  FLAGGED  BLOCKED }

model ProhibitedKeyword {
  id       String   @id @default(uuid())
  term     String
  severity Severity
  addedBy  String
}
enum Severity { CRITICAL  MEDIUM }
```

**Oqim:**

1. Sotuvchi `Product` yuboradi (`DRAFT → submit`)
2. `Category.riskLevel == HIGH` → to'g'ridan-to'g'ri `PENDING_REVIEW`, moderator tasdiqlamaguncha ko'rinmaydi
3. `LOW` bo'lsa → `SUBMISSION_KEYWORD` skaneri darhol ishlaydi (`ProhibitedKeyword` bo'yicha):
   - `CRITICAL` mos kelsa → `REJECTED`/`PENDING_REVIEW` — jonli chiqmaydi
   - `MEDIUM` yoki toza → `ACTIVE`, darhol jonli chiqadi
4. Fon rejimida (kunlik job) `ACTIVE` mahsulotlar `PERIODIC_RESCAN` qiladi; xaridor shikoyati (`USER_REPORT_TRIGGERED`) qo'shimcha signal beradi
5. Istalgan skan `FLAGGED`/`BLOCKED` bersa → `Product.status = SUSPENDED`, moderator navbatiga tushadi

*MVP chegarasi:* faqat matn (kalit so'z) skaneri; rasm AI moderatsiyasi — keyingi bosqich.

### Edge case'lar

- **Bir xil tovar bir nechta sotuvchida** — bu MVP'da **normal holat**, dublikat sifatida ko'rilmaydi va birlashtirilmaydi: har bir kartochka mustaqil, qidiruvda alohida-alohida ko'rinadi (xaridor narx/sotuvchi bo'yicha o'zi solishtiradi).
- **`ProhibitedKeyword` yolg'on signal berishi:** `MEDIUM` darajali so'zlar avtomatik bloklamaydi, faqat navbatga yuboradi. `CRITICAL` ro'yxati tor va aniq bo'lishi kerak.
- **Kategoriya `riskLevel` ishga tushgandan keyin o'zgartirilsa** (LOW→HIGH): mavjud `ACTIVE` mahsulotlar avtomatik `PENDING_REVIEW`ga tushmaydi — fon `PERIODIC_RESCAN` navbatiga qo'shiladi.
- **Zaxirasiz (`stockQuantity=0`) variant:** qidiruvda ko'rinishi mumkin, lekin "Savatga qo'shish" o'chirilgan holatda.
- **Kategoriya o'chirilganda:** kategoriya o'chirilmaydi (soft-delete), faqat yashiriladi.

### Erkin texnik parametrlar va reyting/sharh

```prisma
model ProductAttribute {
  id        String        @id @default(uuid())
  product   Product       @relation(fields: [productId], references: [id])
  productId String
  key       String        // "Material", "Sertifikat", "Kafolat muddati" va h.k. — MVP'da erkin matn
  value     Json          // {"uz":"...","ru":"..."} yoki matn/raqam; FILE turida url
  type      AttributeType @default(TEXT)
}
enum AttributeType { TEXT  NUMBER  FILE }

model Review {
  id          String    @id @default(uuid())
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id])
  orderItemId String    @unique   // faqat COMPLETED buyurtmaga, bitta marta
  buyer       User      @relation(fields: [buyerId], references: [id])
  buyerId     String
  product     Product   @relation(fields: [productId], references: [id])
  productId   String
  rating      Int                 // 1-5
  comment     String?
  photos      Json?               // izohga biriktirilgan suratlar
  createdAt   DateTime  @default(now())
}
```

Mahsulot reytingi (`Review` asosida) — `Seller.rating`dan (operatsion ishonchlilik) alohida. Endi har bir sotuvchining o'z kartochkasi mustaqil bo'lgani uchun, **reyting ham har bir kartochkaga alohida** tegishli (ikki sotuvchida bir xil tovar bo'lsa ham, ularning reytingi mustaqil — bu mantiqan to'g'ri, chunki xaridor tajribasi sotuvchiga bog'liq). *MVP chegarasi:* `ProductAttribute.key` erkin matn; kategoriya darajasida standart shablon (filtrlash uchun) — keyingi bosqich.

## 10. Modul: Orders/Payments/Escrow (to'liq spetsifikatsiya)

### Maqsad

Xaridor to'lovini ichki ledger orqali xavfsiz ushlab turish, har bir sotuvchining buyurtmani vaqtida bajarishini ta'minlash, va pul faqat tovar muvaffaqiyatli yetkazilgach sotuvchiga o'tishini kafolatlash — bitta buyurtmada bir nechta mustaqil sotuvchi bo'lishi mumkinligini hisobga olgan holda. Rol bo'yicha imkoniyatlar — 1-bo'limdagi jadvallarda (Xaridor: to'lov/qabul/nizo; Sotuvchi: tasdiqlash/moliya; Super Admin: tranzaksiya/payout).

### Buyurtma hayot sikli (item darajasida)

```
PENDING_SELLER_CONFIRMATION
  → (sotuvchi 12-24 soat ichida tasdiqlaydi) → CONFIRMED
  → (muddat o'tdi YOKI sotuvchi bekor qildi) → CANCELLED (pul qaytariladi, MISSED_CONFIRMATION/SELLER_CANCELLED yoziladi)
CONFIRMED → (sotuvchi jo'natadi) → SHIPPED
SHIPPED → (xaridor tasdiqlaydi YOKI autoConfirmAt yetdi) → COMPLETED
SHIPPED → (xaridor nizo ochadi) → DISPUTED → (moderator qarori) → COMPLETED / CANCELLED
COMPLETED → (qaytarish so'raldi, deadlineDays ichida, tasdiqlandi) → RETURNED
```

`Order.status` — bazada alohida ustun emas, item'lar holatidan **hisoblanadi** (barchasi `COMPLETED` → order yakunlangan; kamida bittasi `DISPUTED` → order "e'tibor talab qiladi" deb UI'da ko'rsatiladi).

### To'lov qabul qilish — idempotentlik

8-bo'limdagi `providerRef` qoidasi payout uchun yozilgan edi; kiruvchi to'lov webhooki uchun ham xuddi shunday jadval kerak:

```prisma
model PaymentWebhookEvent {
  id              String    @id @default(uuid())
  provider        String
  providerEventId String    @unique   // Click/Payme'ning o'z hodisa ID'si — idempotentlik
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime  @default(now())
}
```

Webhook kelganda avval `providerEventId` bazada bor-yo'qligi tekshiriladi — bor bo'lsa, hech narsa qilinmaydi (gateway ba'zan bir hodisani qayta yuboradi).

### Biznes qoidalar

- **Bitta to'lov, ko'p sotuvchi:** xaridor bitta umumiy summani (kredit qo'llanilgandan keyingi qoldiq) bir martalik gateway tranzaksiyasi bilan to'laydi; ichki `LedgerEntry` esa shu summani har bir sotuvchi ulushiga alohida `SELLER_FROZEN` yozuvlariga ajratib yozadi (bitta `groupId` ostida bir nechta juft yozuv).
- **Chegirma taqsimoti:** endi `Order` darajasida emas — har `OrderItem.discountAmount` o'z sotuvchisining `Promotion`iga qarab mustaqil hisoblanadi (4-bo'lim).
- **Ledger — faqat qo'shish (append-only):** hech qachon mavjud `LedgerEntry` o'zgartirilmaydi/o'chirilmaydi — tuzatish kerak bo'lsa, teskari yozuv qo'shiladi. Bu — moliyaviy audit uchun majburiy qoida.
- **Balans/zaxira yangilash** — 3 va 8-bo'limlarda aytilganidek, doim `SELECT ... FOR UPDATE` bilan bitta tranzaksiya ichida.

### Edge case'lar

- **Ko'p sotuvchili buyurtmada bitta item bekor bo'lsa:** faqat shu item `CANCELLED` bo'ladi (va unga mos `discountAmount` ham qaytariladi) — qolgan item'lar ta'sirlanmaydi, butun `Order` bekor bo'lmaydi.
- **Webhook umuman kelmasa** (tarmoq xatosi/gateway downtime): to'lov holati noaniq qolib ketmasligi uchun fon job (BullMQ) provayder API'sidan holatni davriy so'raydi (polling — webhook'ga backup sifatida).
- **Webhook ikki marta kelsa:** `providerEventId` unique tekshiruvi orqali ikkinchisi e'tiborsiz qoldiriladi.
- **Race condition** (ikki parallel so'rov bir vaqtda bitta sotuvchi balansini o'zgartirmoqchi bo'lsa): ledger append-only va agregatsiya (`SUM`) orqali hisoblanadi — tabiiy ravishda xavfsiz; agar tezlik uchun "joriy balans" alohida ustunda keshlansa, uni yozishda albatta `SELECT ... FOR UPDATE`.
- **Bekor qilingan/qaytarilgan summa** — **hal qilindi:** standart holatda `BUYER_CREDIT`ga yoziladi va keyingi xaridda avtomatik qo'llanadi; kartaga chiqarish xaridorning alohida so'rovi (8-bo'lim).

### MVP chegarasi

- Bir nechta item bir vaqtda qisman qaytariladigan murakkab holatlar avtomatlashtiriladi, lekin g'ayrioddiy (masalan chegirma noaniq taqsimlanadigan) holatlar Super Admin tomonidan qo'lda ko'rib chiqiladi.
- Real-vaqtli moliyaviy dashboard (websocket) — MVP'da oddiy ro'yxat/hisobot, real-vaqtli yangilanish keyingi bosqich.

## 11. Modul: Auth/Foydalanuvchilar (to'liq spetsifikatsiya)

### Maqsad

Ikki mutlaqo boshqa xavfsizlik talabiga ega guruhni bir-biridan ajratib autentifikatsiya qilish: **iste'molchilar** (Xaridor/Sotuvchi — ommaviy, telefon orqali) va **xodimlar** (Moderator/Super Admin — cheklangan, moliyaviy vakolatli).

### Sxema

```prisma
model User {
  id             String     @id @default(uuid())
  phone          String     @unique
  fullName       String?
  isActive       Boolean    @default(true)
  telegramChatId String?    // Telegram bot bilan ulangandan keyin to'ldiriladi (15-bo'lim)
  createdAt      DateTime   @default(now())
  addresses      Address[]
  seller         Seller?    // ixtiyoriy — bitta odam ham xaridor, ham sotuvchi bo'la oladi
}

model OtpCode {
  id         String     @id @default(uuid())
  phone      String
  codeHash   String     // hech qachon ochiq matn saqlanmaydi
  purpose    OtpPurpose
  expiresAt  DateTime
  attempts   Int        @default(0)
  consumedAt DateTime?
  createdAt  DateTime   @default(now())
}
enum OtpPurpose { REGISTER  LOGIN }

model StaffAccount {
  id               String    @id @default(uuid())
  email            String    @unique
  passwordHash     String
  fullName         String
  role             StaffRole
  isActive         Boolean   @default(true)
  twoFactorEnabled Boolean   @default(false)
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
}
enum StaffRole { MODERATOR  SUPER_ADMIN }

model RefreshToken {
  id          String          @id @default(uuid())
  subjectType AuthSubjectType // USER yoki STAFF
  subjectId   String
  tokenHash   String          @unique
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime        @default(now())
}
enum AuthSubjectType { USER  STAFF }
```

**Nega ikki alohida jadval:** `User` — ommaviy, telefon+SMS OTP orqali, parolsiz. `StaffAccount` — email+parol (2FA bilan), chunki bu akkauntlar orqali pul tasdiqlanadi. `RefreshToken` ikkalasiga ham xizmat qiladi (`subjectType` orqali).

**Bitta odam ham xaridor, ham sotuvchi:** `User.seller` — ixtiyoriy 1:1 bog'lanish, alohida akkaunt kerak emas.

### Imkoniyatlar (rol bo'yicha)

- **Har kim (mehmon):** telefon raqamini kiritish, SMS OTP olish, ro'yxatdan o'tish/kirish
- **Xaridor/Sotuvchi:** profilni tahrirlash, parolsiz — faqat OTP orqali qayta kirish, barcha qurilmalardan chiqish
- **Moderator/Super Admin:** email+parol bilan kirish, **Super Admin uchun 2FA majburiy**, Moderator uchun tavsiya etiladi

### Edge case'lar

- **SMS-bombardimon/xarajat suiiste'moli:** bitta raqamga OTP so'rovlari cheklanadi (masalan, 60 soniyada 1 marta, soatiga maksimum 5 marta)
- **Qayta ishlatiladigan telefon raqami:** operator raqamni muddat o'tgach boshqa odamga qayta berishi mumkin — bu barcha OTP-asosli tizimlarning umumiy, qabul qilingan xavfi, MVP'da alohida hal qilinmaydi
- **OTP muddati:** 2-5 daqiqa, muddat o'tsa qayta so'raladi, `attempts` limitidan oshsa vaqtincha bloklanadi
- **Xodim akkaunti bloklansa** (`isActive=false`): faol sessiyalar `RefreshToken.revokedAt` orqali darhol bekor qilinadi

### MVP chegarasi

- Ijtimoiy tarmoq orqali kirish (Google/Telegram) — keyingi bosqich
- Moderator uchun 2FA — tavsiya etiladi, majburiy emas

> **Huquqiy eslatma:** O'zbekistonning "Shaxsiy ma'lumotlar to'g'risida"gi qonuni ma'lumotlarni saqlash joyi/usuliga talab qo'yishi mumkin — bu yurist bilan tekshirilishi kerak, texnik loyihalash chegarasidan tashqarida.

## 12. Modul: Delivery (to'liq spetsifikatsiya)

### Maqsad

Har bir sotuvchining jo'natmasini (tashqi kuryerlik tarmog'i orqali) izchil kuzatish, `FREE` yetkazish uchun hududiy kechiktirish/birlashtirish strategiyasini boshqarish, va turli provayderlar bilan bir xil ichki interfeys orqali ishlash.

### Sxema

```prisma
model Shipment {
  id                  String         @id @default(uuid())
  orderItem           OrderItem      @relation(fields: [orderItemId], references: [id])
  orderItemId         String         @unique   // har sotuvchi mustaqil jo'natgani uchun — 1:1
  provider            String?        // BTS, FARGO, YANDEX_DELIVERY
  providerRef         String?        @unique   // tashqi tizim jo'natma ID'si — idempotentlik uchun ham
  status              ShipmentStatus @default(AWAITING_DISPATCH)
  batchGroupId        String?        // FREE turdagi, bir hududga guruhlangan jo'natmalar uchun umumiy ID
  scheduledDispatchAt DateTime?      // FREE uchun: shu vaqtda hali jo'natilmagan bo'lsa, yakka tartibda yuboriladi
  recipientAddress    String         // Order.deliveryAddress'dan olingan aniq manzil — kuryerga to'g'ridan-to'g'ri beriladi
  recipientPhone      String         // xaridor telefon raqami — kuryerga to'g'ridan-to'g'ri beriladi
  trackingCode        String?
  dispatchedAt        DateTime?
  deliveredAt         DateTime?
  createdAt           DateTime       @default(now())
}
enum ShipmentStatus { AWAITING_DISPATCH  BATCHED  DISPATCHED  IN_TRANSIT  DELIVERED  FAILED }

model DeliveryWebhookEvent {
  id              String    @id @default(uuid())
  provider        String
  providerEventId String    @unique
  payload         Json
  processedAt     DateTime?
  createdAt       DateTime  @default(now())
}
```

**Nega `recipientAddress`/`recipientPhone` alohida saqlanadi:** provayderga so'rov yuborilganda xaridorning aniq manzili va telefon raqami to'g'ridan-to'g'ri uzatiladi — bu "kuryer manzilni topa olmadi" holatini arxitektura darajasida minimallashtiradi (kuryer noaniqlik bo'lsa xaridorga bevosita telefon orqali bog'lanishi mumkin). `Order.deliveryAddress` (JSON) dan checkout paytida shu ikki maydon ajratib olinadi va `Shipment` yaratilganda saqlanadi — shunda manzil keyin `User.addresses`da o'zgarsa ham, o'sha jo'natmaning tarixi buzilmaydi.

**Nega `Shipment` — `OrderItem`ga 1:1, `Order`ga emas:** har sotuvchi mustaqil tasdiqlaydi va mustaqil jo'natadi (10-bo'lim), shuning uchun bitta buyurtmada 2 sotuvchi bo'lsa — 2 ta alohida jo'natma bo'ladi.

### Provayder abstraksiyasi (kod darajasida, DB emas)

```
requestDelivery(pickupAddress, dropoffAddress, recipientPhone, orderInfo) → providerRef
getStatus(providerRef) → status
cancelDelivery(providerRef)
```

Yangi provayder qo'shilganda faqat yangi adapter yoziladi, `Shipment` modeli o'zgarmaydi.

### Imkoniyatlar (rol bo'yicha)

- **Xaridor:** `trackingCode` orqali jo'natma holatini kuzatish
- **Sotuvchi:** o'z itemini "jo'natishga tayyor" deb belgilash — bu `Shipment` yaratilishini ishga tushiradi
- **Moderator/Super Admin:** `FAILED` holatdagi jo'natmalarni ko'rish, qo'lda aralashish

### Biznes qoidalar

- **`EXPRESS`/`STANDARD`:** sotuvchi "tayyor" deb belgilagach, tizim darhol tanlangan provayderga aniq manzil+telefon bilan so'rov yuboradi. Narx **statik** — kuryerlik tarifi bo'yicha belgilangan summa (hal qilindi; masofa/og'irlikka qarab dinamik hisoblash emas)
- **`FREE`:** `Shipment` yaratiladi (`AWAITING_DISPATCH`), tizim bir hududdagi boshqa jo'natmalar bilan `batchGroupId` orqali guruhlashga harakat qiladi; `scheduledDispatchAt` (36-48 soat) yetganda hali guruhlanmagan bo'lsa — yakka tartibda, to'liq platforma hisobidan yuboriladi (`PLATFORM_SUBSIDY_EXPENSE`)

> **Texnik cheklov:** "birlashtirish" — kafolatlangan marshrut optimallashtirish emas, balki vaqt bo'yicha kechiktirish strategiyasi; real jismoniy konsolidatsiya provayderning o'z tizimi qo'llab-quvvatlasa amalga oshadi, aks holda `batchGroupId` faqat ichki hisobot/xarajat taqsimoti uchun ishlatiladi.

### Edge case'lar

- **Provayder API vaqtincha ishlamasa:** so'rov navbatga (BullMQ retry) qo'yiladi; ketma-ket muvaffaqiyatsiz bo'lsa, `Shipment.status = FAILED`, Super Admin xabardor qilinadi
- **Kuryer yetkaza olmasa** (manzil emas — masalan xaridor uyda yo'q): aniq manzil+telefon berilgani uchun bu holat minimallashtirilgan, lekin yuz bersa — `FAILED`, xaridor/sotuvchiga bildirishnoma, qayta urinish yoki nizo jarayoni
- **Bir buyurtmada 2 sotuvchi, turli vaqtda yetib kelishi:** arxitekturaning tabiiy natijasi, UI'da alohida-alohida ko'rsatiladi
- **`batchGroupId` ichidagi bitta jo'natma bekor qilinsa:** qolgan guruh a'zolariga ta'sir qilmaydi

### MVP chegarasi

- Ko'p-provayderli avtomatik fallback — MVP'da bitta asosiy provayder + operatorning qo'lda aralashuvi zaxira sifatida
- Kuryerning real-vaqtli joylashuvini xaritada ko'rsatish — faqat provayder taqdim etsa

## 13. Modul: Reviews/Reyting (to'liq spetsifikatsiya)

### Maqsad

Xaridorlarga "haqiqiy xaridorlar" tomonidan yozilgan, ishonchli sharhlar orqali tanlov qilishda yordam berish; sotuvchiga sharhga javob berish imkonini berish; soxta/spam sharhlarning oldini olish.

### Sxema — 9-bo'limdagi `Review`ga qo'shimchalar

```prisma
model Review {
  // ... 9-bo'limdagi mavjud maydonlar (rating, comment, photos, orderItemId @unique)
  sellerReply   String?     // sotuvchining javobi
  sellerReplyAt DateTime?
  deletedAt     DateTime?   // moderator tomonidan olib tashlansa (soft-delete, tarix uchun)
  deletedReason String?
}
```

### Imkoniyatlar (rol bo'yicha)

- **Xaridor:** faqat `COMPLETED` bo'lgan o'z xaridiga sharh yozadi (1 marta), o'z sharhini istalgan vaqt tahrirlaydi/o'chiradi
- **Sotuvchi:** o'z mahsulotiga yozilgan sharhga **bitta ochiq javob** yozadi — sharhning o'zini o'chira olmaydi
- **Moderator:** qoidabuzar sharhni yashiradi (`deletedAt`+`deletedReason`)

### Biznes qoidalar — soxta sharhlarga qarshi kafolat

- **"Haqiqiy xarid" talabi:** `Review.orderItemId @unique` + faqat `COMPLETED` holatidagi item — bu ikki qoida birgalikda soxta sharhlarning oldini **arxitektura darajasida** oladi
- **Matn skaneri qayta ishlatiladi:** 9-bo'limdagi `ProhibitedKeyword` tekshiruvi sharh matniga va `sellerReply`ga ham qo'llaniladi — yangi infratuzilma kerak emas
- **Mahsulot reytingi va sotuvchi reytingi alohida qoladi** (9-bo'limda kelishilganidek): biri sifatni, ikkinchisi operatsion tezlikni o'lchaydi

### Edge case'lar

- **Sharh buyurtma qaytarilgandan (`RETURNED`) keyin ham qoldirilgan bo'lsa:** o'chirilmaydi, lekin UI'da "bu xarid qaytarilgan" belgisi qo'yilishi mumkin (post-MVP UI detali)
- **Rasm moderatsiyasi:** 9-bo'limdagi qarorga mos — MVP'da sharh fotosuratlari AI orqali skanerlanmaydi, faqat foydalanuvchi shikoyati orqali moderatorga yetadi

### MVP chegarasi

- "Foydali edi/emas" ovoz berish (sharh reytingi) — keyingi bosqich
- Sharh fotosuratlarining AI moderatsiyasi — keyingi bosqich

## 14. Modul: Disputes/Nizolar (to'liq spetsifikatsiya)

### Maqsad

`SHIPPED` holatidagi item bo'yicha jiddiy muammo yuzaga kelganda, xaridorni tasdiqlashga majburlamasdan, pulni muzlatilgan holda saqlab, adolatli hal qilish. `Dispute` va `ReturnRequest` farqi: Dispute — hali tasdiqlanmagan (`SHIPPED`) buyurtma uchun, Return — allaqachon tasdiqlangan (`COMPLETED`) buyurtma uchun.

### Sxema

```prisma
model Dispute {
  id                     String    @id @default(uuid())
  orderItem              OrderItem @relation(fields: [orderItemId], references: [id])
  orderItemId            String    @unique
  reason                 DisputeReason
  buyerEvidence          Json?              // suratlar, tavsif
  sellerEvidence         Json?              // sotuvchining dalili/javobi
  sellerResponseDeadline DateTime?
  status                 DisputeStatus @default(OPEN)
  resolution             DisputeResolution?
  resolutionAmount       Decimal?  @db.Decimal(12, 2)  // PARTIAL bo'lsa — xaridorga qaytariladigan qism
  resolvedBy             String?            // moderator id
  resolvedAt             DateTime?
  createdAt              DateTime  @default(now())
}
enum DisputeReason { ITEM_NOT_RECEIVED  ITEM_SIGNIFICANTLY_DIFFERENT  DAMAGED_IN_TRANSIT  OTHER }
enum DisputeStatus { OPEN  UNDER_REVIEW  RESOLVED }
enum DisputeResolution { BUYER_FAVOR  SELLER_FAVOR  PARTIAL }
```

### Imkoniyatlar (rol bo'yicha)

- **Xaridor:** `SHIPPED` holatidagi itemga nizo ochadi (dalil bilan) — bu tasdiqlash/avto-tasdiqlashni to'xtatadi
- **Sotuvchi:** `sellerResponseDeadline` ichida dalil bilan javob beradi
- **Moderator:** ikkala tomon dalilini ko'rib qaror chiqaradi, zarur bo'lsa sotuvchiga sanksiya qo'llaydi (7-bo'lim)

### Biznes qoidalar

- Nizo ochilishi bilan `OrderItem.status = DISPUTED`, `autoConfirmAt` bekor bo'ladi — pul `SELLER_FROZEN`da qoladi
- **Qaror natijasi — ledger:**
  - `BUYER_FAVOR` → `DEBIT SELLER_FROZEN` / `CREDIT BUYER_CREDIT` (to'liq), `OrderItem.status = CANCELLED`
  - `SELLER_FAVOR` → item odatdagi yo'l bilan `COMPLETED`ga o'tadi, pul sotuvchiga normal tarzda bo'shatiladi
  - `PARTIAL` → `resolutionAmount` qismi `BUYER_CREDIT`ga, qolgani sotuvchiga
- **Sotuvchi javob bermasa** (`sellerResponseDeadline` o'tsa): sukut bo'yicha `BUYER_FAVOR`
- Nizo `BUYER_FAVOR` bilan yakunlansa, avtomatik `SellerRatingEvent` yaratilmaydi (moderator qo'lda baholaydi), lekin takrorlansa moderator `SellerSanction` qo'llashi mumkin (7-bo'lim)

### Edge case'lar

- **Xaridor nizoni suiiste'mol qilsa:** MVP'da alohida "xaridor sanksiyasi" tizimi yo'q — moderator qo'lda `SELLER_FAVOR` beradi; sistematik kuzatish — keyingi bosqich
- **Dispute va Return bir vaqtda ochilmasligi:** ikkalasi ham `orderItemId @unique` va turli statuslarga bog'liq bo'lgani uchun tabiiy oldini olinadi
- **Qaror chiqargandan keyin yangi dalil topilsa:** MVP'da qaror yakuniy — apellyatsiya keyingi bosqich

### MVP chegarasi

- Xaridor tomonidan nizoni suiiste'mol qilishni avtomatik aniqlash — keyingi bosqich
- Moderator qaroriga apellyatsiya — keyingi bosqich

## 15. Modul: Notifications (SMS/Push/Telegram) (to'liq spetsifikatsiya)

### Maqsad

Muhim voqealar haqida foydalanuvchini kechiktirmasdan xabardor qilish, lekin SMS xarajatini nazorat qiladigan tarzda — bepul kanallar (Push, Telegram) birinchi navbatda, SMS faqat zarur bo'lganda.

### Sxema

```prisma
model PushToken {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  token     String   @unique
  platform  String   // ios, android
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model TelegramLinkToken {
  id         String    @id @default(uuid())
  userId     String
  token      String    @unique   // bir martalik, deep-link uchun: t.me/BotName?start=<token>
  expiresAt  DateTime
  consumedAt DateTime?
}

model NotificationTemplate {
  id        String                 @id @default(uuid())
  eventType NotificationEventType  @unique
  bodyI18n  Json                   // {"uz": "...", "ru": "..."} — o'zgaruvchilar bilan
  critical  Boolean                @default(false)  // true bo'lsa, bepul kanal yetmasa SMS fallback ishlaydi
}
enum NotificationEventType {
  SELLER_CONFIRMATION_NEEDED   // sotuvchiga: yangi buyurtma, tasdiqlang
  ORDER_SHIPPED                // xaridorga
  DISPUTE_OPENED               // sotuvchiga: javob bering
  DISPUTE_RESOLVED             // ikkalasiga
  PAYOUT_COMPLETED             // sotuvchi/xaridorga
  PROMOTION_REMINDER           // xaridorga — faqat bepul kanal, kritik emas
}

model Notification {
  id          String               @id @default(uuid())
  userId      String
  channel     NotificationChannel
  eventType   NotificationEventType
  payload     Json                 // shablonga qo'yiladigan qiymatlar (orderId, summa va h.k.)
  status      NotificationStatus   @default(PENDING)
  providerRef String?              // SMS shlyuzi/Telegram xabar ID'si
  sentAt      DateTime?
  createdAt   DateTime             @default(now())
}
enum NotificationChannel { SMS  PUSH  TELEGRAM }
enum NotificationStatus { PENDING  SENT  FAILED }
```

**Telegram ulash oqimi** (`User.telegramChatId`, 11-bo'limga qo'shildi): sotuvchi "Telegram botni ulash" tugmasini bosadi → `TelegramLinkToken` yaratiladi → `t.me/BotName?start=<token>` havolasi ko'rsatiladi → botda `/start` bosilganda backend webhook orqali `token`+`chat_id` oladi → tekshirilib, `User.telegramChatId` saqlanadi, token yopiladi.

### Biznes qoidalar — xarajatni nazorat qiluvchi yuborish mantig'i

1. Voqea yuz berganda `NotificationTemplate.critical` tekshiriladi
2. `critical=true` → mavjud **bepul** kanallarning barchasiga (Push va/yoki Telegram, qaysi ulangan bo'lsa) yuboriladi
3. Ikkalasi ham yo'q/ulanmagan bo'lsagina → **SMS fallback**
4. `critical=false` (masalan `PROMOTION_REMINDER`) → faqat Push/Telegram, SMS hech qachon

**Qaysi voqealar `critical`:** `SELLER_CONFIRMATION_NEEDED` (10-bo'limdagi 12-24 soatlik muddat bilan bog'liq), `DISPUTE_OPENED`/`DISPUTE_RESOLVED`, `PAYOUT_COMPLETED`.

### Imkoniyatlar (rol bo'yicha)

- **Xaridor/Sotuvchi:** ilovaga kirganda `PushToken` avtomatik ro'yxatdan o'tadi; Telegram botni ixtiyoriy ulash; marketing (`critical=false`) xabarlaridan voz kechish sozlamasi
- **Super Admin/Moderator:** `NotificationTemplate` matnini (ikki tilda) tahrirlash — kod deploy qilmasdan

### Edge case'lar

- **SMS shlyuzi vaqtincha ishlamasa:** `FAILED`, BullMQ retry (cheklangan urinish soni bilan)
- **Push token eskirgan:** yetkazilmadi javobi kelsa, `PushToken.isActive=false`, keyingi safar boshqa kanalga/SMS'ga tushadi
- **Sotuvchi Telegram botni bloklasa/o'chirsa:** Telegram API xato qaytaradi (`chat not found`) → `telegramChatId=null`, keyingi xabarlar avtomatik boshqa kanalga tushadi
- **Bitta foydalanuvchi ko'p qurilmada:** `PushToken` bir nechta bo'lishi mumkin — barcha faol qurilmalarga yuboriladi

### MVP chegarasi

- Email kanali — keyingi bosqich
- Granular kanal sozlamasi (har turdagi xabarni qaysi kanalda olish) — MVP'da faqat marketing on/off

## 16. Modul: Search/Qidiruv (to'liq spetsifikatsiya)

### Maqsad

Xaridorga katalog bo'yicha tez, imlo xatolarga chidamli qidiruv/filtrlash berish — bir xil tovar bir nechta mustaqil sotuvchi kartochkasida bo'lishi mumkinligi uchun, xaridor ularni narx/reyting bo'yicha solishtira olishi kerak.

### Texnologik yondashuv

**Meilisearch** (Elasticsearch emas) — MVP hajmi uchun yengil, DevOps xarajati kam, imlo xatolarga chidamli qidiruvni o'rnatilgan holda beradi. Yangi Postgres jadvali shart emas — Postgres asosiy manba, Meilisearch faqat indeks, sinxronizatsiya BullMQ orqali.

**Indekslanadigan hujjat (`ProductVariant` darajasida):**

```
{
  variantId, productId, sellerId,
  titleI18n, categoryId, categoryPath,
  price, stockQuantity, inStock,
  ratingAvg,       // mahsulot reytingi (Review'dan, 13-bo'lim)
  sellerRating,     // sotuvchi reytingi (Seller.rating, 7-bo'lim) — saralashda ishlatiladi
  mainImageUrl, createdAt
}
```

**Saralash — sotuvchi reytingi hisobga olinadi:** Meilisearch ranking qoidalari:

```
words, typo, proximity, attribute, sort:sellerRating:desc, exactness
```

Qidiruv so'ziga bir xil darajada mos kelgan natijalar orasida (masalan ikkita sotuvchining bir xil tovari) — **yuqori `sellerRating`ga ega sotuvchining tovari birinchi chiqadi**.

**Sinxronizatsiya qoidalari:**

- `Product`/`ProductVariant` yaratilganda, narx/zaxira o'zgarganda, yoki `status` o'zgarganda → BullMQ job indeksni yangilaydi/o'chiradi
- **Moderatsiya bilan bog'liq o'chirish — yuqori ustuvorlik** navbatida
- **`Seller.rating` o'zgarganda** — shu sotuvchining barcha faol variantlari uchun ommaviy (bulk) qayta indekslash job'i
- **Kechayu-kunduz to'liq qayta indekslash** — xavfsizlik to'ri sifatida, Postgres bilan farqni tuzatadi

### Imkoniyatlar (rol bo'yicha)

- **Xaridor:** matn bo'yicha qidirish (ikkala tilda), kategoriya/narx oralig'i bo'yicha filtrlash, narx/reyting bo'yicha saralash
- **Sotuvchi/Moderator/Super Admin:** alohida imkoniyat yo'q — indeksga yozish avtomatik

### Biznes qoidalar

- Faqat `Product.status = ACTIVE` variantlar indekslanadi
- Zaxirasiz variant indeksda qoladi (`inStock=false`) — ko'rinadi, lekin sotib olib bo'lmaydi
- Qidiruv har doim Meilisearch'dan o'qiladi, Postgres'ga to'g'ridan-to'g'ri so'rov yuborilmaydi

### Edge case'lar

- **Narx/reyting yangi o'zgargan, indeks hali sinxronlanmagan:** bir necha soniyalik kechikish qabul qilinadi — checkout paytida har doim Postgres'dagi haqiqiy narx tekshiriladi
- **Meilisearch vaqtincha ishlamay qolsa:** faqat qidiruv sahifasi ta'sirlanadi, mahsulot sahifasi/checkout Postgres orqali ishlashda davom etadi
- **Moderator tovarni yashirsa, indeks kechiksa:** yuqori ustuvorlik navbati bu oynani minimallashtiradi, lekin nolga tushirmaydi

### MVP chegarasi

- `ProductAttribute` bo'yicha faset-filtrlash — 9-bo'limdagi qarorga mos, keyingi bosqich
- Shaxsiylashtirilgan tavsiyalar — keyingi bosqich
- Sinonim lug'ati — keyingi bosqich

## 17. Modul: Cart/Savat (to'liq spetsifikatsiya)

### Sxema

```prisma
model Cart {
  id        String     @id @default(uuid())
  buyer     User       @relation(fields: [buyerId], references: [id])
  buyerId   String     @unique   // xaridorga bitta faol savat
  updatedAt DateTime   @updatedAt
  items     CartItem[]
}

model CartItem {
  id           String       @id @default(uuid())
  cart         Cart         @relation(fields: [cartId], references: [id])
  cartId       String
  variant      ProductVariant @relation(fields: [variantId], references: [id])
  variantId    String
  quantity     Int
  deliveryType DeliveryType @default(STANDARD)   // item/sotuvchi guruhi darajasida — checkout'da OrderItem.deliveryType'ga ko'chadi
  addedAt      DateTime     @default(now())
  @@unique([cartId, variantId])
}
```

### Imkoniyatlar (rol bo'yicha)

- **Xaridor:** mahsulot qo'shish/miqdorni o'zgartirish/olib tashlash, har sotuvchi guruhi uchun yetkazish turini tanlash, savat qurilmalar orasida sinxron

### Biznes qoidalar

- Narx/zaxira savatda saqlanmaydi — checkout paytida har doim `ProductVariant`dan real vaqtda o'qiladi
- Chegirma/kredit preview savat sahifasida jonli hisoblanadi (`Promotion`/`BUYER_CREDIT`, 8/10-bo'lim), lekin `CartItem`da saqlanmaydi
- Savat faqat ro'yxatdan o'tgan xaridorga tegishli; mehmon savati MVP'da yo'q

### Edge case'lar

- **Savatdagi mahsulot moderatsiya tomonidan yashirilgan/`SUSPENDED` bo'lsa:** savatda "mavjud emas" deb ko'rsatiladi, checkout'ga o'tkazilmaydi
- **Checkout paytida zaxira yetarli bo'lmasa:** miqdor avtomatik moslashtiriladi yoki item checkout'dan chiqarib tashlanadi
- **Narx savatga qo'shilgandan keyin o'zgargan bo'lsa:** checkout'da yangi narx ko'rsatiladi

### MVP chegarasi

- Mehmon (login qilmagan) savati — keyingi bosqich
- "Keyinroq uchun saqlash" ro'yxati — keyingi bosqich

## 18. Modul: Admin panel (moderatsiya, hisobotlar, counterlar) (to'liq spetsifikatsiya)

### Maqsad

Moderator/Super Admin uchun barcha navbat asosidagi ishlarni bitta joyda boshqarish, audit tarixini yuritish, va tovar bo'yicha ko'rish/sotilish statistikasini yuritish.

### Sxema — audit jurnali

```prisma
model AdminActionLog {
  id         String          @id @default(uuid())
  staffId    String          // StaffAccount id (11-bo'lim), akkaunt o'chirilsa ham saqlanib qoladi
  actionType AdminActionType
  targetType String          // "Seller", "Product", "Dispute", "Payout", "Category" va h.k.
  targetId   String
  metadata   Json?           // oldingi/keyingi qiymat — masalan {from: 2.0, to: 2.5}
  createdAt  DateTime        @default(now())
}
enum AdminActionType {
  SELLER_APPROVED  SELLER_SUSPENDED
  PRODUCT_APPROVED  PRODUCT_REJECTED
  DISPUTE_RESOLVED  SANCTION_APPLIED
  PAYOUT_APPROVED  PAYOUT_REJECTED
  CATEGORY_EDITED  COMMISSION_RATE_CHANGED  TAX_RATE_CHANGED
  PROMOTION_CREATED  REVIEW_DELETED
}
```

**Nega alohida jurnal:** har bir modeldagi `appliedBy`/`resolvedBy` faqat "oxirgi kim harakat qilgani"ni bildiradi; `AdminActionLog` esa kesishuvchi tarix — "bitta xodim nima qilgan" yoki "bitta sotuvchi ustida qanday amallar bo'lgan". Har bir amal bajarilganda, tegishli model maydoni bilan **bir vaqtda, bitta tranzaksiya ichida** yoziladi.

### Tovar statistikasi — ko'rish va sotilish counterlari

`Product.viewCount` va `ProductVariant.salesCount` (3-bo'limga qo'shildi) — ikkalasi ham bor, lekin **turli yozish strategiyasi** bilan, chunki chastotalari mutlaqo boshqacha:

- **`viewCount`** — yuqori chastotali: to'g'ridan-to'g'ri Postgres'ga emas, avval **Redis `INCR`**, so'ng fon job (BullMQ, masalan har daqiqada) ommaviy (batch) Postgres'ga yozadi. Bu bazani ortiqcha yuklamaydi, "deyarli aniq" (eventually consistent) hisoblanadi
- **`salesCount`** — past chastotali, aniqlik muhim: `OrderItem.status → COMPLETED` bo'lganda, xuddi shu tranzaksiya ichida (ledger yozuvi bilan bir vaqtda, 10-bo'lim) `quantity`ga qarab oshiriladi; `RETURNED` bo'lganda **kamaytirilmaydi** (tarixiy/marketing ko'rsatkichi sifatida qoladi)
- Mahsulot darajasidagi jami sotilganlar — alohida saqlanmaydi, `ProductVariant.salesCount`lar yig'indisi sifatida hisoblanadi

### Imkoniyatlar (rol bo'yicha) — mavjud bo'limlardan jamlangan

**Moderator:** sotuvchi arizalari (1-bo'lim), mahsulot moderatsiyasi (9-bo'lim), nizolar (14-bo'lim), qaytarish so'rovlari (5-bo'lim), sharh moderatsiyasi (13-bo'lim), sanksiya qo'llash (7-bo'lim)

**Super Admin:** payout tasdiqlash (8-bo'lim), tranzaksiya/ledger monitoring (8-bo'lim), komissiya/soliq stavkasi (8-bo'lim), depozit boshqaruvi (7-bo'lim), kategoriya/MXIK boshqaruvi (9-bo'lim), platforma aksiyalari (4-bo'lim)

### Hisobotlar (mavjud ma'lumotlar ustidan real-vaqtli agregat so'rovlar)

- **Moliyaviy hisobot:** davr bo'yicha `LedgerEntry` agregatsiyasi (`PLATFORM_COMMISSION_REVENUE`, `PLATFORM_SUBSIDY_EXPENSE`, `PLATFORM_BANK_FEE_EXPENSE`)
- **Soliq hisoboti (sotuvchi kesimida):** `OrderItem.taxAmount` yig'indisi, sotuvchi/davr bo'yicha
- **Sotuvchi samaradorligi:** `SellerRatingEvent`, `Dispute` statistikasi
- **Payout hisoboti:** muvaffaqiyatli/muvaffaqiyatsiz payoutlar, bank xarajati jamlanmasi
- **Eng ko'p ko'rilgan/sotilgan tovarlar:** `viewCount`/`salesCount` bo'yicha saralash

### Edge case'lar

- **Ikki moderator bir vaqtda bitta nizoni hal qilishga urinsa:** birinchi yozgan g'olib, ikkinchisi "allaqachon hal qilingan" xabarini oladi — MVP uchun yetarli
- **Xodim akkaunti o'chirilgandan keyin:** `AdminActionLog` yozuvlari saqlanib qoladi (`staffId` — soft-reference)
- **Redis vaqtincha ishlamasa:** `viewCount` yangilanishi to'xtaydi, lekin sahifa ko'rsatish/xarid jarayoniga ta'sir qilmaydi (statistika — ikkilamchi funksiya)

### MVP chegarasi

- Avtomatik/rejalashtirilgan hisobot eksporti — qo'lda "eksport qilish" tugmasi MVP'da yetarli
- Real-vaqtli dashboard (grafik/widget) — jadval ko'rinishidagi hisobotlar yetarli
- Noyob ko'ruvchilar soni, ko'rish→xarid konversiyasi — keyingi bosqich

## 19. MVP'dan keyingi bosqichga qoldirilgan funksiyalar

- Shaxsiy kuryer tarmog'i (6-bo'lim)
- Platformadan tashqarida sotilgan tovarni "chiqim" qilish (zaxira hisobot funksiyasi)
- Buyurtmani boshqa sotuvchiga avtomatik o'tkazish (reassignment) — moderatsiya orqali qo'lda yoki AI-tavsiya yo'li bilan qayta ko'riladi
- Rasm (AI) moderatsiyasi
- Kategoriya darajasida standart texnik parametr shabloni (filtrlash uchun)
- Dublikat mahsulotlarni moderator tomonidan birlashtirish vositasi
- Ijtimoiy tarmoq orqali kirish (Google/Telegram)
- Moderator uchun majburiy 2FA
- Ko'p-provayderli avtomatik fallback, real-vaqtli kuryer joylashuvi xaritada
- "Foydali edi/emas" ovoz berish (sharh reytingi), sharh fotosuratlarining AI moderatsiyasi
- Xaridor tomonidan nizo suiiste'molini avtomatik aniqlash, moderator qaroriga apellyatsiya
- Email bildirishnoma kanali, granular kanal sozlamasi
- Faset-filtrlash, shaxsiylashtirilgan tavsiyalar, sinonim lug'ati (qidiruv)
- Mehmon savati, "keyinroq uchun saqlash" ro'yxati
- Avtomatik hisobot eksporti, real-vaqtli dashboard, noyob ko'ruvchilar statistikasi

## 21. Ishlab chiqish tartibi/bosqichlar rejasi

Reja ikki mezonga asoslanadi: **bog'liqlik** (qaysi modul qaysi birisiz ishlamaydi) va **xavf** (5-bo'lim printsipiga ko'ra — pul bilan bog'liq qism avval spike/prototip qilinadi). Dizayn — alohida bosqich emas, **backend bilan parallel yuradigan trek**.

### Backend bosqichlari

**0-bosqich — Infratuzilma (1 sprint)**

- Repo, CI/CD, Docker (Postgres, Redis, Meilisearch)
- NestJS skeleti: `common/`, `config/`
- `schema.prisma` bilan birinchi migratsiya

**1-bosqich — Fundament: Auth + minimal Katalog (2 sprint)**

- 11-bo'lim (Auth) — to'liq
- 3-bo'lim (Katalog)ning faqat DB qatlami — moderatsiyasiz CRUD

**2-bosqich — Eng xavfli qism: Orders/Payments/Escrow (3-4 sprint)**

- 8, 10-bo'lim — to'liq: `LedgerEntry`, holat mashinasi, to'lov shlyuzi integratsiyasi, webhook idempotentligi
- 17-bo'lim (Cart) — parallel

**3-bosqich — Sotuvchi va to'liq katalog (3 sprint)**

- 7-bo'lim — ro'yxatdan o'tish + moderatsiya + depozit oqimi
- 9-bo'lim — katalog moderatsiyasi (`ProhibitedKeyword`, xavf-darajali oqim)
- ⚠️ Moderator paneli shu yerda, birga — alohida "Admin panel" bosqichiga qoldirilmaydi

**4-bosqich — Bajarilish va ishonch (3 sprint)**

- 12-bo'lim (Delivery), 14-bo'lim (Disputes), 5-bo'lim (Return), 13-bo'lim (Reviews)

**5-bosqich — O'sish va operatsiyalar (2-3 sprint)**

- 16-bo'lim (Search), 15-bo'lim (Notifications), 4-bo'lim (Promotions)
- 18-bo'limning qolgan qismi: `AdminActionLog`, hisobotlar, counterlar

**6-bosqich — Ishga tushirishdan oldingi tayyorgarlik (2 sprint, parallel boshlanishi mumkin)**

- Fiskal (OFD) integratsiyasi (huquqiy talab, 8-bo'lim)
- Payout provayder integratsiyasi (20-bo'lim)
- Yuk testi (ayniqsa 2-bosqichdagi ledger concurrency)
- Xavfsizlik: Super Admin 2FA, karta ma'lumotlarini maskalash

### Dizayn treki (backend bilan parallel)

- **D1. UX-oqimlar/wireframe** — 0-bosqich bilan bir vaqtda, 2-bo'limdagi user journey asosida; eng murakkab oqim — ko'p-sotuvchili savat/checkout va chegirma preview
- **D2. Dizayn tizimi** — 1-bosqich bilan parallel; Flutter va Next.js uchun bitta umumiy tizim; ikki tillilik (uz/ru) matn uzunligi farqini hisobga oladi
- **D3. Yuqori aniqlikdagi maketlar** — 2-bosqich bilan parallel (eng muhim: checkout/to'lov backend bilan bir vaqtda loyihalanishi shart, aks holda API kontrakti keyin o'zgaradi); sotuvchi kabineti (tasdiqlash hisoblagichi, moliya)
- **D4. Qolgan ekranlar** — 3-4-bosqich bilan parallel: Moderator/Super Admin panel, kuryerlik/nizo/qaytarish oqimlari

### Parallel ishlash imkoniyati

Mobil/frontend jamoa **3-bosqich oxiridan** boshlashi mumkin (Auth+Katalog+Cart+Orders API'lari barqarorlashgach) — bu vaqtga qadar **D3 tayyor bo'lishi shart**, aks holda frontend jamoa dizaynni kutib turadi.

### D1 natijasi — ekranlar ro'yxati (wireframe backlog)

**Xaridor ilovasi (mobil — Flutter):** Kirish/Ro'yxatdan o'tish (OTP), Bosh sahifa/Katalog, Qidiruv natijalari+filtr, Mahsulot kartochkasi, Sevimlilar, Savat (ko'p-sotuvchili), Checkout, Buyurtmalar tarixi, Buyurtma tafsiloti (item darajasida), Qabul qilish/Nizo ochish, Qaytarish so'rovi, Sharh yozish, Profil/Manzillar, Bildirishnomalar, Kredit balansi tarixi

**Sotuvchi kabineti (mobil/veb):** Ro'yxatdan o'tish → moderatsiya kutish, Depozit to'lash, Dashboard, Mahsulot qo'shish/tahrirlash, Zaxira boshqaruvi, Kelgan buyurtmalar (tasdiqlash hisoblagichi), Buyurtma tafsiloti+jo'natish, Aksiya/chegirma yaratish, Moliya (balans/payout), Nizo/qaytarish javoblari, Sharhlarga javob, Telegram bot ulash

**Admin panel (Moderator/Super Admin — veb):** Sotuvchi arizalari navbati, Mahsulot moderatsiyasi navbati, Nizolar/Qaytarish navbati, Sharh moderatsiyasi, Sanksiya qo'llash, Payout tasdiqlash, Tranzaksiya/ledger monitoring, Komissiya/soliq/depozit sozlamalari, Kategoriya/MXIK boshqaruvi, Platforma aksiyalari, Hisobotlar, Audit jurnali

## 22. Hal qilinmagan/keyingi muhokama talab qiladigan nuqtalar

- Payout uchun aniq qaysi bank/shlyuz API ishlatiladi — hali tanlanmagan
- Ma'lumotlarni saqlash joyi/usuli bo'yicha huquqiy talablar — yurist bilan tekshirilishi kerak
- Qaysi kuryerlik tarmog'i (BTS/Fargo/Yandex Delivery) MVP uchun asosiy provayder sifatida tanlanadi — hali aniqlanmagan
- `DepositTier` aniq summalari (500,000 / 1,000,000 so'm) — boshlang'ich taxmin, ishga tushirishdan oldin qayta ko'rib chiqilishi mumkin

---

*Bu hujjat loyihaning barcha keyingi TZ muhokamalari davomida yangilanib boriladi.*