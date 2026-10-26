'use client';
import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { mutate, Row } from '@/lib/client';
import { Text, statusLabels } from '@/lib/workspace';
import { useLocale } from './locale';
export function Status({ value }: { value: unknown }) {
  const { t } = useLocale();
  const key = String(value ?? '');
  const good = [
      'ACTIVE',
      'COMPLETED',
      'SUCCESS',
      'APPROVED',
      'RESOLVED',
      'REFUNDED',
      'CONFIRMED',
    ].includes(key),
    bad = ['REJECTED', 'FAILED', 'BANNED', 'SUSPENDED', 'CANCELLED'].includes(key);
  return (
    <span className={`status ${good ? 'good' : bad ? 'bad' : 'pending'}`}>
      <i />
      {statusLabels[key] ? t(...statusLabels[key]) : key || '—'}
    </span>
  );
}
export function Empty() {
  const { t } = useLocale();
  return (
    <div className="empty">
      <span>▤</span>
      <h3>{t('Hozircha ma’lumot yo‘q', 'Пока нет данных')}</h3>
      <p>{t('Yangi yozuvlar shu yerda ko‘rinadi.', 'Новые записи появятся здесь.')}</p>
    </div>
  );
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="alert" role="alert">
      <span>{message}</span>
      {retry && <button onClick={retry}>{t('Qayta urinish', 'Повторить')}</button>}
    </div>
  );
}
export function Loading() {
  const { t } = useLocale();
  return (
    <div className="loading" role="status">
      <i />
      {t('Yuklanmoqda…', 'Загрузка…')}
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useLocale();
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button aria-label={t('Yopish', 'Закрыть')} disabled={busy} onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export type Field = {
  key: string;
  label: Text;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'datetime-local';
  options?: [string, Text][];
  optional?: boolean;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  hint?: Text;
};
export type Action = {
  permission?: string;
  title: Text;
  path: string | ((values: Row) => string);
  method?: string;
  fields?: Field[];
  initial?: Row;
  body?: (values: Row) => unknown;
  note?: Text;
  danger?: boolean;
};
export function ActionForm({
  action,
  close,
  done,
}: {
  action: Action;
  close: () => void;
  done: () => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget),
      v: Row = { ...action.initial };
    for (const f of action.fields ?? []) {
      const value = data.get(f.key);
      if (f.type === 'checkbox') v[f.key] = value === 'on';
      else if (value !== '' && value !== null)
        v[f.key] = f.type === 'number' ? Number(value) : value;
      else delete v[f.key];
    }
    try {
      await mutate(
        typeof action.path === 'function' ? action.path(v) : action.path,
        action.body ? action.body(v) : v,
        action.method,
      );
      done();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t(...action.title)} close={close} busy={busy}>
      <form onSubmit={submit}>
        {action.note && <p className="notice">{t(...action.note)}</p>}
        <div className="form-grid">
          {action.fields?.map((f) => (
            <label
              key={f.key}
              className={f.type === 'checkbox' ? 'check' : f.type === 'textarea' ? 'wide' : ''}
            >
              {f.type !== 'checkbox' && t(...f.label)}
              {f.type === 'textarea' ? (
                <textarea
                  name={f.key}
                  defaultValue={action.initial?.[f.key] ?? ''}
                  required={!f.optional}
                  rows={4}
                />
              ) : f.type === 'select' ? (
                <select
                  name={f.key}
                  defaultValue={action.initial?.[f.key] ?? f.options?.[0]?.[0]}
                  required={!f.optional}
                >
                  {f.optional && <option value="">—</option>}
                  {f.options?.map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(...label)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  type={f.type ?? 'text'}
                  defaultValue={f.type === 'checkbox' ? undefined : (action.initial?.[f.key] ?? '')}
                  defaultChecked={
                    f.type === 'checkbox' ? Boolean(action.initial?.[f.key]) : undefined
                  }
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  pattern={f.pattern}
                  required={f.type !== 'checkbox' && !f.optional}
                />
              )}{' '}
              {f.type === 'checkbox' && t(...f.label)}
              {f.hint && <small>{t(...f.hint)}</small>}
            </label>
          ))}
        </div>
        {error && <ErrorBox message={error} />}
        <div className="dialog-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t('Bekor qilish', 'Отмена')}
          </button>
          <button className={action.danger ? 'danger' : 'primary'} disabled={busy}>
            {busy ? t('Saqlanmoqda…', 'Сохранение…') : t('Tasdiqlash', 'Подтвердить')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function Details({ row, close }: { row: Row; close: () => void }) {
  const { t, locale } = useLocale();
  const skip = new Set([
    'passwordHash',
    'token',
    'refreshToken',
    'accessToken',
    'destinationToken',
  ]);
  const labels: Record<string, string> = {
    id: t('Raqam', 'Номер'),
    titleI18n: t('Nomi', 'Название'),
    description: t('Tavsif', 'Описание'),
    buyerEvidence: t('Xaridor dalillari', 'Доказательства покупателя'),
    sellerEvidence: t('Sotuvchi dalillari', 'Доказательства продавца'),
    reason: t('Sabab', 'Причина'),
    quantity: t('Soni', 'Количество'),
    sku: 'SKU',
    price: t('Narx', 'Цена'),
    stockQuantity: t('Qoldiq', 'Остаток'),
    status: t('Holat', 'Статус'),
    comment: t('Sharh', 'Комментарий'),
    photos: t('Rasmlar', 'Фото'),
    url: t('Havola', 'Ссылка'),
    images: t('Rasmlar', 'Изображения'),
    variants: t('Variantlar', 'Варианты'),
    attributes: t('Xususiyatlar', 'Характеристики'),
    storeName: t('Do‘kon', 'Магазин'),
    legalTaxId: t('STIR', 'ИНН'),
    pickupAddress: t('Olib ketish manzili', 'Адрес забора'),
    sellerReply: t('Sotuvchi javobi', 'Ответ продавца'),
  };
  function value(v: unknown): ReactNode {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? t('Ha', 'Да') : t('Yo‘q', 'Нет');
    if (typeof v === 'object') {
      if ('uz' in v || 'ru' in v) return String((v as Row)[locale] ?? (v as Row).uz ?? '');
      if (Array.isArray(v))
        return (
          <div className="detail-list">
            {v.map((x, i) => (
              <div key={i}>{value(x)}</div>
            ))}
          </div>
        );
      return (
        <dl className="details">
          {Object.entries(v)
            .filter(([k]) => !skip.has(k))
            .map(([k, x]) => (
              <div key={k}>
                <dt>{labels[k] ?? k}</dt>
                <dd>{value(x)}</dd>
              </div>
            ))}
        </dl>
      );
    }
    if (typeof v === 'string' && /^https?:\/\//.test(v))
      return (
        <a href={v} target="_blank" rel="noopener noreferrer">
          {t('Ochish ↗', 'Открыть ↗')}
        </a>
      );
    return String(v);
  }
  return (
    <Dialog title={t('Tafsilotlar', 'Подробности')} close={close}>
      <div className="detail-body">{value(row)}</div>
    </Dialog>
  );
}
