import { jest } from '@jest/globals';

jest.unstable_mockModule('../utils/sendEmail.js', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');

import request from 'supertest';
import crypto from 'crypto';

describe('Auth API', () => {
  describe('Register', () => {
    it('registers a user successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'student@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.role).toBe('STUDENT');
    });

    it('rejects duplicate email', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const res = await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('fails when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'missing@example.com'
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await User.create({
        email: 'login@example.com',
        password: '123456',
        role: 'STUDENT'
      });
    });

    it('logs in with valid credentials and updates lastLogin', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: '123456'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      const user = await User.findOne({ email: 'login@example.com' });
      expect(user.lastLogin).toBeTruthy();
    });

    it('fails for invalid credentials or inactive account', async () => {
      const wrongPass = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'wrong'
      });

      expect(wrongPass.statusCode).toBe(401);

      await User.updateOne({ email: 'login@example.com' }, { isActive: false });

      const inactive = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: '123456'
      });

      expect(inactive.statusCode).toBe(403);
    });
  });

  describe('Forgot and reset password', () => {
    beforeEach(async () => {
      await User.create({
        email: 'forgot@example.com',
        password: '123456',
        role: 'STUDENT'
      });
    });

    it('generates hashed reset token for existing user and is enumeration-safe', async () => {
      const existingRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' });

      const missingRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nouser@example.com' });

      expect(existingRes.statusCode).toBe(200);
      expect(missingRes.statusCode).toBe(200);
      expect(existingRes.body.message).toBe(missingRes.body.message);

      const user = await User.findOne({ email: 'forgot@example.com' }).select(
        '+resetPasswordToken +resetPasswordExpire'
      );
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    it('resets password with valid token and rejects expired token', async () => {
      const user = await User.findOne({ email: 'forgot@example.com' }).select(
        '+password'
      );

      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      user.resetPasswordExpire = Date.now() + 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const successRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'newpass123'
        });

      expect(successRes.statusCode).toBe(200);

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'forgot@example.com',
        password: 'newpass123'
      });
      expect(loginRes.statusCode).toBe(200);

      const expiredToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(expiredToken)
        .digest('hex');
      user.resetPasswordExpire = Date.now() - 1000;
      await user.save({ validateBeforeSave: false });

      const expiredRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredToken,
          newPassword: 'again123'
        });

      expect(expiredRes.statusCode).toBe(400);
    });
  });

  describe('Change password', () => {
    let token;

    beforeEach(async () => {
      await User.create({
        email: 'changepass@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const login = await request(app).post('/api/auth/login').send({
        email: 'changepass@example.com',
        password: '123456'
      });

      token = login.body.data.token;
    });

    it('changes password successfully for authenticated user', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: '123456',
          newPassword: 'newpass123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const relogin = await request(app).post('/api/auth/login').send({
        email: 'changepass@example.com',
        password: 'newpass123'
      });

      expect(relogin.statusCode).toBe(200);
    });

    it('fails with wrong current password or missing token', async () => {
      const wrong = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrong',
          newPassword: 'newpass123'
        });

      const missing = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: '123456',
          newPassword: 'newpass123'
        });

      expect(wrong.statusCode).toBe(400);
      expect(missing.statusCode).toBe(401);
    });
  });
});
