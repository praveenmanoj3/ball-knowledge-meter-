import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of envContent.split('\n')) {
      const [k, v] = line.split('=');
      if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v?.trim();
      if (k?.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || k?.trim() === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
        if (!supabaseKey) supabaseKey = v?.trim();
      }
    }
  } catch (e) {}
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { data: withJoin, error: errJoin } = await supabase.from('sessions').select('*, presentation:presentations(*)').limit(1);
  console.log("WITH JOIN (*, presentation:presentations(*)):", { data: withJoin, error: errJoin });

  const { data: withoutJoin, error: errNoJoin } = await supabase.from('sessions').select('*').limit(1);
  console.log("WITHOUT JOIN (*):", { data: withoutJoin, error: errNoJoin });
}

testQuery();
