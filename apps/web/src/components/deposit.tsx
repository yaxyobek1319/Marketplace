'use client';
import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api, mutate, Row, money, date } from '@/lib/client';
import { useLocale } from './locale';
import { Empty, ErrorBox, Loading, Status } from './ui';
export function Deposit() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<string[]>([]),
    [payments, setPayments] = useState<Row[]>([]),
    [balance, setBalance] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setError('');
    Promise.all([
      api<string[]>('payments/providers'),
      api<Row[]>('payments/deposits'),
      api<Row>('finance/mine'),
    ])
      .then(([p, history, b]) => {
        setProviders(p);
        setPayments(history);
        setBalance(b);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await mutate('payments/deposit', {
        amount: form.get('amount'),
        provider: form.get('provider'),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel profile-panel">
        <h2>{t('Do‘kon depoziti', 'Депозит магазина')}</h2>
        {balance && <p className="deposit-balance">{money(balance.sellerDeposit)}</p>}
        {loading ? (
          <Loading />
        ) : !providers.length ? (
          <p className="notice">
            {t(
              'Hozircha to‘lov usuli ulanmagan. Usul ishga tushirilgach depozitni shu yerda to‘ldirasiz.',
              'Способы оплаты пока не подключены. После подключения здесь можно будет пополнить депозит.',
            )}
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                {t('Summa, so‘m', 'Сумма, сум')}
                <input name="amount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required />
              </label>
              <label>
                {t('To‘lov usuli', 'Способ оплаты')}
                <select name="provider">
                  {providers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary" disabled={busy}>
              {busy ? t('Tayyorlanmoqda…', 'Подготовка…') : t('To‘lov yaratish', 'Создать платёж')}
            </button>
          </form>
        )}
        {error && <ErrorBox message={error} retry={load} />}
      </section>
      <section className="panel deposit-history">
        <div className="panel-heading">
          <h3>{t('To‘lovlar tarixi', 'История платежей')}</h3>
          <button onClick={load}>{t('Yangilash', 'Обновить')} ↻</button>
        </div>
        {!payments.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Sana', 'Дата')}</th>
                  <th>{t('Summa', 'Сумма')}</th>
                  <th>{t('Holat', 'Статус')}</th>
                  <th>{t('Amal', 'Действие')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.createdAt)}</td>
                    <td>{money(p.amount)}</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td>
                      {p.status === 'PENDING' &&
                        (p.checkoutUrl && /^https:\/\//.test(p.checkoutUrl) ? (
                          <a
                            className="inline-button"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={p.checkoutUrl}
                          >
                            {t('To‘lov sahifasi', 'Страница оплаты')} ↗
                          </a>
                        ) : (
                          t(
                            'Havola tayyorlanmoqda. Holatni yangilang.',
                            'Ссылка готовится. Обновите статус.',
                          )
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
