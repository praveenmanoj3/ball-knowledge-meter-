export interface Presentation {
  id: string;
  user_id?: string | null;
  title: string;
  description: string;
  theme: string;
  created_at: string;
  updated_at: string;
  slides_count?: number;
}

export interface SlideOption {
  id: string;
  slide_id?: string;
  order_index: number;
  text: string;
  is_correct: boolean;
}

export interface Slide {
  id: string;
  presentation_id: string;
  order_index: number;
  type: 'mcq' | 'info' | 'leaderboard' | 'poll';
  question: string;
  description: string;
  media_url: string;
  media_type: 'image' | 'video' | 'gif' | 'none';
  time_limit: number;
  preview_time?: number; // seconds to show question/media before options appear
  points_multiplier: number;
  options: SlideOption[];
}

export interface Session {
  id: string;
  presentation_id: string;
  host_id?: string | null;
  session_code: string;
  status: 'lobby' | 'preview' | 'live' | 'reveal' | 'leaderboard' | 'ended';
  current_slide_id?: string | null;
  current_slide_index: number;
  phase_started_at: string;
  created_at: string;
  ended_at?: string | null;
  presentation?: Presentation;
  slides?: Slide[];
}

export interface Participant {
  id: string;
  session_id: string;
  nickname: string;
  avatar: string;
  score: number;
  joined_at: string;
}

export interface ResponseRecord {
  id: string;
  session_id: string;
  slide_id: string;
  participant_id: string;
  selected_option_id: string;
  is_correct: boolean;
  response_time_ms: number;
  points_awarded: number;
  submitted_at: string;
}
