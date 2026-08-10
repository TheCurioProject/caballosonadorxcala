import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function RootPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value;

  if (locale === 'en' || locale === 'de') {
    redirect(`/${locale}/`);
  }

  redirect('/es/');
}
