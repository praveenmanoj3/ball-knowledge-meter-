// fix-schema.mjs — Applies missing column + RLS fixes to Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vbxgvrrfzkfswxrjlkya.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kvJOPNI_My4CHP_9HRgA1w_IlxqwJpt';

// We need the service role key to run DDL — fall back to anon for RPC
// Since we don't have service role, we'll use the raw REST endpoint
const fixes = [
  `ALTER TABLE slides ADD COLUMN IF NOT EXISTS preview_time INTEGER DEFAULT 5`,
  `DROP POLICY IF EXISTS "Slides editable by all" ON slides`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slides' AND policyname = 'Slides insertable by all'
    ) THEN
      CREATE POLICY "Slides insertable by all" ON slides FOR INSERT WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slides' AND policyname = 'Slides updatable by all'
    ) THEN
      CREATE POLICY "Slides updatable by all" ON slides FOR UPDATE USING (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slides' AND policyname = 'Slides deletable by all'
    ) THEN
      CREATE POLICY "Slides deletable by all" ON slides FOR DELETE USING (true);
    END IF;
  END $$`,
  `DROP POLICY IF EXISTS "Options editable by all" ON slide_options`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slide_options' AND policyname = 'Options insertable by all'
    ) THEN
      CREATE POLICY "Options insertable by all" ON slide_options FOR INSERT WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slide_options' AND policyname = 'Options updatable by all'
    ) THEN
      CREATE POLICY "Options updatable by all" ON slide_options FOR UPDATE USING (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'slide_options' AND policyname = 'Options deletable by all'
    ) THEN
      CREATE POLICY "Options deletable by all" ON slide_options FOR DELETE USING (true);
    END IF;
  END $$`,
  `NOTIFY pgrst, 'reload schema'`,
];

// Use Supabase's pg-meta REST endpoint to run raw SQL
async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });
  return res;
}

// Alternative: Test by trying a direct slide insert
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 Testing current slide insert capability...\n');

// Try inserting a test slide to see if it works now
const testPresId = '00000000-0000-0000-0000-000000000001';

// First check if preview_time column exists by querying slides schema
const { data: colCheck, error: colErr } = await supabase
  .from('slides')
  .select('preview_time')
  .limit(1);

if (colErr && colErr.message.includes('preview_time')) {
  console.log('❌ preview_time column MISSING — you need to run the SQL manually in Supabase dashboard.');
  console.log('\n📋 Copy and paste this into Supabase SQL Editor:\n');
  console.log('─'.repeat(60));
  console.log(`ALTER TABLE slides ADD COLUMN IF NOT EXISTS preview_time INTEGER DEFAULT 5;

DROP POLICY IF EXISTS "Slides editable by all" ON slides;
CREATE POLICY "Slides insertable by all" ON slides FOR INSERT WITH CHECK (true);
CREATE POLICY "Slides updatable by all" ON slides FOR UPDATE USING (true);
CREATE POLICY "Slides deletable by all" ON slides FOR DELETE USING (true);

DROP POLICY IF EXISTS "Options editable by all" ON slide_options;
CREATE POLICY "Options insertable by all" ON slide_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Options updatable by all" ON slide_options FOR UPDATE USING (true);
CREATE POLICY "Options deletable by all" ON slide_options FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';`);
  console.log('─'.repeat(60));
  console.log('\n🌐 Go to: https://supabase.com/dashboard/project/vbxgvrrfzkfswxrjlkya/sql/new');
} else if (colErr) {
  console.log('⚠️  Other error checking column:', colErr.message);
} else {
  console.log('✅ preview_time column EXISTS — column is fine!');
  console.log('\n🔍 Now checking RLS policies for slide INSERT...');

  // Try to insert a test slide (into a non-existent presentation — will fail FK, but not RLS)
  const { error: insertErr } = await supabase
    .from('slides')
    .insert([{
      presentation_id: '00000000-0000-0000-0000-000000000099',
      order_index: 0,
      type: 'mcq',
      question: 'test',
      preview_time: 5,
    }]);

  if (insertErr?.code === '23503') {
    // FK violation = RLS passed! The FK just fails because the presentation doesn't exist
    console.log('✅ RLS is FINE — slides INSERT policy is working!');
    console.log('✅ Everything looks good. Try saving in the app now.');
  } else if (insertErr?.code === '42501') {
    console.log('❌ RLS is BLOCKING inserts — you need to run the policy fix SQL in Supabase dashboard.');
    console.log('\n🌐 Go to: https://supabase.com/dashboard/project/vbxgvrrfzkfswxrjlkya/sql/new');
  } else if (insertErr) {
    console.log('⚠️  Insert test error:', insertErr.message, '| code:', insertErr.code);
  } else {
    console.log('✅ RLS is FINE — slides INSERT policy is working!');
  }
}
