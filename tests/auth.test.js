import { jest } from '@jest/globals';

// Mock BEFORE importing app
jest.unstable_mockModule('../utils/sendEmail.js', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

// Now dynamically import modules AFTER mocking
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
import request from 'supertest';
import crypto from 'crypto';

describe('Auth API', () => {
  describe('Register', () => {
    it('should register a new user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.token).toBeDefined();

      const user = await User.findOne({ email: 'test@example.com' }).select(
        '+password'
      );

      expect(user).not.toBeNull();
      expect(user.password).not.toBe('123456');
    });
  });

  describe('Login', () => {
    it('should login existing user', async () => {
      // First create user manually
      await User.create({
        email: 'login@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: '123456'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.email).toBe('login@example.com');
    });
  });

  describe('Forgot Password', () => {
    it('should generate reset token for existing user', async () => {
      await User.create({
        email: 'forgot@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');

      const user = await User.findOne({ email: 'forgot@example.com' });

      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    it('should fail if user does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nouser@example.com' });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Reset Password', () => {
    it('should reset password with valid token', async () => {
      const user = await User.create({
        email: 'reset@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      // Generate fake reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: rawToken,
        newPassword: 'new123456'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');

      const updatedUser = await User.findOne({
        email: 'reset@example.com'
      }).select('+password');

      const isMatch = await updatedUser.comparePassword('new123456');
      expect(isMatch).toBe(true);

      expect(updatedUser.resetPasswordToken).toBeUndefined();
    });

    it('should fail with invalid token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'invalidtoken',
        newPassword: '123456'
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Change Password', () => {
    it('should change password for authenticated user', async () => {
      await User.create({
        email: 'change@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      // Login to get token
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'change@example.com',
        password: '123456'
      });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: '123456',
          newPassword: 'newpass123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');

      const updatedUser = await User.findOne({
        email: 'change@example.com'
      }).select('+password');

      const isMatch = await updatedUser.comparePassword('newpass123');
      expect(isMatch).toBe(true);
    });

    it('should fail if current password is wrong', async () => {
      await User.create({
        email: 'wrong@example.com',
        password: '123456',
        role: 'STUDENT'
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'wrong@example.com',
        password: '123456'
      });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpass',
          newPassword: 'newpass123'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should fail if no token provided', async () => {
      const res = await request(app).post('/api/auth/change-password').send({
        currentPassword: '123456',
        newPassword: 'newpass123'
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
