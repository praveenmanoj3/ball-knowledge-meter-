import { supabase } from './supabase';
import { Presentation, Slide, SlideOption, Session, Participant, ResponseRecord } from './types';

// Helper to generate a clean 5-character session code (excluding ambiguous chars 0, O, 1, I, S, 5)
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// -------------------------------------------------------------
// STORAGE — Slide Media Upload
// -------------------------------------------------------------
const BUCKET = 'slide-media';

/**
 * Ensures the public 'slide-media' bucket exists (idempotent).
 * Call once on editor mount.
 */
export async function ensureStorageBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

/**
 * Upload a media file for a slide.
 * Returns the public URL, or null on error.
 */
export async function uploadSlideMedia(
  presentationId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${presentationId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error('Storage upload error:', error);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// -------------------------------------------------------------
// PRESENTATIONS
// -------------------------------------------------------------
export async function getPresentations(): Promise<Presentation[]> {
  const { data, error } = await supabase
    .from('presentations')
    .select(`
      *,
      slides (id)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching presentations:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    ...p,
    slides_count: p.slides ? p.slides.length : 0,
  }));
}

export async function getPresentation(id: string): Promise<{ presentation: Presentation; slides: Slide[] } | null> {
  const { data: presentation, error: presError } = await supabase
    .from('presentations')
    .select('*')
    .eq('id', id)
    .single();

  if (presError || !presentation) {
    console.error('Error fetching presentation:', presError);
    return null;
  }

  const { data: slides, error: slidesError } = await supabase
    .from('slides')
    .select(`
      *,
      slide_options (*)
    `)
    .eq('presentation_id', id)
    .order('order_index', { ascending: true });

  if (slidesError) {
    console.error('Error fetching slides:', slidesError);
    return { presentation, slides: [] };
  }

  const formattedSlides: Slide[] = (slides || []).map((s: any) => ({
    ...s,
    options: (s.slide_options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return { presentation, slides: formattedSlides };
}

export async function createPresentation(title: string, description: string = ''): Promise<string | null> {
  const { data, error } = await supabase
    .from('presentations')
    .insert([{ title, description }])
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating presentation:', error);
    return null;
  }

  // Create initial slide with options
  const { data: slideData, error: slideError } = await supabase
    .from('slides')
    .insert([{
      presentation_id: data.id,
      order_index: 0,
      type: 'mcq',
      question: 'Who holds the record for the most Ballon d\'Or awards?',
      description: 'Choose the correct legend',
      time_limit: 20,
      preview_time: 5,
      points_multiplier: 1,
    }])
    .select()
    .single();

  if (slideData) {
    await supabase.from('slide_options').insert([
      { slide_id: slideData.id, order_index: 0, text: 'Cristiano Ronaldo', is_correct: false },
      { slide_id: slideData.id, order_index: 1, text: 'Lionel Messi', is_correct: true },
      { slide_id: slideData.id, order_index: 2, text: 'Johan Cruyff', is_correct: false },
      { slide_id: slideData.id, order_index: 3, text: 'Michel Platini', is_correct: false },
    ]);
  }

  return data.id;
}

export async function updatePresentationDetails(id: string, updates: { title?: string; description?: string }) {
  const { error } = await supabase
    .from('presentations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('Error updating presentation:', error);
}

export async function deletePresentation(id: string) {
  const { error } = await supabase.from('presentations').delete().eq('id', id);
  if (error) console.error('Error deleting presentation:', error);
}

// -------------------------------------------------------------
// SLIDES & OPTIONS SAVING
// -------------------------------------------------------------
export async function savePresentationSlides(presentationId: string, slides: Slide[]) {
  if (!presentationId || presentationId === 'new') {
    throw new Error('Cannot save slides: presentation ID is not set yet.');
  }

  // Delete existing slides for this presentation (cascade deletes options too)
  const { error: deleteErr } = await supabase
    .from('slides')
    .delete()
    .eq('presentation_id', presentationId);

  if (deleteErr) {
    console.error('Failed to clear old slides:', deleteErr);
    throw new Error(`Failed to clear old slides: ${deleteErr.message}`);
  }

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];

    const slidePayload: Record<string, unknown> = {
      presentation_id: presentationId,
      order_index: i,
      type: s.type || 'mcq',
      question: s.question || '',
      description: s.description || '',
      media_url: s.media_url || '',
      media_type: s.media_type || 'none',
      time_limit: s.time_limit || 20,
      preview_time: s.preview_time !== undefined ? s.preview_time : 5,
      points_multiplier: s.points_multiplier || 1,
    };

    let insertedSlide: any = null;
    let sErr: any = null;

    // First attempt: with preview_time
    ({ data: insertedSlide, error: sErr } = await supabase
      .from('slides')
      .insert([slidePayload])
      .select()
      .single());

    // If schema cache doesn't know preview_time yet (PGRST204), retry without it
    if (sErr?.code === 'PGRST204' && sErr?.message?.includes('preview_time')) {
      console.warn('preview_time not in schema cache yet — retrying without it (will use DB default of 5)');
      const { preview_time: _dropped, ...payloadWithout } = slidePayload;
      ({ data: insertedSlide, error: sErr } = await supabase
        .from('slides')
        .insert([payloadWithout])
        .select()
        .single());
    }

    if (sErr || !insertedSlide) {
      console.error(`Failed to insert slide ${i + 1}:`, sErr);
      throw new Error(`Failed to save slide ${i + 1}: ${sErr?.message || 'No data returned'}`);
    }

    if (s.options && s.options.length > 0) {
      const optionsToInsert = s.options.map((opt, optIndex) => ({
        slide_id: insertedSlide.id,
        order_index: optIndex,
        text: opt.text || '',
        is_correct: opt.is_correct || false,
      }));

      const { error: optErr } = await supabase
        .from('slide_options')
        .insert(optionsToInsert);

      if (optErr) {
        console.error(`Failed to insert options for slide ${i + 1}:`, optErr);
        throw new Error(`Failed to save options for slide ${i + 1}: ${optErr.message}`);
      }
    }
  }
}

// -------------------------------------------------------------
// SESSIONS (HOST & GAME MANAGEMENT)
// -------------------------------------------------------------
export async function createSession(presentationId: string): Promise<Session | null> {
  const sessionCode = generateSessionCode();

  // Fetch presentation slides first
  const { data: slides } = await supabase
    .from('slides')
    .select('id')
    .eq('presentation_id', presentationId)
    .order('order_index', { ascending: true });

  const firstSlideId = slides && slides.length > 0 ? slides[0].id : null;

  const { data, error } = await supabase
    .from('sessions')
    .insert([{
      presentation_id: presentationId,
      session_code: sessionCode,
      status: 'lobby',
      current_slide_id: firstSlideId,
      current_slide_index: 0,
      phase_started_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    return null;
  }

  return data;
}

export async function getSession(sessionId: string): Promise<{ session: Session; slides: Slide[]; participants: Participant[] } | null> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, presentation:presentations(*)')
    .eq('id', sessionId)
    .single();

  if (error || !session) return null;

  const { data: slides } = await supabase
    .from('slides')
    .select('*, slide_options(*)')
    .eq('presentation_id', session.presentation_id)
    .order('order_index', { ascending: true });

  const formattedSlides: Slide[] = (slides || []).map((s: any) => ({
    ...s,
    options: (s.slide_options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('score', { ascending: false });

  return {
    session,
    slides: formattedSlides,
    participants: participants || [],
  };
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, presentation:presentations(*)')
    .eq('session_code', code.toUpperCase().trim())
    .single();

  if (error || !data) return null;
  return data;
}

export async function updateSessionState(sessionId: string, updates: Partial<Session>) {
  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) console.error('Error updating session:', error);
  return data;
}

// -------------------------------------------------------------
// PARTICIPANTS & RESPONSES
// -------------------------------------------------------------
export async function joinSession(sessionId: string, nickname: string, avatar: string = '⚽'): Promise<Participant | null> {
  const { data, error } = await supabase
    .from('participants')
    .insert([{
      session_id: sessionId,
      nickname,
      avatar,
      score: 0,
    }])
    .select()
    .single();

  if (error) {
    // If nickname collision in same session, append random digit
    if (error.code === '23505') {
      const fallbackNickname = `${nickname}${Math.floor(Math.random() * 90 + 10)}`;
      const { data: retryData } = await supabase
        .from('participants')
        .insert([{
          session_id: sessionId,
          nickname: fallbackNickname,
          avatar,
          score: 0,
        }])
        .select()
        .single();
      return retryData;
    }
    console.error('Error joining session:', error);
    return null;
  }

  return data;
}

export async function submitParticipantResponse(
  sessionId: string,
  slideId: string,
  participantId: string,
  optionId: string,
  isCorrect: boolean,
  responseTimeMs: number,
  pointsAwarded: number
): Promise<boolean> {
  const { error } = await supabase
    .from('responses')
    .insert([{
      session_id: sessionId,
      slide_id: slideId,
      participant_id: participantId,
      selected_option_id: optionId,
      is_correct: isCorrect,
      response_time_ms: responseTimeMs,
      points_awarded: pointsAwarded,
    }]);

  if (error) {
    console.error('Error submitting response:', error);
    return false;
  }

  // Update participant total score if points awarded
  if (pointsAwarded > 0) {
    const { data: participant } = await supabase
      .from('participants')
      .select('score')
      .eq('id', participantId)
      .single();

    const currentScore = participant?.score || 0;
    await supabase
      .from('participants')
      .update({ score: currentScore + pointsAwarded })
      .eq('id', participantId);
  }

  return true;
}

export async function getSlideResponses(sessionId: string, slideId: string): Promise<ResponseRecord[]> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('slide_id', slideId);

  if (error) {
    console.error('Error fetching responses:', error);
    return [];
  }

  return data || [];
}

export async function getSessionParticipants(sessionId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('score', { ascending: false });

  if (error) {
    console.error('Error fetching participants:', error);
    return [];
  }

  return data || [];
}

// -------------------------------------------------------------
// SAMPLE DATA SEEDER (Runs automatically if DB has 0 presentations)
// -------------------------------------------------------------
export async function seedSampleQuizIfEmpty() {
  const { count } = await supabase.from('presentations').select('*', { count: 'exact', head: true });
  if (count && count > 0) return;

  const { data: pres } = await supabase
    .from('presentations')
    .insert([{
      title: 'Ultimate Champions League & Football Quiz',
      description: 'Test your tactical and football history knowledge with 200 players!',
      theme: 'parchment',
    }])
    .select()
    .single();

  if (!pres) return;

  // Slide 1
  const { data: s1 } = await supabase.from('slides').insert([{
    presentation_id: pres.id,
    order_index: 0,
    type: 'mcq',
    question: 'Which club has won the most UEFA Champions League titles in history?',
    description: 'European Royalty',
    time_limit: 20,
    points_multiplier: 1,
  }]).select().single();

  if (s1) {
    await supabase.from('slide_options').insert([
      { slide_id: s1.id, order_index: 0, text: 'AC Milan', is_correct: false },
      { slide_id: s1.id, order_index: 1, text: 'Real Madrid (15 titles)', is_correct: true },
      { slide_id: s1.id, order_index: 2, text: 'Bayern Munich', is_correct: false },
      { slide_id: s1.id, order_index: 3, text: 'Liverpool FC', is_correct: false },
    ]);
  }

  // Slide 2
  const { data: s2 } = await supabase.from('slides').insert([{
    presentation_id: pres.id,
    order_index: 1,
    type: 'mcq',
    question: 'Who is the all-time top goalscorer in Men\'s international football history?',
    description: 'Goalscoring Record',
    time_limit: 20,
    points_multiplier: 1,
  }]).select().single();

  if (s2) {
    await supabase.from('slide_options').insert([
      { slide_id: s2.id, order_index: 0, text: 'Cristiano Ronaldo', is_correct: true },
      { slide_id: s2.id, order_index: 1, text: 'Ali Daei', is_correct: false },
      { slide_id: s2.id, order_index: 2, text: 'Lionel Messi', is_correct: false },
      { slide_id: s2.id, order_index: 3, text: 'Pelé', is_correct: false },
    ]);
  }

  // Slide 3
  const { data: s3 } = await supabase.from('slides').insert([{
    presentation_id: pres.id,
    order_index: 2,
    type: 'mcq',
    question: 'Which country won the 2010 FIFA World Cup in South Africa?',
    description: 'Tiki-Taka Era',
    time_limit: 20,
    points_multiplier: 1,
  }]).select().single();

  if (s3) {
    await supabase.from('slide_options').insert([
      { slide_id: s3.id, order_index: 0, text: 'Netherlands', is_correct: false },
      { slide_id: s3.id, order_index: 1, text: 'Germany', is_correct: false },
      { slide_id: s3.id, order_index: 2, text: 'Spain (Iniesta 116\')', is_correct: true },
      { slide_id: s3.id, order_index: 3, text: 'Brazil', is_correct: false },
    ]);
  }
}
