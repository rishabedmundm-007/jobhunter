import { ContactInfo, Job, JobCreateInput, JobUpdateInput, Preferences, Profile, Resume } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
});

export const jobsApi = {
  async createJob(input: JobCreateInput): Promise<Job> {
    const res = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create job');
    }
    return res.json();
  },

  async getJobs(state?: string, limit = 50): Promise<Job[]> {
    const query = new URLSearchParams({ limit: limit.toString() });
    if (state) query.append('state', state);
    const res = await fetch(`${API_URL}/jobs?${query}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to fetch jobs');
    return res.json();
  },

  async updateJob(id: string, input: JobUpdateInput): Promise<Job> {
    const res = await fetch(`${API_URL}/jobs/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update job');
    return res.json();
  },

  async deleteJob(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/jobs/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to delete job');
  },

  async tailorJob(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/jobs/${id}/tailor`, {
      method: 'POST',
      headers: headers(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start tailoring');
    }
  },
};

export const profileApi = {
  async getProfile(): Promise<Profile> {
    const res = await fetch(`${API_URL}/profile`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  },

  async uploadResume(file: File): Promise<{ resume: Resume }> {
    const urlRes = await fetch(`${API_URL}/profile/resume-upload-url`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
    });
    if (!urlRes.ok) {
      const err = await urlRes.json();
      throw new Error(err.error || 'Failed to prepare upload');
    }
    const { upload_url, key } = await urlRes.json();

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error('Failed to upload file');

    const confirmRes = await fetch(`${API_URL}/profile/resume`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ key, filename: file.name, size: file.size }),
    });
    if (!confirmRes.ok) throw new Error('Failed to confirm upload');
    return confirmRes.json();
  },

  async savePreferences(input: ContactInfo & Preferences): Promise<{ contact: ContactInfo; preferences: Preferences }> {
    const res = await fetch(`${API_URL}/profile/preferences`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save preferences');
    }
    return res.json();
  },

  async uploadAvatar(file: File): Promise<{ contact: ContactInfo }> {
    const urlRes = await fetch(`${API_URL}/profile/avatar-upload-url`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
    });
    if (!urlRes.ok) {
      const err = await urlRes.json();
      throw new Error(err.error || 'Failed to prepare upload');
    }
    const { upload_url, key } = await urlRes.json();

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error('Failed to upload photo');

    const confirmRes = await fetch(`${API_URL}/profile/avatar`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ key }),
    });
    if (!confirmRes.ok) throw new Error('Failed to confirm photo upload');
    return confirmRes.json();
  },
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const pipelineApi = {
  async runNow(): Promise<void> {
    const res = await fetch(`${API_URL}/pipeline/run`, {
      method: 'POST',
      headers: headers(),
    });
    if (res.status === 429) {
      const err = await res.json();
      throw new RateLimitError(err.error || 'Rate limited', err.retry_after_seconds ?? 3600);
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start search');
    }
  },
};
