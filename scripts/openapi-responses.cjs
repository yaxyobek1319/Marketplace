// Explicit response projections. Model scalar types/enums come from Prisma's generated DMMF.
const { Prisma } = require('@prisma/client');
const schemas = {};
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = (extra = {}) => ({ type: 'string', ...extra });
const num = (extra = {}) => ({ type: 'integer', ...extra });
const bool = { type: 'boolean' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const money = str({
  pattern: '^-?\\d+(\\.\\d{1,2})?$',
  example: '100000.00',
  description: 'UZS, o‘nlik satr. Float sifatida hisoblamang.',
});
const datetime = str({ format: 'date-time', example: '2026-10-23T10:00:00.000Z' });
const uuid = str({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111' });
const json = {
  description: 'JSON qiymati; tuzilma ushbu maydonning biznes mazmuniga bog‘liq.',
  nullable: true,
};
schemas.Localized = obj({
  uz: str({ example: 'Mahsulot nomi' }),
  ru: str({ example: 'Название товара' }),
});
const excluded = new Set([
  'StaffAccount',
  'RefreshToken',
  'OtpCode',
  'AuthAttempt',
  'TelegramLinkToken',
  'OutboxEvent',
]);
for (const m of Prisma.dmmf.datamodel.models) {
  if (excluded.has(m.name)) continue;
  const props = {};
  for (const f of m.fields) {
    if (
      f.kind === 'object' || f.name === 'passwordHash' ||
      (m.name === 'Payout' && ['destinationToken', 'idempotencyKey'].includes(f.name))
    )
      continue;
    let s;
    if (f.kind === 'enum') {
      s = str({
        enum: Prisma.dmmf.datamodel.enums.find((e) => e.name === f.type).values.map((v) => v.name),
      });
    } else
      s =
        f.type === 'Decimal'
          ? { ...money }
          : f.type === 'Int'
            ? num()
            : f.type === 'Float'
              ? { type: 'number' }
              : f.type === 'Boolean'
                ? bool
                : f.type === 'DateTime'
                  ? datetime
                  : f.type === 'Json'
                    ? /I18n$|titleAtPurchase/.test(f.name)
                      ? ref('Localized')
                      : json
                    : f.type === 'BigInt'
                      ? str({ pattern: '^-?\\d+$' })
                      : str();
    if (f.name === 'id' && f.default?.name === 'uuid') s = uuid;
    if (
      f.name === 'amount' ||
      (/Amount$|Balance$|price|AtPurchase$/.test(f.name) && f.type === 'Decimal')
    )
      s = { ...money };
    if (f.type === 'Decimal' && /Rate|rating|points/i.test(f.name))
      s = str({ example: '2.00', description: 'O‘nlik satr.' });
    if (f.isList) s = arr(s);
    if (!f.isRequired) s = s.$ref ? { allOf: [s], nullable: true } : { ...s, nullable: true };
    props[f.name] = s;
  }
  schemas[m.name] = obj(props);
}
const pick = (model, fields) =>
  obj(
    Object.fromEntries(
      fields.split(' ').map((k) => {
        if (!schemas[model]?.properties[k]) throw new Error(`Unknown response field ${model}.${k}`);
        return [k, schemas[model].properties[k]];
      }),
    ),
  );
const entity = (model, extras = {}) =>
  Object.keys(extras).length ? { allOf: [ref(model), obj(extras)] } : ref(model);
const list = (model, extras) => arr(entity(model, extras));
const nullable = (s) => ({ allOf: [s], nullable: true });
schemas.Count = obj({ count: num({ example: 1 }) });
schemas.Accepted = obj({ accepted: { type: 'boolean', enum: [true] } });
schemas.Deleted = obj({ deleted: { type: 'boolean', enum: [true] } });
schemas.Updated = obj({ updated: { type: 'boolean', enum: [true] } });
schemas.Session = obj(
  {
    id: uuid,
    type: str({ enum: ['USER', 'STAFF'] }),
    sellerId: uuid,
    permissions: arr(str({ example: 'seller:own' })),
  },
  ['id', 'type', 'permissions'],
);
schemas.Tokens = obj({
  accessToken: str({
    pattern: '^[A-Za-z0-9_-]{43}$',
    description:
      'Authorize tugmasiga faqat accessToken qiymatini kiriting. Opaque token; JWT emas.',
  }),
  refreshToken: str({
    pattern: '^[A-Za-z0-9_-]{43}$',
    description: 'Bir martalik refresh token. Yangilanganda ikkala tokenni almashtiring.',
  }),
  expiresIn: num({ example: 900 }),
});
schemas.Profile = obj({
  id: uuid,
  phone: str(),
  fullName: str({ nullable: true }),
  locale: str({ enum: ['uz', 'ru'] }),
  marketingEnabled: bool,
  telegramChatId: str({ nullable: true }),
  seller: nullable(pick('Seller', 'id status storeName')),
});
schemas.ProfileUpdate = obj({
  id: uuid,
  fullName: str({ nullable: true }),
  locale: str(),
  marketingEnabled: bool,
});
schemas.StaffPublic = obj({
  id: uuid,
  email: str({ format: 'email' }),
  role: str({ enum: ['MODERATOR', 'SUPER_ADMIN'] }),
  permissions: arr(str()),
  isActive: bool,
  twoFactorEnabled: bool,
  createdAt: datetime,
});
schemas.Balances = obj(
  {
    buyerCredit: money,
    buyerSpendable: money,
    sellerAvailable: money,
    sellerFrozen: money,
    sellerDeposit: money,
    sellerSpendable: money,
  },
  ['buyerCredit', 'buyerSpendable'],
);
schemas.OrderStatus = str({
  enum: [
    'EMPTY',
    'ATTENTION_REQUIRED',
    'CANCELLED',
    'RETURNED',
    'COMPLETED',
    'CLOSED',
    'IN_PROGRESS',
  ],
});
const itemRelations = {
  shipment: nullable(ref('Shipment')),
  dispute: nullable(ref('Dispute')),
  returnRequest: nullable(ref('ReturnRequest')),
};
schemas.OrderDetail = entity('Order', {
  items: list('OrderItem', itemRelations),
  payments: list('Payment'),
  status: ref('OrderStatus'),
});
schemas.Checkout = entity('Order', { items: list('OrderItem'), payments: list('Payment') });
schemas.CartQuote = obj(
  {
    cartId: uuid,
    quoteHash: str({ pattern: '^[a-f0-9]{64}$' }),
    items: arr(
      obj(
        {
          cartItemId: uuid,
          variantId: uuid,
          productId: uuid,
          sellerId: uuid,
          title: ref('Localized'),
          requestedQuantity: num(),
          quantity: num(),
          available: bool,
          price: money,
          gross: money,
          discountAmount: money,
          platformDiscountAmount: money,
          deliveryAmount: money,
          deliveryType: str({ enum: ['FREE', 'STANDARD', 'EXPRESS'] }),
          appliedPromotionId: uuid,
          taxRate: money,
          commissionRate: money,
        },
        [
          'cartItemId',
          'variantId',
          'productId',
          'sellerId',
          'title',
          'requestedQuantity',
          'quantity',
          'available',
          'price',
          'gross',
          'discountAmount',
          'platformDiscountAmount',
          'deliveryAmount',
          'deliveryType',
          'taxRate',
          'commissionRate',
        ],
      ),
    ),
    reminders: arr(obj({ sellerId: uuid, remaining: money })),
    totalAmount: money,
    creditApplied: money,
    payable: money,
  },
  ['quoteHash', 'items', 'reminders', 'totalAmount', 'creditApplied', 'payable'],
);
schemas.SearchHit = obj({
  variantId: uuid,
  productId: uuid,
  sellerId: uuid,
  titleI18n: ref('Localized'),
  categoryId: num(),
  categoryPath: arr(num()),
  price: {
    type: 'number',
    description:
      'Faqat qidiruv indeksida narx number. Checkout uchun savatdagi Decimal satrdan foydalaning.',
  },
  stockQuantity: num(),
  inStock: bool,
  ratingAvg: { type: 'number' },
  sellerRating: { type: 'number' },
  mainImageUrl: str({ format: 'uri', nullable: true }),
  createdAt: { type: 'integer', description: 'Unix vaqt, millisekundlarda.' },
});
schemas.SearchResult = obj({
  hits: arr(ref('SearchHit')),
  query: str(),
  processingTimeMs: num(),
  limit: num(),
  offset: num(),
  estimatedTotalHits: num(),
});
schemas.FinanceReportRow = obj({
  account: schemas.LedgerEntry.properties.account,
  direction: schemas.LedgerEntry.properties.direction,
  _sum: obj({ amount: money }),
  _count: num(),
});
schemas.SellerReportRow = obj({
  account: schemas.LedgerEntry.properties.account,
  direction: schemas.LedgerEntry.properties.direction,
  amount: money,
});
schemas.Error = obj(
  {
    statusCode: num(),
    message: {
      oneOf: [
        str(),
        arr(str()),
        obj({
          formErrors: arr(str()),
          fieldErrors: { type: 'object', additionalProperties: arr(str()) },
        }),
      ],
    },
    error: str(),
  },
  ['statusCode', 'message'],
);
const commonProduct = {
  variants: list('ProductVariant'),
  images: list('ProductImage'),
  attributes: list('ProductAttribute'),
};
const dispute = entity('Dispute', { orderItem: ref('OrderItem') });
const ret = entity('ReturnRequest', { orderItem: ref('OrderItem') });
const payout = ref('Payout');
const reportPayout = arr(
  obj({
    payeeType: schemas.Payout.properties.payeeType,
    status: schemas.Payout.properties.status,
    _sum: obj({ amount: money, bankFeeAmount: money }),
    _count: num(),
  }),
);
const catalogCreate = ref('Product');
const responses = {
  HealthController: {
    live: obj({ status: str({ enum: ['ok'] }), service: str({ enum: ['marketplace-api'] }) }),
    ready: obj({ status: str({ enum: ['ok'] }), service: str({ enum: ['marketplace-api'] }) }),
  },
  AuthController: {
    register: ref('Tokens'),
    passwordLogin: ref('Tokens'),
    session: ref('Session'),
    request: obj({ expiresIn: num({ example: 180 }), retryAfter: num({ example: 60 }) }),
    verify: ref('Tokens'),
    login: ref('Tokens'),
    refresh: ref('Tokens'),
    logout: ref('Count'),
  },
  ProfileController: {
    get: nullable(ref('Profile')),
    update: ref('ProfileUpdate'),
    addresses: list('Address'),
    add: ref('Address'),
    edit: ref('Address'),
    remove: ref('Address'),
    favorites: list('Favorite', { product: entity('Product', { images: list('ProductImage') }) }),
    favorite: ref('Favorite'),
    unfavorite: ref('Count'),
  },
  CatalogController: {
    categories: list('Category'),
    product: entity('Product', {
      ...commonProduct,
      variants: list('ProductVariant', { images: list('ProductImage') }),
      seller: pick('Seller', 'id storeName rating'),
    }),
    view: ref('Accepted'),
    mine: list('Product', commonProduct),
    create: catalogCreate,
    edit: ref('Product'),
    submit: ref('Product'),
    moderate: ref('Product'),
    stock: ref('ProductVariant'),
    variant: ref('ProductVariant'),
    addVariant: ref('ProductVariant'),
    images: ref('Updated'),
    attributes: ref('Updated'),
    createCategory: ref('Category'),
    updateCategory: ref('Category'),
  },
  MediaController: {
    upload: obj({ url: str({ format: 'uri' }) }),
    image: str({ format: 'binary' }),
  },
  CartController: {
    get: ref('CartQuote'),
    set: ref('CartItem'),
    remove: ref('Count'),
    delivery: ref('Count'),
  },
  OrdersController: {
    checkout: ref('Checkout'),
    list: list('Order', {
      items: list('OrderItem', { shipment: nullable(ref('Shipment')) }),
      status: ref('OrderStatus'),
    }),
    seller: list('OrderItem', itemRelations),
    detail: ref('OrderDetail'),
    confirm: ref('OrderItem'),
    complete: ref('OrderItem'),
  },
  PaymentsController: {
    providersList: arr(str({ example: 'PAYME' })),
    deposits: arr(pick('Payment', 'id amount provider status checkoutUrl createdAt')),
    deposit: ref('Payment'),
    webhook: ref('Accepted'),
  },
  FinanceController: {
    mine: ref('Balances'),
    history: list('LedgerEntry'),
    list: arr(
      pick('Payout', 'id amount status destinationMasked requestedAt processedAt failureReason'),
    ),
    request: payout,
    decision: payout,
  },
  PromotionsController: {
    mine: list('Promotion'),
    seller: ref('Promotion'),
    platform: ref('Promotion'),
    sellerEdit: ref('Promotion'),
    platformEdit: ref('Promotion'),
  },
  AdminController: {
    sellers: list('Seller'),
    products: list('Product', {
      scans: list('ProductScan'),
      images: list('ProductImage'),
      variants: list('ProductVariant'),
    }),
    disputes: arr(dispute),
    returns: arr(ret),
    payouts: arr(
      pick(
        'Payout',
        'id payeeType payeeId amount status destinationMasked requestedAt provider providerRef',
      ),
    ),
    logs: list('AdminActionLog'),
    ledger: list('LedgerEntry'),
    tiers: list('DepositTier'),
    tier: ref('DepositTier'),
    keywords: list('ProhibitedKeyword'),
    keyword: ref('ProhibitedKeyword'),
    templates: list('NotificationTemplate'),
    template: ref('NotificationTemplate'),
    staff: obj({ id: uuid, isActive: bool }),
    report: arr(ref('FinanceReportRow')),
    tax: arr(obj({ sellerId: uuid, taxAmount: money })),
    popular: arr(
      obj({
        id: uuid,
        titleI18n: ref('Localized'),
        viewCount: num(),
        variants: arr(obj({ salesCount: num() })),
      }),
    ),
    csv: str(),
  },
  DeliveryController: {
    failures: list('Shipment'),
    retry: ref('Shipment'),
    ready: ref('Shipment'),
    webhook: ref('Accepted'),
  },
  NotificationsController: {
    list: list('Notification'),
    token: ref('PushToken'),
    remove: ref('Count'),
    link: obj({
      url: str({ format: 'uri', example: 'https://t.me/YourBot?start=ONE_TIME_TOKEN' }),
      expiresIn: num({ example: 600 }),
    }),
    unlink: obj({ id: uuid }),
    bind: ref('Accepted'),
  },
  ReportsController: {
    report: ref('ContentReport'),
    list: list('ContentReport', {
      target: {
        oneOf: [entity('Product', { images: list('ProductImage') }), ref('Review')],
        nullable: true,
      },
    }),
    resolve: ref('ContentReport'),
    keyword: ref('ProhibitedKeyword'),
    remove: ref('Deleted'),
    payouts: reportPayout,
    sellers: arr(
      obj({ id: uuid, storeName: str(), rating: str(), ratingEvents: num(), disputes: num() }),
    ),
    sellerReport: arr(ref('SellerReportRow')),
    csv: str(),
  },
  SearchController: { search: ref('SearchResult') },
  WorkspaceController: {
    overview: obj({
      products: arr(obj({ status: schemas.Product.properties.status, _count: num() })),
      orders: arr(obj({ status: schemas.OrderItem.properties.status, _count: num() })),
      seller: nullable(
        pick('Seller', 'storeName status rating commissionRate taxRate rejectionReason'),
      ),
    }),
    disputes: arr(dispute),
    returns: arr(ret),
    reviews: list('Review', { product: pick('Product', 'titleI18n') }),
    sellers: list('Seller'),
    promotions: list('Promotion'),
    contentSellers: arr(pick('Seller', 'id storeName status rating createdAt')),
    allReviews: list('Review', { product: pick('Product', 'titleI18n') }),
    categories: list('Category'),
    staff: arr(ref('StaffPublic')),
  },
  SellersController: {
    apply: ref('Seller'),
    mine: nullable(ref('Seller')),
    public: pick('Seller', 'id storeName rating createdAt'),
    review: ref('Seller'),
    rates: ref('Seller'),
    content: ref('SellerSanction'),
    finance: ref('SellerSanction'),
  },
  TrustController: {
    dispute: ref('Dispute'),
    response: ref('Dispute'),
    resolve: ref('Dispute'),
    requestReturn: ref('ReturnRequest'),
    returnResponse: ref('ReturnRequest'),
    decision: ref('ReturnRequest'),
    received: ref('ReturnRequest'),
    refund: ref('ReturnRequest'),
    reviews: arr(pick('Review', 'id rating comment photos sellerReply createdAt')),
    review: ref('Review'),
    edit: ref('Review'),
    remove: ref('Deleted'),
    hide: ref('Deleted'),
    reply: ref('Review'),
  },
};
module.exports = { schemas, responses, obj, str, num, arr, ref, money, uuid, datetime };
