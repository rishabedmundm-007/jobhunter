export type JobState =
  | "DISCOVERED"
  | "SHORTLISTED"
  | "FILTERED_OUT"
  | "RESUME_READY"
  | "APPLIED"
  | "SKIPPED"
  | "IN_PROGRESS"
  | "DECISION";

export type JobSource = "adzuna" | "usajobs" | "remotive" | "linkedin" | "indeed" | "manual";

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
  description?: string;
  location?: string;
  source?: JobSource;
  score?: number;
  reasons?: string[];
  tailored_resume_key?: string;
  tailored_at?: string;
  resume_url?: string;
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

export interface Resume {
  key: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

export interface Preferences {
  job_roles: string[];
  experience_level: string;
  employment_types: string[];
  work_modes: string[];
  preferred_location: string;
  sponsorship_status: string;
}

export interface ContactInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
}

export interface PipelineRun {
  sources_run: string[];
  ingested_count: number;
  shortlisted_count: number;
  filtered_out_count: number;
  tailored_count: number;
  errors: string[];
  run_at: string;
}

export interface Profile {
  resume: Resume | null;
  contact: ContactInfo | null;
  preferences: Preferences | null;
  latest_run?: PipelineRun | null;
}

export type IntegrationProvider = "linkedin" | "indeed";

export interface IntegrationStatus {
  connected: boolean;
  status: string | null;
}
