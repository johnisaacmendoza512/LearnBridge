import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('KEY starts with:', supabaseKey?.slice(0, 20));

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');