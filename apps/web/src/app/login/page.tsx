'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client';
import { LanguageSwitch, useLocale } from '@/components/locale';
export default function Login() {
  const router = useRouter(),
    { t } = useLocale();
  const [mode, setMode] = useState<'seller' | 'staff'>('seller'),
    [phone, setPhone] = useState('+998'),
    [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'staff') {
        await mutate('auth/staff/login', {
          email: form.get('email'),
          password: form.get('password'),
          ...(form.get('code') ? { code: form.get('code') } : {}),
        });
        router.replace('/workspace/overview');
      } else {
        await mutate(register ? 'auth/register' : 'auth/login', {
          phone,
          password: form.get('password'),
        });
        router.replace('/workspace/overview');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-symbol">m.</span>marketplace
        </a>
        <div>
          <span className="eyebrow">{t('SOTUVCHI VA JAMOA UCHUN', 'ДЛЯ ПРОДАВЦОВ И КОМАНДЫ')}</span>
          <h1>{t('Savdongiz.\nBir joyda.', 'Ваш бизнес.\nВ одном месте.')}</h1>
          <p>
            {t(
              'Mahsulotlar, buyurtmalar va hisob-kitoblarni tartibli boshqaring.',
              'Управляйте товарами, заказами и расчётами.',
            )}
          </p>
          <div className="story-lines">
            <span>
              01 <b>{t('Mahsulotlaringiz', 'Ваши товары')}</b>
            </span>
            <span>
              02 <b>{t('Har bir buyurtma', 'Каждый заказ')}</b>
            </span>
            <span>
              03 <b>{t('Aniq hisob-kitob', 'Прозрачные расчёты')}</b>
            </span>
          </div>
        </div>
        <small>Marketplace · {t('Boshqaruv kabineti', 'Кабинет управления')}</small>
      </section>
      <section className="login-form">
        <div className="login-top">
          <span>{t('Xush kelibsiz', 'Добро пожаловать')}</span>
          <LanguageSwitch />
        </div>
        <div className="login-card">
          <span className="eyebrow">{t('ISHNI DAVOM ETTIRING', 'ПРОДОЛЖИТЕ РАБОТУ')}</span>
          <h2>{t('Kabinetga kirish', 'Вход в кабинет')}</h2>
          <p className="muted">
            {t(
              'Hisobingiz orqali ish maydoningizga kiring.',
              'Войдите в своё рабочее пространство.',
            )}
          </p>
          <div className="tabs" role="tablist">
            {(['seller', 'staff'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={mode === v}
                className={mode === v ? 'selected' : ''}
                onClick={() => {
                  setMode(v);
                  setError('');
                }}
              >
                {v === 'seller'
                  ? t('Sotuvchi', 'Продавец')
                  : t('Platforma jamoasi', 'Команда платформы')}
              </button>
            ))}
          </div>
          <form key={`${mode}-${register}`} onSubmit={submit}>
            {mode === 'seller' ? (
              <>
                <label>
                  {t('Telefon raqami', 'Номер телефона')}
                  <input
                    type="tel"
                    autoComplete="tel"
                    pattern="\+998[0-9]{9}"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                  />
                </label>
                <label>
                  {t('Parol', 'Пароль')}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={register ? 8 : 1}
                    maxLength={256}
                    autoComplete={register ? 'new-password' : 'current-password'}
                  />
                  {register && <small>{t('Kamida 8 ta belgi.', 'Не менее 8 символов.')}</small>}
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={register}
                    onChange={(e) => {
                      setRegister(e.target.checked);
                      setError('');
                    }}
                  />
                  {t('Yangi hisob ochish', 'Создать новый аккаунт')}
                </label>
              </>
            ) : (
              <>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="ism@kompaniya.uz"
                  />
                </label>
                <label>
                  {t('Parol', 'Пароль')}
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
                <label>
                  {t('Autentifikator kodi', 'Код аутентификатора')}
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="000000"
                  />
                  <small>{t('Super Admin uchun majburiy.', 'Обязателен для Super Admin.')}</small>
                </label>
              </>
            )}
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? t('Tekshirilmoqda…', 'Проверяем…')
                : mode === 'seller' && register
                  ? t('Hisob ochish →', 'Создать аккаунт →')
                  : t('Kabinetga kirish →', 'Войти →')}
            </button>
          </form>
          <p className="login-note">
            {t(
              'Har bir amal sizning vakolatingiz doirasida bajariladi.',
              'Доступ к действиям определяется вашими полномочиями.',
            )}
          </p>
        </div>
        <footer>
          {t('Sotuvchi kabineti · Moderator · Moliya', 'Кабинет продавца · Модератор · Финансы')}
        </footer>
      </section>
    </main>
  );
}
