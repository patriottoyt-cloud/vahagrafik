import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    'Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Добавьте их в .env (для локальной разработки) или в переменные окружения Netlify (для сайта).'
  );
}

export const supabase = createClient(url || '', key || '');
