import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read credentials from .env.local if present
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
  } catch (e) {
    // Ignore
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionCodeArg = process.argv[2];

async function runLoadTest() {
  console.log("⚡ ============================================================");
  console.log("⚡ BALLKNOWLEDGEMETER — 200-PLAYER SIMULATION & LOAD TEST");
  console.log("⚡ ============================================================");
  console.log(`📡 Connecting to Supabase: ${supabaseUrl}`);

  let sessionCode = sessionCodeArg;
  let session = null;

  if (sessionCode) {
    console.log(`🔍 Looking up session with PIN code: ${sessionCode}...`);
    const { data, error } = await supabase
      .from('sessions')
      .select('*, slides(*, slide_options(*))')
      .eq('session_code', sessionCode.toUpperCase().trim())
      .single();

    if (error || !data) {
      console.error(`❌ Session with code '${sessionCode}' not found.`);
      process.exit(1);
    }
    session = data;
  } else {
    console.log("🆕 No session code provided. Creating a test presentation & session...");
    const { data: pres } = await supabase.from('presentations').insert([{ title: 'Load Test 200 Arena' }]).select().single();
    const { data: slide } = await supabase.from('slides').insert([{ presentation_id: pres.id, question: 'Load Test Question', time_limit: 20 }]).select().single();
    const { data: options } = await supabase.from('slide_options').insert([
      { slide_id: slide.id, order_index: 0, text: 'Opt A', is_correct: false },
      { slide_id: slide.id, order_index: 1, text: 'Opt B', is_correct: true },
    ]).select();

    const code = 'TEST' + Math.floor(Math.random() * 89 + 10);
    const { data: newSession } = await supabase.from('sessions').insert([{
      presentation_id: pres.id,
      session_code: code,
      status: 'live',
      current_slide_id: slide.id,
      current_slide_index: 0,
      phase_started_at: new Date().toISOString(),
    }]).select('*, slides(*)').single();

    session = { ...newSession, slides: [{ ...slide, slide_options: options }] };
    sessionCode = code;
    console.log(`✅ Test Session Created! PIN Code: [ ${sessionCode} ]`);
  }

  const sessionId = session.id;
  const slide = session.slides?.[0];
  const slideId = slide?.id;
  const options = slide?.slide_options || [];

  console.log(`\n👥 1. SIMULATING 200 PARTICIPANTS JOINING SESSION...`);
  const avatars = ['⚽', '🔥', '🦁', '⚡', '🏆', '🎯', '🚀', '👑'];
  const startJoinTime = Date.now();

  const NUM_PLAYERS = 200;
  const participants = [];

  // Batch insert 200 participants (batches of 50 for max throughput)
  const batchSize = 50;
  for (let i = 0; i < NUM_PLAYERS; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, NUM_PLAYERS - i) }, (_, idx) => {
      const pNum = i + idx + 1;
      return {
        session_id: sessionId,
        nickname: `Player_${pNum}_${Math.floor(Math.random() * 1000)}`,
        avatar: avatars[pNum % avatars.length],
        score: 0,
      };
    });

    const { data, error } = await supabase.from('participants').insert(batch).select();
    if (error) {
      console.error("Batch insert error:", error.message);
    } else if (data) {
      participants.push(...data);
    }
  }

  const joinDuration = Date.now() - startJoinTime;
  console.log(`✅ ${participants.length} / ${NUM_PLAYERS} Players joined successfully in ${joinDuration}ms (${Math.round((participants.length / (joinDuration / 1000)))} joins/sec)!`);

  // 2. Realtime listener validation
  console.log(`\n📡 2. TESTING REALTIME BROADCAST & SUBSCRIPTIONS...`);
  let receivedCount = 0;
  const channel = supabase.channel(`loadtest-${sessionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: `session_id=eq.${sessionId}` }, () => {
      receivedCount++;
    })
    .subscribe();

  await new Promise((r) => setTimeout(r, 1000));

  // 3. Simulating 200 simultaneous player responses
  console.log(`\n⚡ 3. SIMULATING 200 SIMULTANEOUS PLAYER RESPONSES...`);
  const startResponseTime = Date.now();

  const responsePromises = participants.map((player, idx) => {
    const isCorrect = idx % 2 === 0; // 50% correct
    const chosenOpt = options.find(o => o.is_correct === isCorrect) || options[0];
    const responseTimeMs = Math.floor(Math.random() * 4000) + 200; // 0.2s - 4.2s delay
    const speedRatio = Math.max(0, 1 - responseTimeMs / 20000);
    const points = isCorrect ? Math.round(1000 + speedRatio * 500) : 0;

    return supabase.from('responses').insert([{
      session_id: sessionId,
      slide_id: slideId,
      participant_id: player.id,
      selected_option_id: chosenOpt?.id || null,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
      points_awarded: points,
    }]);
  });

  const results = await Promise.all(responsePromises);
  const totalResponseTime = Date.now() - startResponseTime;

  const successCount = results.filter(r => !r.error).length;
  const failureCount = results.filter(r => r.error).length;

  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n📊 ============================================================");
  console.log("📊 LOAD TEST RESULTS & BENCHMARK");
  console.log("📊 ============================================================");
  console.log(`✅ Total Participants Joined:   ${participants.length} / 200`);
  console.log(`⏱️ Join Phase Duration:        ${joinDuration}ms`);
  console.log(`⚡ Successful Submissions:      ${successCount} / 200 (${Math.round((successCount/200)*100)}%)`);
  console.log(`❌ Failed Submissions:          ${failureCount}`);
  console.log(`🚀 Total Answer Phase Duration: ${totalResponseTime}ms`);
  console.log(`📈 Submission Throughput:       ${Math.round(200 / (totalResponseTime / 1000))} responses/sec`);
  console.log(`📡 Realtime Broadcast Received: ${receivedCount} updates`);
  console.log("============================================================\n");

  if (successCount >= 190) {
    console.log("🎉 SUCCESS: BallKnowledgeMeter cleanly sustained 200 concurrent players!");
  } else {
    console.log("⚠️ PARTIAL: Check database connection or RLS limits.");
  }

  supabase.removeChannel(channel);
  process.exit(0);
}

runLoadTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
