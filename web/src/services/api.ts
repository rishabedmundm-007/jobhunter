import { Job, JobCreateInput, JobUpdateInput } from '../types';

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
};
