import { supabase } from './supabaseClient';

/*
 * Drop-in replacement for the Claude-artifact `window.storage` API,
 * backed by one Supabase table:
 *
 *   create table app_kv (
 *     key text primary key,
 *     value jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 *
 * See README.md for the exact SQL + RLS policy to run once in Supabase.
 */

export async function storageGet(key) {
  try {
    const { data, error } = await supabase
      .from('app_kv')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    return data.value;
  } catch (e) {
    console.error('storageGet failed', key, e);
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    const { error } = await supabase
      .from('app_kv')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('storageSet failed', key, e);
    return false;
  }
}

export async function storageList(prefix) {
  try {
    const { data, error } = await supabase
      .from('app_kv')
      .select('key')
      .like('key', `${prefix}%`);
    if (error || !data) return [];
    return data.map((r) => r.key);
  } catch (e) {
    console.error('storageList failed', prefix, e);
    return [];
  }
}
