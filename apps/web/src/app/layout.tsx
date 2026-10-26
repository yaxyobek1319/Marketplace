import type { Metadata } from 'next';
import { LocaleProvider } from '@/components/locale';
import './globals.css';
export const metadata: Metadata = {
  title: 'Marketplace — boshqaruv kabineti',
  description: 'Sotuvchilar va platforma jamoasi uchun ish maydoni',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
