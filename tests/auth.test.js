import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';

const sendEmailMock = jest.fn();

jest.unstable_mockModule('../utils/sendEmail.js', () => ({
  sendEmail: sendEmailMock
}));

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');

describe('Auth API', () => {
  const createAuthToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createUser = async (overrides = {}) => {
    return await User.create({
      email: overrides.email || 'user@example.com',
      password: overrides.password || 'password123',
      role: overrides.role || 'STUDENT',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });
  };

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user and return token', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'new.student@example.com',
        password: 'password123',
        role: 'STUDENT'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.data).toMatchObject({
        email: 'new.student@example.com',
        role: 'STUDENT'
      });
      expect(res.body.data.token).toEqual(expect.any(String));

      const saved = await User.findOne({ email: 'new.student@example.com' });
      expect(saved).toBeTruthy();
      expect(saved.password).not.toBe('password123');
    });

    test('should fail when role is lowercase', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'role.map@example.com',
        password: 'password123',
        role: 'student'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid input data');
    });

    test('should fail when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'missing.fields@example.com'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('email, password and role are required');
    });

    test('should fail when user already exists', async () => {
      await createUser({ email: 'duplicate@example.com' });

      const res = await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'STUDENT'
      });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User already exists');
    });

    test('should fail when password is shorter than minimum length', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'short.pass@example.com',
        password: '12345',
        role: 'STUDENT'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid input data');
    });

    test('should fail when role is invalid', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'bad.role@example.com',
        password: 'password123',
        role: 'HACKER'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid input data');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      await createUser({
        email: 'login.ok@example.com',
        password: 'password123',
        role: 'FACULTY'
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login.ok@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data.email).toBe('login.ok@example.com');
      expect(res.body.data.role).toBe('FACULTY');
      expect(res.body.data.token).toEqual(expect.any(String));

      const updated = await User.findOne({ email: 'login.ok@example.com' });
      expect(updated.lastLogin).toBeTruthy();
    });

    test('should fail when email or password is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'only.email@example.com'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email and password required');
    });

    test('should fail when user does not exist', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'unknown@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    test('should fail when password is wrong', async () => {
      await createUser({
        email: 'wrong.pass@example.com',
        password: 'password123'
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'wrong.pass@example.com',
        password: 'not-the-password'
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    test('should fail when account is inactive', async () => {
      await createUser({
        email: 'inactive.user@example.com',
        password: 'password123',
        isActive: false
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'inactive.user@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Account is inactive');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should fail when email is missing', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email is required');
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    test('should return generic success for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'If the email exists, a reset link has been sent'
      );
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    test('should generate reset token and send email for existing user', async () => {
      const user = await createUser({ email: 'forgot.ok@example.com' });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot.ok@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendEmailMock).toHaveBeenCalledTimes(1);

      const mailPayload = sendEmailMock.mock.calls[0][0];
      expect(mailPayload.to).toBe('forgot.ok@example.com');
      expect(mailPayload.subject).toBe('Password Reset');
      expect(mailPayload.html).toContain('/reset-password/');

      const updated = await User.findById(user._id).select(
        '+resetPasswordToken +resetPasswordExpire'
      );
      expect(updated.resetPasswordToken).toBeTruthy();
      expect(updated.resetPasswordExpire).toBeTruthy();
      expect(updated.resetPasswordExpire.getTime()).toBeGreaterThan(Date.now());
    });

    test('should clear reset token fields when email sending fails', async () => {
      const user = await createUser({ email: 'forgot.fail@example.com' });
      sendEmailMock.mockRejectedValue(new Error('SMTP down'));

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot.fail@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Email could not be sent');

      const updated = await User.findById(user._id).select(
        '+resetPasswordToken +resetPasswordExpire'
      );
      expect(updated.resetPasswordToken).toBeUndefined();
      expect(updated.resetPasswordExpire).toBeUndefined();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    test('should fail when token or newPassword is missing', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'abc'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Token and newPassword required');
    });

    test('should fail for invalid reset token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'invalid-token',
        newPassword: 'newPassword123'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    test('should fail for expired reset token', async () => {
      const user = await createUser({ email: 'expired.token@example.com' });
      const rawToken = 'deadbeef';
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      await User.findByIdAndUpdate(user._id, {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: new Date(Date.now() - 60 * 1000)
      });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawToken,
        newPassword: 'newPassword123'
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    test('should reset password successfully with valid token', async () => {
      await createUser({
        email: 'reset.ok@example.com',
        password: 'oldPassword123'
      });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset.ok@example.com' });

      const html = sendEmailMock.mock.calls[0][0].html;
      const tokenMatch = html.match(/reset-password\/([a-f0-9]+)/i);
      const rawToken = tokenMatch?.[1];

      expect(rawToken).toBeTruthy();

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'newPassword123'
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toBe('Password reset successful');

      const updated = await User.findOne({
        email: 'reset.ok@example.com'
      }).select('+resetPasswordToken +resetPasswordExpire');
      expect(updated.resetPasswordToken).toBeUndefined();
      expect(updated.resetPasswordExpire).toBeUndefined();

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'reset.ok@example.com',
        password: 'newPassword123'
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should fail when token is missing', async () => {
      const res = await request(app).post('/api/auth/change-password').send({
        currentPassword: 'password123',
        newPassword: 'newPassword123'
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail when token is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token invalid');
    });

    test('should fail when token belongs to inactive user', async () => {
      const user = await createUser({
        email: 'inactive.change@example.com',
        password: 'password123',
        isActive: false
      });
      const token = createAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('User not found or inactive');
    });

    test('should fail when required fields are missing', async () => {
      const user = await createUser({
        email: 'change.missing.fields@example.com',
        password: 'password123'
      });
      const token = createAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('currentPassword and newPassword required');
    });

    test('should fail when current password is incorrect', async () => {
      const user = await createUser({
        email: 'change.wrong.current@example.com',
        password: 'password123'
      });
      const token = createAuthToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongPassword123',
          newPassword: 'newPassword123'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Current password incorrect');
    });

    test('should change password successfully and allow login with new password', async () => {
      const user = await createUser({
        email: 'change.ok@example.com',
        password: 'password123'
      });
      const token = createAuthToken(user);

      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123'
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.message).toBe('Password changed successfully');

      const oldLoginRes = await request(app).post('/api/auth/login').send({
        email: 'change.ok@example.com',
        password: 'password123'
      });
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await request(app).post('/api/auth/login').send({
        email: 'change.ok@example.com',
        password: 'newPassword123'
      });
      expect(newLoginRes.status).toBe(200);
    });
  });
});
