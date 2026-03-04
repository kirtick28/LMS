import { jest } from '@jest/globals';

// Mock email BEFORE importing app
jest.unstable_mockModule('../utils/sendEmail.js', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');

import request from 'supertest';
import crypto from 'crypto';

describe('Auth API', () => {
  /* ================= REGISTER ================= */

  describe('Register', () => {
    it('should register a user successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'student@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should fail if email already exists', async () => {
      await User.create({
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

    it('should fail if email is missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        password: '123456',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(400);
    });

    it('should fail if password is missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'nopassword@example.com',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(400);
    });

    it('should fail for invalid role', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'role@example.com',
        password: '123456',
        role: 'INVALID'
      });

      expect(res.statusCode).toBe(400);
    });

    it('should hash password before saving', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'hashcheck@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const user = await User.findOne({
        email: 'hashcheck@example.com'
      }).select('+password');

      expect(user.password).not.toBe('123456');
    });
  });

  /* ================= LOGIN ================= */

  describe('Login', () => {
    beforeEach(async () => {
      await User.create({
        email: 'login@example.com',
        password: '123456',
        role: 'STUDENT'
      });
    });

    it('should login successfully', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: '123456'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should fail if user does not exist', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nouser@example.com',
        password: '123456'
      });

      expect(res.statusCode).toBe(401);
    });

    it('should fail if password incorrect', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'wrong'
      });

      expect(res.statusCode).toBe(401);
    });

    it('should fail if account inactive', async () => {
      await User.updateOne({ email: 'login@example.com' }, { isActive: false });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: '123456'
      });

      expect(res.statusCode).toBe(403);
    });
  });

  /* ================= FORGOT PASSWORD ================= */

  describe('Forgot Password', () => {
    beforeEach(async () => {
      await User.create({
        email: 'forgot@example.com',
        password: '123456',
        role: 'STUDENT'
      });
    });

    it('should generate reset token if user exists', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'forgot@example.com'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: 'forgot@example.com' });

      expect(user.resetPasswordToken).toBeDefined();
    });

    it('should still return success if user does not exist', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'nouser@example.com'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /* ================= RESET PASSWORD ================= */

  describe('Reset Password', () => {
    it('should reset password successfully', async () => {
      const user = await User.create({
        email: 'reset@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const rawToken = crypto.randomBytes(32).toString('hex');

      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      user.resetPasswordExpire = Date.now() + 100000;

      await user.save({ validateBeforeSave: false });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawToken,
        newPassword: 'newpass123'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail if token expired', async () => {
      const user = await User.create({
        email: 'expired@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const rawToken = crypto.randomBytes(32).toString('hex');

      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      user.resetPasswordExpire = Date.now() - 1000;

      await user.save({ validateBeforeSave: false });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawToken,
        newPassword: '123456'
      });

      expect(res.statusCode).toBe(400);
    });
  });

  /* ================= CHANGE PASSWORD ================= */

  describe('Change Password', () => {
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

    it('should change password successfully', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: '123456',
          newPassword: 'newpass123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail if current password incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrong',
          newPassword: 'newpass123'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should fail if unauthorized', async () => {
      const res = await request(app).post('/api/auth/change-password').send({
        currentPassword: '123456',
        newPassword: 'newpass123'
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
