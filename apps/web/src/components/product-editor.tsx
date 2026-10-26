'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, mutate, Row } from '@/lib/client';
import { localized } from '@/lib/workspace';
import { Dialog, ErrorBox, Loading } from './ui';
import { useLocale } from './locale';
type Variant = {
  sku: string;
  price: string;
  stockQuantity: number;
  attributes: { key: string; value: string }[];
};
export function ProductEditor({ close, done }: { close: () => void; done: () => void }) {
  const { t, locale } = useLocale();
  const [categories, setCategories] = useState<Row[] | null>(null),
    [variants, setVariants] = useState<Variant[]>([
      { sku: '', price: '', stockQuantity: 0, attributes: [] },
    ]),
    [images, setImages] = useState<string[]>([]),
    [attributes, setAttributes] = useState<{ key: string; value: string }[]>([]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    api<Row[]>('catalog/categories')
      .then(setCategories)
      .catch((e) => setError(e.message));
  }, []);
  function update(index: number, patch: Partial<Variant>) {
    setVariants((v) => v.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error(
            t('Rasm 10 MB dan kichik bo‘lsin.', 'Размер изображения должен быть меньше 10 МБ.'),
          );
        const form = new FormData();
        form.set('file', file);
        const result = await api<{ url: string }>('media/products', { method: 'POST', body: form });
        setImages((v) => [...v, result.url]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (new Set(variants.map((v) => v.sku)).size !== variants.length)
        throw new Error(t('SKU takrorlanmasin.', 'SKU не должен повторяться.'));
      await mutate('catalog/products', {
        titleI18n: { uz: form.get('uz'), ru: form.get('ru') },
        description: form.get('description'),
        categoryId: Number(form.get('categoryId')),
        ...(form.get('mxik') ? { mxikCodeOverride: form.get('mxik') } : {}),
        images,
        variants: variants.map((v) => ({
          ...v,
          attributes: Object.fromEntries(
            v.attributes.filter((a) => a.key).map((a) => [a.key, a.value]),
          ),
          images: [],
        })),
        attributes: attributes.map((a) => ({ ...a, type: 'TEXT' })),
      });
      done();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t('Yangi mahsulot', 'Новый товар')} close={close} busy={busy || uploading}>
      <form onSubmit={save}>
        <p className="muted">
          {t(
            'Avval qoralama saqlanadi. Tayyor bo‘lgach tekshiruvga yuboring.',
            'Сначала сохранится черновик. Затем отправьте его на проверку.',
          )}
        </p>
        {!categories ? (
          <Loading />
        ) : (
          <>
            <div className="form-grid">
              <label>
                {t('Nomi · O‘zbekcha', 'Название · Узбекский')}
                <input name="uz" required maxLength={500} />
              </label>
              <label>
                {t('Nomi · Ruscha', 'Название · Русский')}
                <input name="ru" required maxLength={500} />
              </label>
              <label>
                {t('Kategoriya', 'Категория')}
                <select name="categoryId" required defaultValue="">
                  <option value="" disabled>
                    {t('Tanlang', 'Выберите')}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localized(c.nameI18n, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('MXIK (ixtiyoriy)', 'ИКПУ (необязательно)')}
                <input name="mxik" pattern="[0-9]{17}" maxLength={17} />
              </label>
              <label className="wide">
                {t('Tavsif', 'Описание')}
                <textarea name="description" rows={4} maxLength={20000} />
              </label>
            </div>
            <h3>{t('Rasmlar', 'Изображения')}</h3>
            <div className="image-strip">
              {images.map((url, i) => (
                <div key={url}>
                  <img src={url} alt={`${t('Mahsulot rasmi', 'Фото товара')} ${i + 1}`} />
                  <button
                    type="button"
                    aria-label={t('Rasmni olib tashlash', 'Удалить изображение')}
                    onClick={() => setImages((v) => v.filter((_, n) => i !== n))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="upload">
              {uploading
                ? t('Yuklanmoqda…', 'Загрузка…')
                : t('Rasm yuklash · PNG, JPG, WebP · 10 MB', 'Загрузить · PNG, JPG, WebP · 10 МБ')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={uploading || images.length >= 20}
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
            <h3>{t('Variantlar va qoldiq', 'Варианты и остатки')}</h3>
            {variants.map((v, index) => (
              <fieldset key={index}>
                <legend>
                  {t('Variant', 'Вариант')} {index + 1}
                </legend>
                <div className="form-grid">
                  <label>
                    SKU
                    <input
                      value={v.sku}
                      onChange={(e) => update(index, { sku: e.target.value })}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t('Narx, so‘m', 'Цена, сум')}
                    <input
                      inputMode="decimal"
                      pattern="[0-9]+(\.[0-9]{1,2})?"
                      value={v.price}
                      onChange={(e) => update(index, { price: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    {t('Ombordagi soni', 'Остаток')}
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      value={v.stockQuantity}
                      onChange={(e) => update(index, { stockQuantity: Number(e.target.value) })}
                      required
                    />
                  </label>
                </div>
                {v.attributes.map((a, i) => (
                  <div className="inline-fields" key={i}>
                    <input
                      aria-label={t('Xususiyat nomi', 'Название свойства')}
                      placeholder={t('Masalan, rang', 'Например, цвет')}
                      value={a.key}
                      required
                      onChange={(e) =>
                        update(index, {
                          attributes: v.attributes.map((x, n) =>
                            n === i ? { ...x, key: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={t('Qiymati', 'Значение')}
                      placeholder={t('Masalan, qora', 'Например, чёрный')}
                      value={a.value}
                      required
                      onChange={(e) =>
                        update(index, {
                          attributes: v.attributes.map((x, n) =>
                            n === i ? { ...x, value: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={t('Xususiyatni o‘chirish', 'Удалить свойство')}
                      onClick={() =>
                        update(index, { attributes: v.attributes.filter((_, n) => n !== i) })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() =>
                      update(index, { attributes: [...v.attributes, { key: '', value: '' }] })
                    }
                  >
                    + {t('Rang / o‘lcham', 'Цвет / размер')}
                  </button>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVariants((v) => v.filter((_, i) => i !== index))}
                    >
                      {t('Variantni o‘chirish', 'Удалить вариант')}
                    </button>
                  )}
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              onClick={() =>
                setVariants((v) => [...v, { sku: '', price: '', stockQuantity: 0, attributes: [] }])
              }
              disabled={variants.length >= 200}
            >
              + {t('Variant qo‘shish', 'Добавить вариант')}
            </button>
            <h3>{t('Texnik xususiyatlar', 'Характеристики')}</h3>
            {attributes.map((a, i) => (
              <div className="inline-fields" key={i}>
                <input
                  aria-label={t('Xususiyat nomi', 'Название характеристики')}
                  value={a.key}
                  required
                  onChange={(e) =>
                    setAttributes((v) =>
                      v.map((x, n) => (n === i ? { ...x, key: e.target.value } : x)),
                    )
                  }
                />
                <input
                  aria-label={t('Qiymati', 'Значение')}
                  value={a.value}
                  required
                  onChange={(e) =>
                    setAttributes((v) =>
                      v.map((x, n) => (n === i ? { ...x, value: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={t('Xususiyatni o‘chirish', 'Удалить характеристику')}
                  onClick={() => setAttributes((v) => v.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAttributes((v) => [...v, { key: '', value: '' }])}
            >
              + {t('Xususiyat qo‘shish', 'Добавить характеристику')}
            </button>
          </>
        )}
        {error && <ErrorBox message={error} />}
        <div className="dialog-footer">
          <button type="button" onClick={close} disabled={busy || uploading}>
            {t('Bekor qilish', 'Отмена')}
          </button>
          <button className="primary" disabled={busy || uploading || !categories?.length}>
            {busy
              ? t('Saqlanmoqda…', 'Сохранение…')
              : t('Qoralamani saqlash', 'Сохранить черновик')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
