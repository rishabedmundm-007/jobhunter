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

export interface Profile {
  resume: Resume | null;
  contact: ContactInfo | null;
  preferences: Preferences | null;
}
