const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const COGNITO_DOMAIN: string = import.meta.env.VITE_COGNITO_DOMAIN || '';
// The hosted-UI domain embeds the region ("<prefix>.auth.<region>.amazoncognito.com"),
// so it doubles as the source of truth for which regional IdP endpoint to call.
const REGION = COGNITO_DOMAIN.split('.')[2] || 'us-east-1';
const IDP_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

interface CognitoAuthResult {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
}

async function cognitoRequest(target: string, body: object): Promise<any> {
  const res = await fetch(IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const type = (data.__type || 'Error').split('#').pop();
    const err = new Error(data.message || type);
    err.name = type;
    throw err;
  }
  return data;
}

export const signIn = async (email: string, password: string): Promise<CognitoAuthResult> => {
  const data = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  if (!data.AuthenticationResult) {
    throw new Error(`Unsupported sign-in step: ${data.ChallengeName || 'unknown'}`);
  }
  return data.AuthenticationResult;
};

export const signUp = async (email: string, password: string): Promise<void> => {
  await cognitoRequest('SignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  });
};

export const confirmSignUp = async (email: string, code: string): Promise<void> => {
  await cognitoRequest('ConfirmSignUp', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
};

export const resendConfirmationCode = async (email: string): Promise<void> => {
  await cognitoRequest('ResendConfirmationCode', {
    ClientId: CLIENT_ID,
    Username: email,
  });
};

export const forgotPassword = async (email: string): Promise<void> => {
  await cognitoRequest('ForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
  });
};

export const confirmForgotPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
  await cognitoRequest('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  });
};

export const saveTokens = (tokens: CognitoAuthResult) => {
  localStorage.setItem('id_token', tokens.IdToken);
  localStorage.setItem('access_token', tokens.AccessToken);
  localStorage.setItem('refresh_token', tokens.RefreshToken || '');
};

export const getAccessToken = () => localStorage.getItem('access_token');

export const clearTokens = () => {
  localStorage.removeItem('id_token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const isAuthenticated = () => !!getAccessToken();

export const decodeToken = (token: string) => {
  // JWTs are base64url (uses "-"/"_" instead of "+"/"/"), which atob() rejects
  // outright — and the old padding formula added 4 bogus "=" when the segment
  // was already a multiple of 4 long, corrupting an otherwise-valid payload.
  // Both bugs only surface for certain token contents, which is why this only
  // broke sign-in for some users/sessions rather than consistently.
  const payload = token.split('.')[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
