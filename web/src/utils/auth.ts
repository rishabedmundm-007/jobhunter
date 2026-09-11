const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : '';

export const getAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
  });
  return `https://${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code: string) => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) throw new Error('Token exchange failed');
  return response.json();
};

export const saveTokens = (tokens: any) => {
  localStorage.setItem('id_token', tokens.id_token);
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token || '');
};

export const getAccessToken = () => localStorage.getItem('access_token');

export const clearTokens = () => {
  localStorage.removeItem('id_token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const isAuthenticated = () => !!getAccessToken();

export const decodeToken = (token: string) => {
  const payload = token.split('.')[1];
  const padding = 4 - (payload.length % 4);
  const padded = payload + '='.repeat(padding);
  return JSON.parse(atob(padded));
};
