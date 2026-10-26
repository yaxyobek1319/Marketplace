// Extract the real Zod request validators without starting Nest or connecting to a database.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { schemas, responses, ref } = require('./openapi-responses.cjs');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'apps/api/src');
const paths = {};
const tags = new Set();
const ids = new Set();
const exampleId = '11111111-1111-4111-8111-111111111111';
const examples = {
  Auth_register: { phone: '+998901234567', password: 'YOUR_PASSWORD' },
  Auth_passwordLogin: { phone: '+998901234567', password: 'YOUR_PASSWORD' },
  Auth_request: { phone: '+998901234567', purpose: 'LOGIN' },
  Auth_verify: { phone: '+998901234567', purpose: 'LOGIN', code: '123456' },
  Auth_login: { email: 'admin@example.com', password: 'YOUR_PASSWORD', code: '123456' },
  Auth_refresh: { refreshToken: 'A'.repeat(43) },
  Profile_update: { fullName: 'Ali Valiyev', locale: 'uz', marketingEnabled: false },
  Profile_add: {
    label: 'Uy',
    address: 'Toshkent, namuna manzil 1',
    recipientPhone: '+998901234567',
    region: 'Toshkent',
    latitude: 41.3111,
    longitude: 69.2797,
  },
  Cart_set: { quantity: 1, deliveryType: 'STANDARD' },
  Cart_delivery: { deliveryType: 'STANDARD' },
  Orders_checkout: {
    addressId: exampleId,
    idempotencyKey: exampleId,
    provider: 'CONFIGURED_PROVIDER',
    expectedTotal: '100000.00',
    quoteHash: 'a'.repeat(64),
  },
  Orders_confirm: { accept: true },
  Catalog_edit: { titleI18n: { uz: 'Mahsulot', ru: 'Товар' }, description: 'Mahsulot tavsifi' },
  Catalog_stock: { changeAmount: 10, reason: 'Omborga yangi tovar keldi' },
  Catalog_variant: { price: '100000.00', isActive: true },
  Catalog_moderate: { status: 'ACTIVE', reason: 'Tekshirildi' },
  Finance_request: {
    payeeType: 'SELLER',
    amount: '100000.00',
    provider: 'CONFIGURED_PROVIDER',
    destinationToken: 'PROVIDER_TOKEN_EXAMPLE',
    destinationMasked: '****1234',
    idempotencyKey: exampleId,
  },
  Finance_decision: { approve: true, reason: 'Tekshirildi' },
  Reports_report: {
    targetType: 'PRODUCT',
    targetId: exampleId,
    reason: 'Mahsulot tavsifi noto‘g‘ri',
  },
  Payments_deposit: { amount: '100000.00', provider: 'CONFIGURED_PROVIDER' },
};
const summaries = {
  Auth: {
    session: 'Joriy sessiya va ruxsatlar',
    request: 'Telefon raqamga OTP so‘rash',
    verify: 'OTP tasdiqlash va token olish',
    login: 'Staff akkaunti bilan kirish',
    refresh: 'Tokenlarni yangilash',
    logout: 'Barcha sessiyalardan chiqish',
  },
  Catalog: {
    categories: 'Ommaviy kategoriyalar',
    product: 'Mahsulot tafsilotlari',
    view: 'Mahsulot ko‘rilishini hisoblash',
    mine: 'Sotuvchining mahsulotlari',
    create: 'Mahsulot va variantlarini yaratish',
    edit: 'Mahsulotni tahrirlash',
    submit: 'Moderatsiyaga yuborish',
    moderate: 'Moderatsiya qarori',
    stock: 'Ombor qoldig‘ini o‘zgartirish',
    variant: 'Variant narxi yoki faolligini tahrirlash',
    addVariant: 'Yangi variant qo‘shish',
    images: 'Mahsulot rasmlarini almashtirish',
    attributes: 'Mahsulot xususiyatlarini almashtirish',
    createCategory: 'Kategoriya yaratish',
    updateCategory: 'Kategoriyani yangilash',
  },
  Orders: {
    checkout: 'Savatdan buyurtma yaratish',
    list: 'Xaridor buyurtmalari',
    seller: 'Sotuvchining to‘langan buyurtma qismlari',
    detail: 'Buyurtma tafsilotlari',
    confirm: 'Buyurtma qismini qabul qilish yoki rad etish',
    complete: 'Xaridor tomonidan yakunlash',
  },
  Cart: {
    get: 'Savat, yakuniy narx va quoteHash',
    set: 'Variantni savatga qo‘shish yoki sonini almashtirish',
    remove: 'Variantni savatdan o‘chirish',
    delivery: 'Do‘kon uchun yetkazish turini almashtirish',
  },
  Finance: {
    mine: 'Joriy balanslar',
    history: 'Ledger tranzaksiyalari',
    list: 'Pul yechish so‘rovlari',
    request: 'Pul yechishni so‘rash',
    decision: 'Pul yechish bo‘yicha qaror',
  },
  Media: { upload: 'Mahsulot rasmini yuklash (10 MiB)', image: 'Yuklangan rasmni olish' },
  Health: { live: 'API ishlash holati', ready: 'DB ulanish holati' },
};
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
function decorators(node) {
  return ts.getDecorators(node) || [];
}
function decorator(node, name) {
  return decorators(node)
    .map((d) => d.expression)
    .find((e) => ts.isCallExpression(e) && e.expression.getText() === name);
}
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (n) => walk(n, visit));
}
function convert(schema) {
  const result = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
  delete result.$schema;
  return result;
}
const verbs = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const labels = {
  Get: 'Olish',
  Post: 'Yaratish / bajarish',
  Put: 'Yangilash',
  Patch: 'Tahrirlash',
  Delete: 'O‘chirish',
};
for (const filename of files(src).filter(
  (f) => f.endsWith('.controller.ts') || f.endsWith('/app.module.ts'),
)) {
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const routes = [];
  for (const cls of ast.statements.filter(ts.isClassDeclaration)) {
    const cd = decorator(cls, 'Controller');
    if (!cd) continue;
    const cn = cls.name.text;
    const prefix = cd.arguments[0]?.text || '';
    for (const method of cls.members.filter(ts.isMethodDeclaration)) {
      const verb = verbs.find((v) => decorator(method, v));
      if (!verb) continue;
      const name = method.name.getText(ast);
      const route = decorator(method, verb).arguments[0]?.text || '';
      const params = [];
      for (const p of method.parameters) {
        const kind = ['Body', 'Query', 'Param', 'Headers', 'UploadedFile'].find((v) =>
          decorator(p, v),
        );
        if (!kind) continue;
        const dec = decorator(p, kind);
        let expr;
        walk(method, (n) => {
          if (
            ts.isCallExpression(n) &&
            n.expression.getText(ast) === 'parse' &&
            n.arguments[1]?.getText(ast) === p.name.getText(ast)
          )
            expr = n.arguments[0].getText(ast);
        });
        // CSV exports reuse the JSON report validator.
        if (!expr && kind === 'Query' && name === 'csv') {
          const sibling = cls.members.find(
            (m) =>
              m.name?.getText(ast) === (cn === 'ReportsController' ? 'sellerReport' : 'report'),
          );
          walk(sibling, (n) => {
            if (
              ts.isCallExpression(n) &&
              n.expression.getText(ast) === 'parse' &&
              n.arguments[1]?.getText(ast) === 'query'
            )
              expr = n.arguments[0].getText(ast);
          });
        }
        if (!expr && ['Body', 'Query'].includes(kind))
          throw new Error(`Missing validator: ${cn}.${name} ${kind}`);
        params.push({ kind, name: dec.arguments[0]?.text, expr });
      }
      routes.push({ cn, name, verb, prefix, route, params });
    }
  }
  if (!routes.length) continue;
  const expressions = routes.map(
    (r) =>
      `{cls:${r.cn},fn:${r.cn}.prototype.${r.name},validators:[${r.params.map((p) => p.expr || 'undefined').join(',')}]}`,
  );
  const output = ts.transpileModule(
    source + `\nexport const __contracts=[${expressions.join(',')}];`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const compiled = filename.replace('/src/', '/dist/').replace(/\.ts$/, '.js');
  const mod = new Module(compiled, module);
  mod.filename = compiled;
  mod.paths = Module._nodeModulePaths(path.dirname(compiled));
  mod._compile(output, compiled);
  routes.forEach((r, i) => {
    const { cls, fn, validators } = mod.exports.__contracts[i];
    const url = ('/api/v1/' + r.prefix + '/' + r.route)
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .replace(/:([\w]+)/g, '{$1}');
    const operationId = r.cn.replace('Controller', '') + '_' + r.name;
    if (ids.has(operationId)) throw new Error('Duplicate ' + operationId);
    ids.add(operationId);
    const tag = r.cn.replace('Controller', '');
    tags.add(tag);
    const permissions =
      Reflect.getMetadata('permissions', fn) || Reflect.getMetadata('permissions', cls) || [];
    const isPublic = Reflect.getMetadata('public', fn) || Reflect.getMetadata('public', cls);
    const response = responses[r.cn]?.[r.name];
    if (!response) throw new Error('Missing response: ' + operationId);
    const status = Reflect.getMetadata('__httpCode__', fn) || (r.verb === 'Post' ? 201 : 200);
    const op = {
      operationId,
      tags: [tag],
      summary: summaries[tag]?.[r.name] || `${labels[r.verb]}: ${r.route || r.prefix || r.name}`,
      description: `${isPublic ? 'Ochiq endpoint.' : 'Bearer access token talab qilinadi.'}${permissions.length ? ' Zarur huquqlar: ' + permissions.map((p) => '`' + p + '`').join(', ') + '.' : ''}`,
      security: isPublic ? [] : [{ BearerAuth: [] }],
      parameters: [],
      responses: {},
    };
    if (permissions.length) op['x-permissions'] = permissions;
    r.params.forEach((p, j) => {
      const s = validators[j] ? convert(validators[j]) : { type: 'string' };
      if (p.kind === 'Body') {
        const key = operationId + 'Request';
        schemas[key] = s;
        op.requestBody = { required: true, content: { 'application/json': { schema: ref(key) } } };
        if (examples[operationId]) {
          validators[j].parse(examples[operationId]);
          op.requestBody.content['application/json'].example = examples[operationId];
        }
      } else if (p.kind === 'Query') {
        for (const [name, schema] of Object.entries(s.properties || {}))
          op.parameters.push({
            in: 'query',
            name,
            required: (s.required || []).includes(name),
            schema,
          });
      } else if (p.kind === 'Param') {
        if (p.name === 'filename')
          Object.assign(s, { pattern: '^[a-f0-9-]{36}\\.(png|jpg|webp)$' });
        op.parameters.push({ in: 'path', name: p.name, required: true, schema: s });
      } else if (p.kind === 'Headers') {
        if (p.name === 'x-telegram-bot-api-secret-token') {
          op.security = [{ TelegramWebhookSecret: [] }];
          op.description += ' Telegram webhook secret bilan tekshiriladi.';
        } else op.parameters.push({ in: 'header', name: p.name, required: true, schema: s });
      } else if (p.kind === 'UploadedFile') {
        op.requestBody = {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PNG, JPEG yoki WebP. Ko‘pi bilan 10 MiB.',
                  },
                },
              },
            },
          },
        };
      }
    });
    if (r.name === 'webhook') {
      op.description +=
        ' Provider adapteri imzoni raw body va headerlar orqali tekshiradi. Payload va imzo headerlari tanlangan providerga bog‘liq. Hozir real provider adapterlari ulanmagan (503); bu endpoint frontend tomonidan chaqirilmaydi.';
      op.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: true,
              description: 'Providerga xos payload. Universal webhook DTO mavjud emas.',
            },
          },
        },
      };
    }
    let content = { 'application/json': { schema: response } };
    if (r.name === 'csv')
      content = {
        'text/csv': {
          schema: { type: 'string' },
          example:
            r.cn === 'AdminController'
              ? 'account,direction,amount,count\r\nBUYER_CREDIT,CREDIT,100000.00,1\r\n'
              : 'account,direction,amount\r\nBUYER_CREDIT,CREDIT,100000.00\r\n',
        },
      };
    if (r.cn === 'MediaController' && r.name === 'image')
      content = Object.fromEntries(
        ['image/png', 'image/jpeg', 'image/webp'].map((t) => [
          t,
          { schema: { type: 'string', format: 'binary' } },
        ]),
      );
    op.responses[status] = { description: 'Muvaffaqiyatli javob', content };
    for (const [code, description] of Object.entries({
      400: 'Noto‘g‘ri kirish ma’lumotlari',
      401: 'Token yoki autentifikatsiya yaroqsiz',
      403: 'Huquq yetarli emas',
      404: 'Resurs topilmadi',
      409: 'Biznes sharti yoki holat mos kelmadi',
      429: 'So‘rovlar limiti oshdi',
      500: 'Ichki server xatosi',
      503: 'DB yoki tashqi xizmat mavjud emas / sozlanmagan',
    })) {
      if (
        isPublic &&
        ['401', '403'].includes(code) &&
        !url.includes('auth') &&
        !url.includes('webhook')
      )
        continue;
      op.responses[code] = {
        description,
        content: { 'application/json': { schema: ref('Error') } },
      };
    }
    if (r.cn === 'MediaController' && r.name === 'upload')
      op.responses[413] = { description: 'Fayl 10 MiB limitdan katta' };
    if (url.includes('checkout'))
      op.description +=
        ' Avval GET /cart orqali quoteHash va payable oling. expectedTotal = payable. IdempotencyKey bir xil urinish uchun o‘zgarmasin. Narx yoki savat o‘zgarsa yangi quote oling.';
    if (url.includes('auth/refresh'))
      op.description +=
        ' Refresh muvaffaqiyatli bo‘lsa eski refresh token bekor bo‘ladi. Yangi accessToken va refreshTokenni birga saqlang.';
    if (op.parameters.length === 0) delete op.parameters;
    paths[url] ??= {};
    if (paths[url][r.verb.toLowerCase()]) throw new Error('Duplicate path ' + url);
    paths[url][r.verb.toLowerCase()] = op;
  });
}
const document = {
  openapi: '3.0.3',
  info: {
    title: 'Marketplace Backend API',
    version: '0.1.0',
    description:
      'Frontend integratsiyasi uchun API shartnomasi.\n\n## Kirish\n1. OTP so‘rang va tasdiqlang yoki staff login qiling.\n2. Authorize tugmasiga accessToken qiymatini kiriting (Bearer prefiksisiz).\n3. Token tugaganda refresh orqali ikkala tokenni almashtiring. Token JWT emas.\n\n## Formatlar\nPul UZS va Decimal satr ko‘rinishida; sana ISO 8601 UTC. Pagination: skip=0, take=30 (maksimum 100); list endpointlar odatda massiv qaytaradi. UUID identifikatorlar va kategoriya integer ID ishlatiladi. uz/ru maydonlari Localized sxemasida. Zod strict obyektlar ortiqcha maydonlarni rad etadi. Biznes shartlari (musbat summa, foiz 0–100, vaqtlar tartibi, holatlar va egalik) serverda qo‘shimcha tekshiriladi; OpenAPI barcha refine tekshiruvlarini ifodalay olmaydi.\n\n## Integratsiyalar\nDB foydalanuvchi tomonidan ulanadi. SMS, payment, delivery, payout va FCM real adapterlari hali ulanmagan; ularga bog‘liq operatsiyalar 503 qaytarishi mumkin. Swagger hujjati bu xizmatlarning tayyorligini anglatmaydi. Webhook payloadlari providerga bog‘liq. Try it out haqiqiy APIga so‘rov yuboradi va ma’lumotlarni o‘zgartirishi mumkin.',
  },
  servers: [{ url: '/', description: 'Swagger ochilgan API serveri' }],
  tags: [...tags].sort().map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Opaque access token' },
      TelegramWebhookSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'x-telegram-bot-api-secret-token',
      },
    },
    schemas,
  },
};
function validate(node) {
  if (!node || typeof node !== 'object') return;
  if (node.$ref) {
    const key = node.$ref.replace('#/components/schemas/', '');
    if (!schemas[key]) throw new Error('Unresolved reference ' + node.$ref);
  }
  Object.values(node).forEach(validate);
}
validate(document);
const json = JSON.stringify(document, null, 2) + '\n';
fs.writeFileSync(path.join(root, 'docs/openapi.json'), json);
fs.writeFileSync(
  path.join(src, 'openapi/document.ts'),
  '// Generated by scripts/generate-openapi.cjs. Do not edit manually.\nimport type { OpenAPIObject } from "@nestjs/swagger";\nexport const apiDocument = ' +
    json.trim() +
    ' as unknown as OpenAPIObject;\n',
);
console.log(
  `OpenAPI: ${ids.size} operations, ${Object.keys(schemas).length} schemas. No database connection used.`,
);
