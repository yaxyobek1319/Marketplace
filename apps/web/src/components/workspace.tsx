'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, ReactNode } from 'react';
import { Actor, api, ApiError, mutate, Row, money, date } from '@/lib/client';
import { accountLabels, allowed, localized, Section, sections } from '@/lib/workspace';
import { category, keyword, promotion, rowActions } from '@/lib/actions';
import { Action, ActionForm, Details, Empty, ErrorBox, Loading, Status } from './ui';
import { LanguageSwitch, useLocale } from './locale';
import { Deposit } from './deposit';
import { ProductEditor } from './product-editor';
export function Workspace({ sectionKey }: { sectionKey: string }) {
  const router = useRouter(),
    { t } = useLocale();
  const [actor, setActor] = useState<Actor | null>(null),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false);
  const load = useCallback(() => {
    setError('');
    api<Actor>('auth/session')
      .then(setActor)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login');
        else setError(e.message);
      });
  }, [router]);
  useEffect(load, [load]);
  async function logout() {
    try {
      await mutate('auth/logout-all');
      router.replace('/login');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!actor)
    return (
      <main className="connection-page">
        <a className="brand" href="/">
          <span className="brand-symbol">m.</span>marketplace
        </a>
        {error ? <ErrorBox message={error} retry={load} /> : <Loading />}
        <Link href="/login">{t('Kirish sahifasi', 'Страница входа')}</Link>
      </main>
    );
  const available = sections.filter((s) => allowed(s, actor));
  const section = available.find((s) => s.key === sectionKey);
  return (
    <div className="workspace">
      <aside className={open ? 'sidebar opened' : 'sidebar'}>
        <Link className="brand" href="/workspace/overview">
          <span className="brand-symbol">m.</span>marketplace
        </Link>
        <div className="workspace-type">
          <span className="avatar">{actor.type === 'STAFF' ? 'P' : 'S'}</span>
          <div>
            <strong>
              {actor.type === 'STAFF'
                ? t('Platforma jamoasi', 'Команда платформы')
                : t('Sotuvchi kabineti', 'Кабинет продавца')}
            </strong>
            <small>{t('Ish maydoni', 'Рабочее пространство')}</small>
          </div>
          <button
            className="mobile-only"
            onClick={() => setOpen(false)}
            aria-label={t('Menyuni yopish', 'Закрыть меню')}
          >
            ×
          </button>
        </div>
        <span className="nav-caption">{t('BOSHQARUV', 'УПРАВЛЕНИЕ')}</span>
        <nav aria-label={t('Asosiy menyu', 'Главное меню')}>
          {available.map((s) => (
            <Link
              key={s.key}
              href={`/workspace/${s.key}`}
              onClick={() => setOpen(false)}
              aria-current={sectionKey === s.key ? 'page' : undefined}
            >
              <span aria-hidden>{s.icon}</span>
              {t(...s.title)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="mini-dot" />
          {t('Marketplace boshqaruvi', 'Управление маркетплейсом')}
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-shade"
          aria-label={t('Menyuni yopish', 'Закрыть меню')}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-only"
              onClick={() => setOpen(true)}
              aria-label={t('Menyuni ochish', 'Открыть меню')}
            >
              ☰
            </button>
            <span>Marketplace</span>
            <b>/</b>
            <strong>
              {section ? t(...section.title) : t('Sahifa topilmadi', 'Страница не найдена')}
            </strong>
          </div>
          <div className="top-actions">
            <LanguageSwitch />
            <button className="logout" onClick={logout}>
              {t('Chiqish', 'Выйти')} ↗
            </button>
          </div>
        </header>
        <main className="content">
          {error && <ErrorBox message={error} />}
          <header className="page-heading">
            <div>
              <div className="eyebrow">
                {actor.type === 'STAFF'
                  ? t('PLATFORMA BOSHQARUVI', 'УПРАВЛЕНИЕ ПЛАТФОРМОЙ')
                  : t('SIZNING ISH MAYDONINGIZ', 'ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО')}
              </div>
              <h1>
                {section ? t(...section.title) : t('Sahifa mavjud emas', 'Страница недоступна')}
              </h1>
              {section && <p className="muted">{t(...section.description)}</p>}
            </div>
            <span className="page-date">{date(new Date())}</span>
          </header>
          {section ? (
            section.key === 'overview' ? (
              <Overview actor={actor} />
            ) : section.key === 'deposit' ? (
              <Deposit />
            ) : section.key === 'profile' ? (
              <Profile />
            ) : (
              <Resource key={section.key} section={section} actor={actor} />
            )
          ) : (
            <p>{t('Bu sahifa uchun ruxsatingiz yo‘q.', 'У вас нет доступа к этой странице.')}</p>
          )}
          <footer className="content-footer">
            Marketplace <span>·</span> {t('Barcha hisob-kitoblar UZSda', 'Все расчёты в UZS')}
          </footer>
        </main>
      </div>
    </div>
  );
}
function Overview({ actor }: { actor: Actor }) {
  const { t } = useLocale();
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [action, setAction] = useState<Action | null>(null);
  const load = useCallback(() => {
    if (!actor.sellerId) return;
    setError('');
    Promise.all([api<Row>('workspace/seller/overview'), api<Row>('finance/mine')])
      .then(([overview, finance]) => setData({ ...overview, finance }))
      .catch((e) => setError(e.message));
  }, [actor.sellerId]);
  useEffect(load, [load]);
  const apply: Action = {
    title: ['Sotuvchi bo‘lish', 'Стать продавцом'],
    path: 'sellers',
    fields: [
      { key: 'storeName', label: ['Do‘kon nomi', 'Название магазина'] },
      { key: 'legalTaxId', label: ['STIR', 'ИНН'], pattern: '[0-9]{9,14}' },
      {
        key: 'payoutAccount',
        label: ['Hisobning oxirgi 4 raqami (****1234)', 'Последние 4 цифры счёта (****1234)'],
        pattern: '\\*{4}[0-9]{4}',
      },
      {
        key: 'pickupAddress',
        label: ['Tovarni olib ketish manzili', 'Адрес забора товара'],
        type: 'textarea',
      },
    ],
  };
  if (actor.type === 'USER' && !actor.sellerId)
    return (
      <section className="welcome-panel">
        <div className="eyebrow">{t('BIRINCHI QADAM', 'ПЕРВЫЙ ШАГ')}</div>
        <h2>{t('Do‘koningizni oching', 'Откройте свой магазин')}</h2>
        <p>
          {t(
            'Do‘kon ma’lumotlarini yuboring. Moderator tasdig‘i va depozitdan so‘ng mahsulotlarni nashr qila olasiz.',
            'Отправьте данные магазина. После одобрения и внесения депозита вы сможете публиковать товары.',
          )}
        </p>
        <button className="primary" onClick={() => setAction(apply)}>
          {t('Ariza yuborish', 'Подать заявку')} →
        </button>
        {action && (
          <ActionForm
            action={action}
            close={() => setAction(null)}
            done={() => window.location.reload()}
          />
        )}
      </section>
    );
  if (actor.type === 'STAFF')
    return (
      <>
        <section className="welcome-panel">
          <span className="eyebrow">{t('ISHLASHGA TAYYOR', 'ГОТОВО К РАБОТЕ')}</span>
          <h2>{t('Navbatdagi ishni tanlang', 'Выберите следующую задачу')}</h2>
          <p>
            {t(
              'Moderatsiya, moliya va sozlamalar vakolatingiz bo‘yicha ajratilgan.',
              'Модерация, финансы и настройки доступны согласно вашим полномочиям.',
            )}
          </p>
        </section>
        <div className="quick-grid">
          {sections
            .filter((s) => s.key !== 'overview' && allowed(s, actor))
            .map((s) => (
              <Link key={s.key} href={`/workspace/${s.key}`}>
                <span>{s.icon}</span>
                <h3>{t(...s.title)}</h3>
                <p>{t(...s.description)}</p>
                <b>↗</b>
              </Link>
            ))}
        </div>
      </>
    );
  if (error) return <ErrorBox message={error} retry={load} />;
  if (!data) return <Loading />;
  const count = (group: Row[], status?: string) =>
    group.filter((r) => !status || r.status === status).reduce((n, r) => n + Number(r._count), 0);
  return (
    <>
      <section className="welcome-panel compact">
        <div>
          <span className="eyebrow">{t('SIZNING DO‘KONINGIZ', 'ВАШ МАГАЗИН')}</span>
          <h2>{data.seller.storeName}</h2>
          <p>
            {t('Reyting', 'Рейтинг')}: {data.seller.rating} / 5 · {t('Komissiya', 'Комиссия')}:{' '}
            {data.seller.commissionRate}% · {t('Soliq', 'Налог')}: {data.seller.taxRate}%
          </p>
        </div>
        <Status value={data.seller.status} />
      </section>
      {data.seller.status !== 'ACTIVE' && (
        <p className="notice">
          {data.seller.rejectionReason ??
            t(
              'Do‘konni faollashtirish uchun moderatsiya va depozit bosqichlarini yakunlash kerak.',
              'Для активации магазина необходимы одобрение и депозит.',
            )}
        </p>
      )}
      <div className="stat-grid">
        <Stat
          label={t('Mahsulotlar', 'Товары')}
          value={count(data.products)}
          note={`${count(data.products, 'ACTIVE')} ${t('ta faol', 'активных')}`}
        />
        <Stat
          label={t('Tasdiqlash kutilmoqda', 'Ожидают подтверждения')}
          value={count(data.orders, 'PENDING_SELLER_CONFIRMATION')}
          note={t('Buyurtmalarni vaqtida ko‘rib chiqing', 'Обрабатывайте заказы вовремя')}
        />
        <Stat
          label={t('Yechish mumkin', 'Доступно к выводу')}
          value={money(data.finance.sellerSpendable)}
          note={t('Rezervlar hisobga olingan', 'С учётом резервов')}
        />
        <Stat
          label={t('Muzlatilgan mablag‘', 'Заморожено')}
          value={money(data.finance.sellerFrozen)}
          note={t('Yakunlanmagan buyurtmalar', 'Незавершённые заказы')}
        />
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>{t('Buyurtmalar holati', 'Статусы заказов')}</h3>
            <Link href="/workspace/orders">{t('Barchasi', 'Все')} ↗</Link>
          </div>
          {data.orders.length ? (
            data.orders.map((r: Row) => (
              <div className="summary-row" key={r.status}>
                <Status value={r.status} />
                <strong>{r._count}</strong>
              </div>
            ))
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>{t('Tezkor amallar', 'Быстрые действия')}</h3>
          </div>
          {[
            ['products', 'Mahsulotlar va qoldiq', 'Товары и остатки'],
            ['disputes', 'Nizolarga javob berish', 'Ответы на споры'],
            ['finance', 'Balansni tekshirish', 'Проверить баланс'],
            ['profile', 'Telegramni ulash', 'Подключить Telegram'],
          ].map(([key, uz, ru]) => (
            <Link className="quick-row" key={key} href={`/workspace/${key}`}>
              {t(uz, ru)}
              <span>↗</span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
function Stat({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Profile() {
  const { t } = useLocale();
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [action, setAction] = useState<Action | null>(null),
    [link, setLink] = useState('');
  const load = useCallback(() => {
    setError('');
    api<Row>('me')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  async function telegram() {
    try {
      const r = await mutate<Row>('notifications/telegram/link');
      setLink(r.url ?? r.link ?? r.deepLink ?? '');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel profile-panel">
      {error && <ErrorBox message={error} retry={load} />}{' '}
      {!data ? (
        <Loading />
      ) : (
        <>
          <span className="avatar large">{data.fullName?.[0] ?? 'S'}</span>
          <h2>{data.fullName ?? t('Sizning hisobingiz', 'Ваш аккаунт')}</h2>
          <p className="muted">{data.phone}</p>
          <div className="button-row">
            <button
              onClick={() =>
                setAction({
                  title: ['Profilni tahrirlash', 'Изменить профиль'],
                  path: 'me',
                  method: 'PATCH',
                  fields: [
                    { key: 'fullName', label: ['To‘liq ism', 'Полное имя'] },
                    {
                      key: 'locale',
                      label: ['Xabar tili', 'Язык сообщений'],
                      type: 'select',
                      options: [
                        ['uz', ['O‘zbekcha', 'Узбекский']],
                        ['ru', ['Ruscha', 'Русский']],
                      ],
                    },
                    {
                      key: 'marketingEnabled',
                      label: ['Aksiyalar haqida xabar olish', 'Получать сообщения об акциях'],
                      type: 'checkbox',
                    },
                  ],
                  initial: {
                    fullName: data.fullName,
                    locale: data.locale,
                    marketingEnabled: data.marketingEnabled,
                  },
                })
              }
            >
              {t('Profilni tahrirlash', 'Изменить профиль')}
            </button>
            {data.telegramChatId ? (
              <button
                onClick={() =>
                  setAction({
                    title: ['Telegramni uzish', 'Отключить Telegram'],
                    path: 'notifications/telegram/link',
                    method: 'DELETE',
                    body: () => undefined,
                  })
                }
              >
                {t('Telegramni uzish', 'Отключить Telegram')}
              </button>
            ) : (
              <button onClick={telegram}>{t('Telegramni ulash', 'Подключить Telegram')} ↗</button>
            )}
          </div>
          {link && (
            <a
              className="primary inline-button"
              target="_blank"
              rel="noopener noreferrer"
              href={link}
            >
              {t('Telegram botni ochish', 'Открыть Telegram-бота')} ↗
            </a>
          )}
        </>
      )}
      {action && <ActionForm action={action} close={() => setAction(null)} done={load} />}
    </section>
  );
}
function Resource({ section, actor }: { section: Section; actor: Actor }) {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(false),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    [action, setAction] = useState<Action | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [product, setProduct] = useState(false),
    [balances, setBalances] = useState<Row | null>(null),
    [report, setReport] = useState('finance');
  const [from, setFrom] = useState(() =>
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
    ),
    [to, setTo] = useState(() => new Date().toLocaleDateString('en-CA'));
  const isReport = section.key.endsWith('-report');
  const validPeriod = Boolean(from && to && from <= to);
  const period = validPeriod
    ? new URLSearchParams({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59.999`).toISOString(),
      }).toString()
    : '';
  const load = useCallback(() => {
    if (isReport && !validPeriod) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    const endpoint =
      section.key === 'finance-report' ? `admin/reports/${report}` : section.endpoint!;
    const query = isReport
      ? report === 'popular' && section.key === 'finance-report'
        ? ''
        : `?${period}`
      : section.paged
        ? `?skip=${page * 30}&take=30`
        : '';
    api<Row[]>(endpoint + query)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
    if (section.key === 'finance')
      api<Row>('finance/mine')
        .then(setBalances)
        .catch((e) => setError(e.message));
  }, [section, isReport, validPeriod, report, period, page]);
  useEffect(load, [load]);
  const done = () => {
    setNotice(true);
    load();
  };
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const headings = columns(section.key, t);
  return (
    <>
      {section.key === 'finance' && balances && (
        <div className="stat-grid">
          {[
            ['sellerSpendable', t('Yechish mumkin', 'Доступно к выводу')],
            ['sellerFrozen', t('Muzlatilgan', 'Заморожено')],
            ['sellerDeposit', t('Depozit', 'Депозит')],
            ['buyerCredit', t('Xaridor krediti', 'Кредит покупателя')],
          ].map(([key, label]) => (
            <Stat key={key} label={label} value={money(balances[key])} note="UZS" />
          ))}
        </div>
      )}
      {section.key === 'payouts' && (
        <p className="notice">
          {t(
            'Pul yechish uchun bank provayderi va xavfsiz karta ulash oynasi sozlanishi kerak. Mavjud so‘rovlar quyida ko‘rinadi.',
            'Для вывода средств необходимо настроить банк и безопасную привязку карты. Существующие заявки отображаются ниже.',
          )}
        </p>
      )}
      {isReport && (
        <div className="report-controls">
          <label>
            {t('Boshlanish', 'С')}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            {t('Tugash', 'По')}
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          {section.key === 'finance-report' && (
            <label>
              {t('Hisobot turi', 'Тип отчёта')}
              <select value={report} onChange={(e) => setReport(e.target.value)}>
                {[
                  ['finance', 'Moliya', 'Финансы'],
                  ['tax', 'Soliqlar', 'Налоги'],
                  ['payouts', 'To‘lovlar', 'Выплаты'],
                  ['sellers', 'Sotuvchilar', 'Продавцы'],
                  ['popular', 'Ommabop tovarlar', 'Популярные товары'],
                ].map(([key, uz, ru]) => (
                  <option value={key} key={key}>
                    {t(uz, ru)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {validPeriod && (section.key === 'seller-report' || report === 'finance') && (
            <a
              className="inline-button"
              href={`/api/backend/${section.endpoint}.csv?${period}`}
              download
            >
              ↓ {t('CSV yuklash', 'Скачать CSV')}
            </a>
          )}
        </div>
      )}
      {!validPeriod && isReport && (
        <ErrorBox message={t('Davrni to‘g‘ri tanlang.', 'Выберите корректный период.')} />
      )}
      <section className="panel resource">
        <div className="resource-toolbar">
          <div className="search-box">
            <span>⌕</span>
            <input
              aria-label={t('Joriy sahifada qidirish', 'Поиск на текущей странице')}
              placeholder={t('Joriy sahifada qidirish…', 'Поиск на текущей странице…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="button-row">
            <button onClick={load} disabled={busy}>
              {t('Yangilash', 'Обновить')} ↻
            </button>
            {[
              'products',
              'promotions',
              'platform-promotions',
              'categories',
              'keywords',
              'tiers',
            ].includes(section.key) && (
              <button
                className="primary"
                onClick={() => {
                  if (section.key === 'products') setProduct(true);
                  else if (section.key === 'categories') setAction(category());
                  else if (section.key === 'keywords') setAction(keyword());
                  else if (section.key === 'tiers')
                    setAction({
                      title: ['Yangi depozit pog‘onasi', 'Новый уровень депозита'],
                      path: (v) => `admin/deposit-tiers/${v.count}`,
                      method: 'PUT',
                      fields: [
                        {
                          key: 'count',
                          label: ['Eng kam mahsulot soni', 'Минимальное число товаров'],
                          type: 'number',
                          min: 0,
                        },
                        {
                          key: 'depositAmount',
                          label: ['Depozit summasi', 'Сумма депозита'],
                          pattern: '[0-9]+(\\.[0-9]{1,2})?',
                        },
                      ],
                      body: (v) => ({ depositAmount: v.depositAmount }),
                    });
                  else setAction(promotion(section.key));
                }}
              >
                + {t('Qo‘shish', 'Добавить')}
              </button>
            )}
          </div>
        </div>
        {notice && (
          <div className="success" role="status">
            {t('O‘zgarish saqlandi.', 'Изменения сохранены.')}
            <button
              aria-label={t('Xabarni yopish', 'Закрыть сообщение')}
              onClick={() => setNotice(false)}
            >
              ×
            </button>
          </div>
        )}
        {error ? (
          <ErrorBox message={error} retry={load} />
        ) : busy ? (
          <Loading />
        ) : !filtered.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {headings.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>{t('Amallar', 'Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, index) => (
                  <tr key={r.id ?? r.eventType ?? `${r.account}-${r.direction}-${index}`}>
                    {cells(section.key, r, locale, t, report).map((c, i) => (
                      <td key={i}>{c}</td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button onClick={() => setDetail(r)}>{t('Ko‘rish', 'Открыть')}</button>
                        {rowActions(section.key, r)
                          .filter(
                            (a) =>
                              (!a.permission || actor.permissions.includes(a.permission)) &&
                              (section.key !== 'staff' || r.id !== actor.id),
                          )
                          .map((a, i) => (
                            <button key={i} onClick={() => setAction(a)}>
                              {t(...a.title)}
                            </button>
                          ))}
                        {section.key === 'products' && (
                          <details>
                            <summary>{t('Qoldiq / narx', 'Остатки / цены')}</summary>
                            <div className="variant-actions">
                              {r.variants?.map((v: Row) => (
                                <div key={v.id}>
                                  <strong>{v.sku}</strong>
                                  <span>
                                    {v.stockQuantity} · {money(v.price)}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setAction({
                                        title: ['Qoldiqni o‘zgartirish', 'Изменить остаток'],
                                        path: `catalog/variants/${v.id}/stock`,
                                        fields: [
                                          {
                                            key: 'changeAmount',
                                            label: [
                                              'Qo‘shish (+) / kamaytirish (−)',
                                              'Добавить (+) / списать (−)',
                                            ],
                                            type: 'number',
                                            min: -1000000,
                                            max: 1000000,
                                          },
                                          {
                                            key: 'reason',
                                            label: ['Sabab', 'Причина'],
                                            type: 'textarea',
                                          },
                                        ],
                                      })
                                    }
                                  >
                                    {t('Qoldiq', 'Остаток')}
                                  </button>
                                  <button
                                    onClick={() =>
                                      setAction({
                                        title: ['Narx va faol holat', 'Цена и активность'],
                                        path: `catalog/variants/${v.id}`,
                                        method: 'PATCH',
                                        fields: [
                                          {
                                            key: 'price',
                                            label: ['Narx', 'Цена'],
                                            pattern: '[0-9]+(\\.[0-9]{1,2})?',
                                          },
                                          {
                                            key: 'isActive',
                                            label: ['Faol', 'Активен'],
                                            type: 'checkbox',
                                          },
                                        ],
                                        initial: { price: v.price, isActive: v.isActive },
                                      })
                                    }
                                  >
                                    {t('Narx', 'Цена')}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section.paged && (
          <div className="pagination">
            <span>
              {t('Sahifa', 'Страница')} {page + 1} · {rows.length} {t('ta yozuv', 'записей')}
            </span>
            <div>
              <button disabled={page === 0 || busy} onClick={() => setPage((p) => p - 1)}>
                ← {t('Oldingi', 'Назад')}
              </button>
              <button
                disabled={rows.length < 30 || busy || !!error}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Keyingi', 'Далее')} →
              </button>
            </div>
          </div>
        )}
      </section>
      {action && <ActionForm action={action} close={() => setAction(null)} done={done} />}{' '}
      {detail && <Details row={detail} close={() => setDetail(null)} />}{' '}
      {product && <ProductEditor close={() => setProduct(false)} done={done} />}
    </>
  );
}
function columns(key: string, t: (uz: string, ru: string) => string) {
  if (['products', 'product-queue'].includes(key))
    return [
      t('Mahsulot', 'Товар'),
      t('Variant / qoldiq', 'Варианты / остаток'),
      t('Holat', 'Статус'),
    ];
  if (['seller-queue', 'sellers', 'content-sellers'].includes(key))
    return [t('Do‘kon', 'Магазин'), t('STIR / reyting', 'ИНН / рейтинг'), t('Holat', 'Статус')];
  if (key === 'orders')
    return [
      t('Buyurtma tovari', 'Позиция заказа'),
      t('Summa / muddat', 'Сумма / срок'),
      t('Holat', 'Статус'),
    ];
  if (['finance', 'ledger', 'seller-report', 'finance-report'].includes(key))
    return [
      t('Hisob / nom', 'Счёт / название'),
      t('Summa / ko‘rsatkich', 'Сумма / показатель'),
      t('Yo‘nalish / davr', 'Направление / период'),
    ];
  if (['promotions', 'platform-promotions'].includes(key))
    return [
      t('Kupon / aksiya', 'Купон / акция'),
      t('Chegirma', 'Скидка'),
      t('Holat / tugash', 'Статус / окончание'),
    ];
  if (key === 'categories')
    return [t('Kategoriya', 'Категория'), 'MXIK', t('Xavf darajasi', 'Уровень риска')];
  if (key === 'keywords') return [t('Ibora', 'Фраза'), t('Daraja', 'Уровень'), t('Sana', 'Дата')];
  if (key === 'tiers')
    return [
      t('Pog‘ona', 'Уровень'),
      t('Depozit', 'Депозит'),
      t('Mahsulot soni', 'Количество товаров'),
    ];
  return [
    t('Nomi / raqam', 'Название / номер'),
    t('Ma’lumot', 'Данные'),
    t('Holat / sana', 'Статус / дата'),
  ];
}
function cells(
  key: string,
  r: Row,
  locale: string,
  t: (uz: string, ru: string) => string,
  report: string,
): ReactNode[] {
  const short = (v: unknown) => String(v ?? '—').slice(0, 8);
  const title = (v: unknown) => <strong>{localized(v, locale)}</strong>;
  const dated = (v: unknown) => <small>{date(v)}</small>;
  const account = accountLabels[r.account] ? t(...accountLabels[r.account]) : r.account;
  if (['products', 'product-queue'].includes(key))
    return [
      <div className="product-cell" key="product">
        {r.images?.[0]?.url ? (
          <img src={r.images[0].url} alt="" />
        ) : (
          <span className="product-placeholder">▦</span>
        )}
        <div>
          {title(r.titleI18n)}
          <small>#{short(r.id)}</small>
        </div>
      </div>,
      <span key="stock">
        {r.variants?.length ?? 0} /{' '}
        {r.variants?.reduce((n: number, v: Row) => n + v.stockQuantity, 0) ?? 0}
      </span>,
      <Status key="status" value={r.status} />,
    ];
  if (['seller-queue', 'sellers', 'content-sellers'].includes(key))
    return [
      title(r.storeName),
      <span key="tax">
        {r.legalTaxId ?? '—'}
        <small>★ {r.rating}</small>
      </span>,
      <Status key="s" value={r.status} />,
    ];
  if (key === 'orders')
    return [
      <span key="item">
        <strong>{localized(r.titleAtPurchase, locale)}</strong>
        <small>
          #{short(r.id)} · {r.quantity} × {money(r.priceAtPurchase)}
        </small>
      </span>,
      <span key="total">
        {money(
          Number(r.priceAtPurchase) * r.quantity -
            Number(r.discountAmount) -
            Number(r.platformDiscountAmount) +
            Number(r.deliveryAmount),
        )}
        <small>
          {r.status === 'PENDING_SELLER_CONFIRMATION'
            ? t('Tasdiqlash muddati: ', 'Срок подтверждения: ')
            : ''}
          {r.status === 'PENDING_SELLER_CONFIRMATION'
            ? date(r.confirmDeadline)
            : (r.shipment?.trackingCode ?? '')}
        </small>
      </span>,
      <Status key="s" value={r.status} />,
    ];
  if (['finance', 'ledger', 'seller-report', 'finance-report'].includes(key)) {
    if (key === 'finance-report' && report === 'popular')
      return [
        title(r.titleI18n),
        `${r.viewCount} ${t('ko‘rish', 'просмотров')}`,
        `${r.variants?.reduce((n: number, v: Row) => n + v.salesCount, 0)} ${t('sotuv', 'продаж')}`,
      ];
    if (key === 'finance-report' && report === 'sellers')
      return [title(r.storeName), `★ ${r.rating}`, `${r.disputes} ${t('nizo', 'споров')}`];
    return [
      account ?? r.sellerId ?? r.payeeType,
      money(r.amount ?? r._sum?.amount ?? r.taxAmount),
      r.direction ? (
        <Status key="direction" value={r.direction} />
      ) : r.status ? (
        <Status key="s" value={r.status} />
      ) : (
        dated(r.createdAt)
      ),
    ];
  }
  if (['promotions', 'platform-promotions'].includes(key))
    return [
      title(r.couponCode ?? t('Avtomatik chegirma', 'Автоматическая скидка')),
      r.discountPercent ? `${r.discountPercent}%` : money(r.fixedAmount),
      <span key="promo">
        <Status value={r.isActive ? 'ACTIVE' : 'SUSPENDED'} />
        {dated(r.endAt)}
      </span>,
    ];
  if (key === 'categories')
    return [
      <span key="category">
        {title(r.nameI18n)}
        <small>
          #{r.id} {r.parentId ? `/ ${r.parentId}` : ''}
        </small>
      </span>,
      r.mxikCode ?? '—',
      <Status key="s" value={r.riskLevel} />,
    ];
  if (key === 'keywords')
    return [title(r.term), <Status key="s" value={r.severity} />, dated(r.createdAt)];
  if (key === 'tiers') return [`#${r.id}`, money(r.depositAmount), `${r.minProductCount}+`];
  if (['reviews', 'review-queue'].includes(key))
    return [
      title(r.product?.titleI18n),
      <span key="review">
        {'★'.repeat(r.rating)}
        <small>{r.comment}</small>
      </span>,
      dated(r.createdAt),
    ];
  if (key === 'staff')
    return [title(r.email), r.role, <Status key="s" value={r.isActive ? 'ACTIVE' : 'SUSPENDED'} />];
  if (key === 'templates')
    return [
      r.eventType,
      localized(r.bodyI18n, locale),
      r.critical ? t('Muhim xabar', 'Важное сообщение') : t('Oddiy xabar', 'Обычное сообщение'),
    ];
  if (key === 'audit')
    return [
      r.actionType ?? r.action,
      <span key="target">
        {r.targetType}
        <small>#{short(r.targetId)}</small>
      </span>,
      dated(r.createdAt),
    ];
  if (key === 'delivery-failed')
    return [
      r.trackingCode ?? `#${short(r.id)}`,
      r.recipientAddress,
      <Status key="s" value={r.status} />,
    ];
  if (key === 'notifications')
    return [
      r.eventType,
      r.channel,
      <span key="n">
        <Status value={r.status} />
        {dated(r.createdAt)}
      </span>,
    ];
  if (key === 'reports-queue')
    return [
      <span key="target">
        {r.targetType}
        <small>#{short(r.targetId)}</small>
      </span>,
      r.reason,
      dated(r.createdAt),
    ];
  if (['payouts', 'payout-queue'].includes(key))
    return [
      <span key="payout">
        #{short(r.id)}
        <small>{r.destinationMasked}</small>
      </span>,
      money(r.amount),
      <Status key="s" value={r.status} />,
    ];
  return [
    <span key="reference">
      #{short(r.id)}
      <small>#{short(r.orderItemId)}</small>
    </span>,
    r.reason,
    <span key="state">
      <Status value={r.status} />
      {dated(r.createdAt)}
    </span>,
  ];
}
