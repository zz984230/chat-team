// src/types.ts

export type SessionStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type SessionMode = 'default' | 'brainstorm';
export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Phase {
  id: number;
  name: string;
  agents: string[];
  status: PhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  outputs: string[];
}

export interface Session {
  id: string;
  status: SessionStatus;
  mode: SessionMode;
  created_at: string;
  updated_at: string;
  input_requirement: string;
  phases: Phase[];
}

export interface CreateSessionRequest {
  requirement: string;
  mode: SessionMode;
  room: string;
  agents?: string[] | null;
  config?: { rounds: number };
}

export interface AgentDefinition {
  name: string;
  id: string;
  model: string;
  max_turns: number;
  system_prompt: string;
  output_file: string | null;
  output_template: string | null;
}

// WebSocket event types
export type WsEventType =
  | 'session:started'
  | 'session:completed'
  | 'session:failed'
  | 'session:paused'
  | 'session:cancelled'
  | 'phase:started'
  | 'phase:completed'
  | 'phase:failed'
  | 'agent:thinking'
  | 'agent:working'
  | 'agent:output'
  | 'agent:completed'
  | 'agent:failed';

export interface WsEvent {
  type: WsEventType;
  session_id?: string;
  phase?: number;
  agent_id?: string;
  content?: string;
  tool?: string;
  file?: string;
  error?: string;
  outputs?: string[];
  duration_ms?: number;
}

// Agent visual state
export type AgentAnimationState = 'idle' | 'walking' | 'working' | 'thinking';

export type AgentDirection = 'down' | 'up' | 'left' | 'right';
