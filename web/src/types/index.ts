export type JobState = 
  | "DISCOVERED" 
  | "SHORTLISTED" 
  | "FILTERED_OUT" 
  | "RESUME_READY" 
  | "APPLIED" 
  | "SKIPPED" 
  | "IN_PROGRESS" 
  | "DECISION";

export interface Job {
  id: string;
  title: string;
  company: string;
  link?: string;
  state: JobState;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_sub: string;
}

export interface JobCreateInput {
  title: string;
  company: string;
  link?: string;
  state?: JobState;
}

export interface JobUpdateInput {
  state?: JobState;
  title?: string;
  company?: string;
  notes?: string;
}
