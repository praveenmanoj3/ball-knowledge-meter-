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

async function checkDatabaseStats() {
  console.log("🔍 ============================================================");
  console.log("🔍 SUPABASE DATABASE USAGE & RECORD COUNT DIAGNOSTIC");
  console.log("🔍 ============================================================");
  console.log(`📡 URL: ${supabaseUrl}\n`);

  const tables = ['presentations', 'slides', 'slide_options', 'sessions', 'participants', 'responses'];
  const counts = {};

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Error querying table '${table}':`, error.message);
      counts[table] = 'Error: ' + error.message;
    } else {
      counts[table] = count;
    }
  }

  console.log("📊 RECORD COUNTS BY TABLE:");
  console.table(counts);

  // Check Supabase Free Tier Limits comparison
  // Free tier has 500 MB database space and 50,000 monthly active users / millions of rows limit.
  const totalRows = Object.values(counts).reduce((acc, curr) => typeof curr === 'number' ? acc + curr : acc, 0);

  console.log(`\n Total DB Rows in Workspace: ${totalRows.toLocaleString()} rows`);

  if (totalRows > 1000) {
    console.log("ℹ️ Note: Old test sessions & participants from load tests are present.");
  } else {
    console.log("✅ Database usage is extremely low and healthy!");
  }

  process.exit(0);
}

checkDatabaseStats();
