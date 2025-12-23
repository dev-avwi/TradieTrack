import bcrypt from 'bcrypt';
import { storage } from './storage';
import { loginSchema, insertUserSchema, SafeUser, User } from '@shared/schema';
import crypto from 'crypto';
import { sendWelcomeEmail } from './emailService';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    tradeType?: string;
  }): Promise<{ success: true; user: SafeUser } | { success: false; error: string }> {
    try {
      // Validate input
      const validatedData = insertUserSchema.parse(userData);

      // Prevent registering demo email in production
      if (process.env.NODE_ENV === 'production' && validatedData.email === 'demo@tradietrack.com.au') {
        return { success: false, error: 'This email address is reserved.' };
      }

      // Ensure required fields are present
      if (!validatedData.email || !validatedData.password) {
        return { success: false, error: 'Email and password are required' };
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      if (validatedData.username) {
        const existingUsername = await storage.getUserByUsername(validatedData.username);
        if (existingUsername) {
          return { success: false, error: 'Username already taken' };
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(validatedData.password);

      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Send welcome email (async, don't block registration)
      sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }).catch(err => {
        console.error('Failed to send welcome email:', err);
      });

      // Return user without password
      const { password, ...safeUser } = user;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  static async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ success: true; user: SafeUser } | { success: false; error: string }> {
    try {
      // Validate input
      const validatedCredentials = loginSchema.parse(credentials);

      // Get user by email
      const user = await storage.getUserByEmail(validatedCredentials.email);
      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if user is active
      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated. Please contact support.' };
      }

      // Check if email is verified (allow demo users to bypass in development only)
      if (!user.emailVerified && 
          !(process.env.NODE_ENV === 'development' && user.email === 'demo@tradietrack.com.au')) {
        return { success: false, error: 'Please verify your email address before logging in. Check your email for verification instructions.' };
      }

      // Verify password (user.password could be null for OAuth users)
      if (!user.password) {
        return { success: false, error: 'Please login with Google or reset your password' };
      }
      const isValidPassword = await this.verifyPassword(validatedCredentials.password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Return user without password
      const { password, ...safeUser } = user;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  static async getUserById(userId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) return null;

      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async createEmailVerificationToken(userId: string): Promise<string> {
    const token = this.generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRY_HOURS);

    await storage.updateUser(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });

    return token;
  }

  static async verifyEmail(token: string): Promise<{ success: true; user: SafeUser } | { success: false; error: string }> {
    try {
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return { success: false, error: 'Invalid or expired verification token' };
      }

      // Check if token has expired
      if (user.emailVerificationExpiresAt && new Date() > user.emailVerificationExpiresAt) {
        return { success: false, error: 'Verification token has expired. Please request a new one.' };
      }

      // Mark email as verified and clear verification token
      const updatedUser = await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      });

      if (!updatedUser) {
        return { success: false, error: 'Failed to verify email' };
      }

      const { password, ...safeUser } = updatedUser;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, error: 'Email verification failed. Please try again.' };
    }
  }

  static async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (user.emailVerified) {
        return { success: false, error: 'Email is already verified' };
      }

      // Generate new verification token
      await this.createEmailVerificationToken(user.id);

      return { success: true };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { success: false, error: 'Failed to resend verification email' };
    }
  }

  // Password Reset methods
  static async createPasswordResetToken(email: string): Promise<{ success: true; token: string } | { success: false; error: string }> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists - security best practice
        return { success: true, token: '' };
      }

      const token = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

      await storage.updateUser(user.id, {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      });

      return { success: true, token };
    } catch (error) {
      console.error('Create password reset token error:', error);
      return { success: false, error: 'Failed to create password reset token' };
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ success: true } | { success: false; error: string }> {
    try {
      if (newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const user = await storage.getUserByPasswordResetToken(token);
      if (!user) {
        return { success: false, error: 'Invalid or expired reset token' };
      }

      // Check if token has expired
      if (user.passwordResetExpiresAt && new Date() > user.passwordResetExpiresAt) {
        return { success: false, error: 'Password reset token has expired. Please request a new one.' };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      });

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'Failed to reset password. Please try again.' };
    }
  }

  // Google OAuth methods
  static async findUserByGoogleId(googleId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByGoogleId(googleId);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      return null;
    }
  }

  static async findUserByEmail(email: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  static async linkGoogleAccount(userId: string, googleId: string): Promise<void> {
    try {
      await storage.linkGoogleAccount(userId, googleId);
    } catch (error) {
      console.error('Error linking Google account:', error);
      throw error;
    }
  }

  static async createGoogleUser(userData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    emailVerified: boolean;
  }): Promise<SafeUser> {
    try {
      // Generate username from email
      const username = userData.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      
      // Create base user
      const user = await storage.createUser({
        email: userData.email,
        username: username,
        password: '', // No password for Google users
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      // Update with Google-specific fields
      await storage.updateUser(user.id, {
        profileImageUrl: userData.profileImageUrl,
        emailVerified: userData.emailVerified,
        googleId: userData.googleId,
      } as any);

      // Fetch the updated user
      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) throw new Error('Failed to fetch updated user');

      // Send welcome email (async, don't block user creation)
      sendWelcomeEmail({
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      }).catch(err => {
        console.error('Failed to send welcome email for Google user:', err);
      });

      // Return safe user data without password
      const { password, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error creating Google user:', error);
      throw error;
    }
  }

  // Apple Sign In methods
  static async findUserByAppleId(appleId: string): Promise<SafeUser | null> {
    try {
      const user = await storage.getUserByAppleId(appleId);
      if (!user) return null;
      
      // Return safe user data without password
      const { password, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      console.error('Error finding user by Apple ID:', error);
      return null;
    }
  }

  static async linkAppleAccount(userId: string, appleId: string): Promise<void> {
    try {
      await storage.linkAppleAccount(userId, appleId);
    } catch (error) {
      console.error('Error linking Apple account:', error);
      throw error;
    }
  }

  static async createAppleUser(userData: {
    appleId: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  }): Promise<SafeUser> {
    try {
      // Generate username from email
      const username = userData.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      
      // Create base user
      const user = await storage.createUser({
        email: userData.email,
        username: username,
        password: '', // No password for Apple users
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      // Update with Apple-specific fields
      await storage.updateUser(user.id, {
        emailVerified: userData.emailVerified,
        appleId: userData.appleId,
      } as any);

      // Fetch the updated user
      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) throw new Error('Failed to fetch updated user');

      // Send welcome email (async, don't block user creation)
      sendWelcomeEmail({
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      }).catch(err => {
        console.error('Failed to send welcome email for Apple user:', err);
      });

      // Return safe user data without password
      const { password, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error creating Apple user:', error);
      throw error;
    }
  }
}

// Session middleware type
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: SafeUser;
}