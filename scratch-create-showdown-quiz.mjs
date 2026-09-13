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

async function createShowdown() {
  console.log("Creating 200-Player Arena Showdown presentation...");
  const { data: pres, error: presErr } = await supabase.from('presentations').insert([{
    title: '⚡ 200-Player Arena Showdown',
    description: 'Built-in 200 bot player simulation mode for live demonstrations',
    theme: 'parchment',
  }]).select().single();

  if (presErr || !pres) {
    console.error("Failed to create presentation:", presErr);
    process.exit(1);
  }

  // Slide 1
  const { data: s1 } = await supabase.from('slides').insert([{
    presentation_id: pres.id,
    order_index: 0,
    type: 'mcq',
    question: 'Which player has scored the most UEFA Champions League goals of all time?',
    description: 'UCL All-Time Top Scorer',
    time_limit: 20,
    preview_time: 5,
  }]).select().single();

  if (s1) {
    await supabase.from('slide_options').insert([
      { slide_id: s1.id, order_index: 0, text: 'Lionel Messi (129 goals)', is_correct: false },
      { slide_id: s1.id, order_index: 1, text: 'Cristiano Ronaldo (140 goals)', is_correct: true },
      { slide_id: s1.id, order_index: 2, text: 'Robert Lewandowski', is_correct: false },
      { slide_id: s1.id, order_index: 3, text: 'Karim Benzema', is_correct: false },
    ]);
  }

  // Slide 2
  const { data: s2 } = await supabase.from('slides').insert([{
    presentation_id: pres.id,
    order_index: 1,
    type: 'mcq',
    question: 'Which country won the FIFA World Cup 2022 in Qatar?',
    description: 'World Champions',
    time_limit: 20,
    preview_time: 5,
  }]).select().single();

  if (s2) {
    await supabase.from('slide_options').insert([
      { slide_id: s2.id, order_index: 0, text: 'France 🇫🇷', is_correct: false },
      { slide_id: s2.id, order_index: 1, text: 'Argentina 🇦🇷', is_correct: true },
      { slide_id: s2.id, order_index: 2, text: 'Croatia 🇭🇷', is_correct: false },
      { slide_id: s2.id, order_index: 3, text: 'Morocco 🇲🇦', is_correct: false },
    ]);
  }

  console.log("✅ Created '⚡ 200-Player Arena Showdown' presentation ID:", pres.id);
  process.exit(0);
}

createShowdown();
