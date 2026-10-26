import { Action, Field } from '@/components/ui';
import { Row } from './client';
const reason: Field = { key: 'reason', label: ['Sabab', 'Причина'], type: 'textarea' };
const evidence: Field = {
  key: 'description',
  label: ['Javob va dalillar tavsifi', 'Ответ и описание доказательств'],
  type: 'textarea',
};
const titleFields: Field[] = [
  { key: 'uz', label: ['Nomi · O‘zbekcha', 'Название · Узбекский'] },
  { key: 'ru', label: ['Nomi · Ruscha', 'Название · Русский'] },
];
const promotionFields: Field[] = [
  {
    key: 'discountType',
    label: ['Chegirma turi', 'Тип скидки'],
    type: 'select',
    options: [
      ['percent', ['Foiz', 'Процент']],
      ['fixed', ['Belgilangan summa', 'Фиксированная сумма']],
    ],
  },
  {
    key: 'value',
    label: ['Chegirma miqdori', 'Размер скидки'],
    type: 'number',
    min: 0.01,
    step: '0.01',
  },
  {
    key: 'minAmount',
    label: ['Eng kam xarid summasi', 'Минимальная сумма'],
    optional: true,
    pattern: '[0-9]+(\\.[0-9]{1,2})?',
  },
  { key: 'couponCode', label: ['Kupon kodi', 'Код купона'], optional: true },
  {
    key: 'firstPurchaseOnly',
    label: ['Faqat birinchi xaridga', 'Только первая покупка'],
    type: 'checkbox',
  },
  { key: 'isActive', label: ['Faol', 'Активна'], type: 'checkbox' },
  { key: 'startAt', label: ['Boshlanishi', 'Начало'], type: 'datetime-local', optional: true },
  { key: 'endAt', label: ['Tugashi', 'Окончание'], type: 'datetime-local', optional: true },
];
const promoBody = (v: Row) => ({
  ...(v.discountType === 'percent'
    ? { discountPercent: String(v.value) }
    : { fixedAmount: String(v.value) }),
  ...(v.minAmount ? { minAmount: v.minAmount } : {}),
  ...(v.couponCode ? { couponCode: v.couponCode } : {}),
  firstPurchaseOnly: v.firstPurchaseOnly,
  isActive: v.isActive,
  ...(v.startAt ? { startAt: new Date(v.startAt).toISOString() } : {}),
  ...(v.endAt ? { endAt: new Date(v.endAt).toISOString() } : {}),
});
export function promotion(section: string, row?: Row): Action {
  const scope = section === 'promotions' ? 'seller' : 'platform';
  return {
    title: row ? ['Aksiyani tahrirlash', 'Изменить акцию'] : ['Yangi aksiya', 'Новая акция'],
    path: `promotions/${scope}${row ? '/' + row.id : ''}`,
    method: row ? 'PATCH' : 'POST',
    fields: promotionFields,
    initial: row
      ? {
          ...row,
          discountType: row.discountPercent ? 'percent' : 'fixed',
          value: row.discountPercent ?? row.fixedAmount,
          startAt: row.startAt ? row.startAt.slice(0, 16) : '',
          endAt: row.endAt ? row.endAt.slice(0, 16) : '',
        }
      : { isActive: true },
    body: promoBody,
  };
}
export function category(row?: Row): Action {
  return {
    title: row
      ? ['Kategoriyani tahrirlash', 'Изменить категорию']
      : ['Yangi kategoriya', 'Новая категория'],
    path: `catalog/categories${row ? '/' + row.id : ''}`,
    method: row ? 'PUT' : 'POST',
    fields: [
      ...titleFields,
      {
        key: 'parentId',
        label: ['Yuqori kategoriya raqami', 'Номер родительской категории'],
        type: 'number',
        min: 1,
        optional: true,
      },
      {
        key: 'riskLevel',
        label: ['Xavf darajasi', 'Уровень риска'],
        type: 'select',
        options: [
          ['LOW', ['Past', 'Низкий']],
          ['HIGH', ['Yuqori', 'Высокий']],
        ],
      },
      {
        key: 'mxikCode',
        label: ['MXIK (17 raqam)', 'ИКПУ (17 цифр)'],
        pattern: '[0-9]{17}',
        optional: true,
      },
      { key: 'hidden', label: ['Yashirish', 'Скрыть'], type: 'checkbox' },
    ],
    initial: row ? { ...row, ...row.nameI18n, hidden: Boolean(row.deletedAt) } : undefined,
    body: (v) => ({
      nameI18n: { uz: v.uz, ru: v.ru },
      parentId: v.parentId ?? null,
      riskLevel: v.riskLevel,
      ...(v.mxikCode ? { mxikCode: v.mxikCode } : {}),
      hidden: v.hidden,
    }),
  };
}
export function keyword(row?: Row): Action {
  return {
    title: row ? ['So‘zni tahrirlash', 'Изменить слово'] : ['So‘z qo‘shish', 'Добавить слово'],
    path: `admin/keywords${row ? '/' + row.id : ''}`,
    method: row ? 'PATCH' : 'POST',
    fields: [
      { key: 'term', label: ['So‘z yoki ibora', 'Слово или фраза'] },
      {
        key: 'severity',
        label: ['Daraja', 'Уровень'],
        type: 'select',
        options: [
          ['MEDIUM', ['O‘rta', 'Средний']],
          ['CRITICAL', ['Jiddiy', 'Критический']],
        ],
      },
    ],
    initial: row ? { term: row.term, severity: row.severity } : undefined,
  };
}
export function createAction(section: string): Action | undefined {
  if (['promotions', 'platform-promotions'].includes(section)) return promotion(section);
  if (section === 'categories') return category();
  if (section === 'keywords') return keyword();
  if (section === 'tiers')
    return { title: ['Depozit pog‘onasi', 'Уровень депозита'], path: '', fields: [] };
}
export function rowActions(section: string, r: Row): Action[] {
  const id = r.id;
  switch (section) {
    case 'seller-queue':
      return [true, false].map((approve) => ({
        title: approve
          ? ['Arizani tasdiqlash', 'Одобрить заявку']
          : ['Arizani rad etish', 'Отклонить заявку'],
        path: `sellers/${id}/review`,
        fields: [reason],
        body: (v) => ({ approve, reason: v.reason }),
        danger: !approve,
      }));
    case 'product-queue':
      return ['ACTIVE', 'REJECTED', 'SUSPENDED'].map((status) => ({
        title:
          status === 'ACTIVE'
            ? ['Nashrga ruxsat', 'Разрешить публикацию']
            : status === 'REJECTED'
              ? ['Rad etish', 'Отклонить']
              : ['To‘xtatish', 'Приостановить'],
        path: `catalog/products/${id}/moderate`,
        fields: [reason],
        body: (v) => ({ status, reason: v.reason }),
        danger: status !== 'ACTIVE',
      }));
    case 'products':
      return [
        {
          title: ['Kartochkani tahrirlash', 'Изменить карточку'],
          path: `catalog/products/${id}`,
          method: 'PATCH',
          fields: [
            ...titleFields,
            { key: 'description', label: ['Tavsif', 'Описание'], type: 'textarea', optional: true },
            {
              key: 'mxikCodeOverride',
              label: ['MXIK', 'ИКПУ'],
              optional: true,
              pattern: '[0-9]{17}',
            },
          ],
          initial: {
            ...r.titleI18n,
            description: r.description,
            mxikCodeOverride: r.mxikCodeOverride,
          },
          body: (v) => ({
            titleI18n: { uz: v.uz, ru: v.ru },
            description: v.description ?? '',
            ...(v.mxikCodeOverride ? { mxikCodeOverride: v.mxikCodeOverride } : {}),
          }),
        },
        ...(['DRAFT', 'REJECTED'].includes(r.status)
          ? [
              {
                title: ['Tekshiruvga yuborish', 'Отправить на проверку'] as [string, string],
                path: `catalog/products/${id}/submit`,
                body: () => undefined,
              },
            ]
          : []),
      ];
    case 'delivery-failed':
      return !r.providerRef
        ? [
            {
              title: ['Qayta jo‘natish', 'Повторить отправку'],
              path: `delivery/shipments/${id}/retry`,
              body: () => undefined,
              note: [
                'Oldingi jo‘natma raqami qayta ishlatiladi.',
                'Будет использован прежний идентификатор отправления.',
              ],
            },
          ]
        : [];
    case 'orders':
      return r.status === 'PENDING_SELLER_CONFIRMATION'
        ? [true, false].map((accept) => ({
            title: accept ? ['Qabul qilish', 'Принять'] : ['Bekor qilish', 'Отменить'],
            path: `orders/items/${id}/confirm`,
            body: () => ({ accept }),
            danger: !accept,
            note: !accept
              ? [
                  'Bekor qilish reytingga ta’sir qilishi mumkin.',
                  'Отмена может повлиять на рейтинг.',
                ]
              : undefined,
          }))
        : r.status === 'CONFIRMED' && !r.shipment
          ? [
              {
                title: ['Jo‘natishga tayyor', 'Готов к отправке'],
                path: `delivery/items/${id}/ready`,
                body: () => undefined,
              },
            ]
          : [];
    case 'disputes':
      return r.status !== 'RESOLVED'
        ? [
            {
              title: ['Javob berish', 'Ответить'],
              path: `trust/disputes/${id}/response`,
              fields: [evidence],
              body: (v) => ({ description: v.description, photos: [] }),
            },
          ]
        : [];
    case 'returns':
      return [
        ...(r.status === 'REQUESTED'
          ? [
              {
                title: ['Javob berish', 'Ответить'] as [string, string],
                path: `trust/returns/${id}/response`,
                fields: [evidence],
                body: (v: Row) => ({ description: v.description, photos: [] }),
              },
            ]
          : []),
        ...(r.status === 'APPROVED'
          ? [
              {
                title: ['Tovar qabul qilindi', 'Товар получен'] as [string, string],
                path: `trust/returns/${id}/received`,
                body: () => undefined,
              },
            ]
          : []),
      ];
    case 'reviews':
      return [
        {
          title: ['Sharhga javob', 'Ответить на отзыв'],
          path: `trust/reviews/${id}/reply`,
          fields: [{ key: 'reply', label: ['Javob', 'Ответ'], type: 'textarea' }],
          initial: { reply: r.sellerReply ?? '' },
        },
      ];
    case 'dispute-queue':
      return [
        {
          title: ['Qaror chiqarish', 'Принять решение'],
          path: `trust/disputes/${id}/resolve`,
          fields: [
            {
              key: 'resolution',
              label: ['Qaror', 'Решение'],
              type: 'select',
              options: [
                ['BUYER_FAVOR', ['Xaridor foydasiga', 'В пользу покупателя']],
                ['SELLER_FAVOR', ['Sotuvchi foydasiga', 'В пользу продавца']],
                ['PARTIAL', ['Qisman qaytarish', 'Частичное возмещение']],
              ],
            },
            {
              key: 'amount',
              label: ['Qisman qaytarish summasi', 'Сумма частичного возмещения'],
              optional: true,
              pattern: '[0-9]+(\\.[0-9]{1,2})?',
            },
          ],
          body: (v) => ({
            resolution: v.resolution,
            ...(v.resolution === 'PARTIAL' ? { amount: v.amount } : {}),
          }),
        },
      ];
    case 'return-queue':
      return r.status === 'REQUESTED'
        ? [true, false].map((approve) => ({
            title: approve
              ? ['Qaytarishni tasdiqlash', 'Одобрить возврат']
              : ['Rad etish', 'Отклонить'],
            path: `trust/returns/${id}/decision`,
            body: () => ({ approve }),
            danger: !approve,
          }))
        : r.status === 'ITEM_RECEIVED'
          ? [
              {
                title: ['Pulni qaytarish', 'Вернуть средства'],
                path: `trust/returns/${id}/refund`,
                fields: [
                  {
                    key: 'restock',
                    label: ['Tovarni qayta omborga kirim qilish', 'Вернуть товар в остатки'],
                    type: 'checkbox',
                  },
                ],
              },
            ]
          : [];
    case 'reports-queue':
      return [
        {
          title: ['Shikoyatni yopish', 'Закрыть жалобу'],
          path: `admin/reports/${id}/resolve`,
          fields: [
            {
              key: 'resolution',
              label: ['Ko‘rib chiqish natijasi', 'Результат рассмотрения'],
              type: 'textarea',
            },
          ],
        },
        ...(r.targetType === 'REVIEW'
          ? [
              {
                title: ['Sharhni yashirish', 'Скрыть отзыв'] as [string, string],
                path: `trust/reviews/${r.targetId}/hide`,
                fields: [reason],
                danger: true,
              },
            ]
          : []),
      ];
    case 'payout-queue':
      return r.status === 'PENDING'
        ? [true, false].map((approve) => ({
            title: approve
              ? ['To‘lovni tasdiqlash', 'Одобрить выплату']
              : ['Rad etish', 'Отклонить'],
            path: `finance/payouts/${id}/decision`,
            fields: [reason],
            body: (v) => ({ approve, reason: v.reason }),
            danger: !approve,
          }))
        : [];
    case 'review-queue':
      return [
        {
          title: ['Sharhni yashirish', 'Скрыть отзыв'],
          path: `trust/reviews/${id}/hide`,
          fields: [reason],
          danger: true,
        },
      ];
    case 'content-sellers':
      return [
        {
          title: ['Reyting jarimasi', 'Штраф рейтинга'],
          path: `sellers/${id}/content-sanctions`,
          fields: [
            reason,
            {
              key: 'points',
              label: ['Reytingdan ayirish', 'Снять баллы'],
              type: 'number',
              min: 0.01,
              max: 5,
              step: '0.01',
            },
          ],
          body: (v) => ({ ...v, type: 'RATING_PENALTY' }),
          danger: true,
        },
        {
          title: ['Vaqtincha to‘xtatish', 'Временно приостановить'],
          path: `sellers/${id}/content-sanctions`,
          fields: [
            reason,
            { key: 'endAt', label: ['Tugash muddati', 'Срок окончания'], type: 'datetime-local' },
          ],
          body: (v) => ({ ...v, type: 'TEMP_SUSPENSION', endAt: new Date(v.endAt).toISOString() }),
          danger: true,
        },
      ];
    case 'sellers':
      return [
        {
          title: ['Depozitni muzlatish', 'Заморозить депозит'],
          permission: 'sanctions:finance',
          path: `sellers/${id}/finance-sanctions`,
          fields: [
            reason,
            {
              key: 'amount',
              label: ['Jami muzlatiladigan summa', 'Общая замороженная сумма'],
              pattern: '[0-9]+(\\.[0-9]{1,2})?',
            },
          ],
          body: (v) => ({ ...v, type: 'DEPOSIT_HOLD' }),
          danger: true,
        },
        {
          title: ['Doimiy bloklash', 'Постоянная блокировка'],
          permission: 'sanctions:finance',
          path: `sellers/${id}/finance-sanctions`,
          fields: [reason],
          body: (v) => ({ ...v, type: 'PERMANENT_BAN' }),
          danger: true,
        },

        {
          title: ['Stavkalarni tahrirlash', 'Изменить ставки'],
          path: `sellers/${id}/rates`,
          method: 'PUT',
          fields: [
            {
              key: 'commissionRate',
              label: ['Komissiya, %', 'Комиссия, %'],
              pattern: '[0-9]+(\\.[0-9]{1,2})?',
            },
            { key: 'taxRate', label: ['Soliq, %', 'Налог, %'], pattern: '[0-9]+(\\.[0-9]{1,2})?' },
          ],
          initial: { commissionRate: r.commissionRate, taxRate: r.taxRate },
        },
      ];
    case 'categories':
      return [category(r)];
    case 'keywords':
      return [
        keyword(r),
        {
          title: ['O‘chirish', 'Удалить'],
          path: `admin/keywords/${id}`,
          method: 'DELETE',
          body: () => undefined,
          danger: true,
        },
      ];
    case 'promotions':
    case 'platform-promotions':
      return [promotion(section, r)];
    case 'templates':
      return [
        {
          title: ['Shablonni tahrirlash', 'Изменить шаблон'],
          path: `admin/notification-templates/${r.eventType}`,
          method: 'PUT',
          fields: titleFields.map((f) => ({ ...f, type: 'textarea' })),
          initial: r.bodyI18n,
          body: (v) => ({ bodyI18n: { uz: v.uz, ru: v.ru } }),
        },
      ];
    case 'tiers':
      return [
        {
          title: ['Depozitni tahrirlash', 'Изменить депозит'],
          path: `admin/deposit-tiers/${r.minProductCount}`,
          method: 'PUT',
          fields: [
            {
              key: 'depositAmount',
              label: ['Depozit summasi', 'Сумма депозита'],
              pattern: '[0-9]+(\\.[0-9]{1,2})?',
            },
          ],
          initial: { depositAmount: r.depositAmount },
        },
      ];
    case 'staff':
      return [
        {
          title: r.isActive
            ? ['Kirishni bloklash', 'Заблокировать доступ']
            : ['Kirishni tiklash', 'Восстановить доступ'],
          path: `admin/staff/${id}`,
          method: 'PATCH',
          body: () => ({ isActive: !r.isActive }),
          danger: r.isActive,
        },
      ];
    default:
      return [];
  }
}
