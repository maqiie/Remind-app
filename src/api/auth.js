import client, { saveAuthTokens, clearAuthTokens } from './client';

// REGISTER — creates account then sends OTP
export const register = async ({ name, email, password, passwordConfirmation, birthday }) => {
  const response = await client.post('/auth', {
    user: {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      birthday,
    },
  });
  return response.data;
};

// LOGIN — verifies credentials and triggers OTP send
export const login = async ({ email, password }) => {
  const response = await client.post('/auth/sign_in', { email, password });
  return response.data;
};

// LOGOUT
export const logout = async () => {
  try {
    await client.delete('/auth/sign_out');
  } finally {
    await clearAuthTokens();
  }
};

// VALIDATE TOKEN — check if stored tokens are still valid
export const validateToken = async () => {
  const response = await client.get('/auth/validate_token');
  return response.data;
};

// UPDATE PROFILE
export const updateProfile = async (params) => {
  const response = await client.put('/auth', { user: params });
  return response.data;
};

// FORGOT PASSWORD
export const requestPasswordReset = async ({ email }) => {
  const response = await client.post('/auth/password', {
    email,
    redirect_url: 'remindapp://reset-password',
  });
  return response.data;
};

// SEND OTP
export const sendOtp = async ({ email }) => {
  const response = await client.post('/auth/send_otp', { email });
  return response.data;
};

// VERIFY OTP — returns tokens on success
export const verifyOtp = async ({ email, otp }) => {
  const response = await client.post('/auth/verify_otp', { email, otp });

  // Save tokens from both headers and response body
  if (response.data?.tokens) {
    await saveAuthTokens(response.data.tokens, response.data.data);
  } else {
    await saveAuthTokens(response.headers, response.data.data);
  }

  return response.data;
};

// RESEND OTP
export const resendOtp = async ({ email }) => {
  const response = await client.post('/auth/resend_otp', { email });
  return response.data;
};