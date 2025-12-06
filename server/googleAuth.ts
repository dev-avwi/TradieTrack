import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from './auth';
import type { Express } from 'express';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Use REPLIT_DOMAINS for the callback URL (works in both dev and production on Replit)
const REPLIT_DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0];
const BASE_URL = REPLIT_DOMAIN ? `https://${REPLIT_DOMAIN}` : (process.env.REPL_URL || 'http://localhost:5000');

export function setupGoogleAuth(app: Express) {
  // Development mode - simulate Google OAuth without real credentials
  if (process.env.NODE_ENV === 'development' && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_ID === 'demo-client-id')) {
    console.log('🔧 Google OAuth in development mode - using simulation with persistent accounts');
    
    // Simulate Google OAuth flow for development with persistent demo accounts
    app.get('/api/auth/google', async (req: any, res) => {
      try {
        // Check query parameter for selected account (from frontend account picker)
        const selectedAccount = req.query.account;
        
        // Define persistent demo Google accounts (like real Google account picker)
        const demoAccounts = [
          {
            googleId: 'demo-google-primary',
            email: 'demo.google@tradietrack.com.au',
            firstName: 'Primary',
            lastName: 'Account',
            profileImageUrl: null,
            emailVerified: true
          },
          {
            googleId: 'demo-google-secondary',
            email: 'test.google@tradietrack.com.au',
            firstName: 'Test',
            lastName: 'Account',
            profileImageUrl: null,
            emailVerified: true
          }
        ];

        // Use the first account by default, or selected account from query
        const accountIndex = selectedAccount ? parseInt(selectedAccount as string, 10) : 0;
        const demoGoogleUser = demoAccounts[accountIndex] || demoAccounts[0];

        // Check if user already exists by Google ID (most reliable)
        let user = await AuthService.findUserByGoogleId(demoGoogleUser.googleId);
        
        if (!user) {
          // Check by email as fallback
          user = await AuthService.findUserByEmail(demoGoogleUser.email);
        }
        
        if (!user) {
          // Create new Google user (first-time login)
          console.log(`🆕 Creating new Google user: ${demoGoogleUser.email}`);
          user = await AuthService.createGoogleUser(demoGoogleUser);
        } else {
          // Existing user found - link Google ID if not already linked
          console.log(`✅ Existing Google user found: ${demoGoogleUser.email}`);
          if (!user.googleId) {
            await AuthService.linkGoogleAccount(user.id, demoGoogleUser.googleId);
          }
        }

        // Set session and explicitly save before redirecting
        req.session.userId = user.id;
        req.session.user = user;
        req.session.save((err: any) => {
          if (err) {
            console.error('Session save error:', err);
            return res.redirect('/?error=session_failed');
          }
          // Redirect back to app
          res.redirect('/?auth=google_success');
        });
      } catch (error) {
        console.error('Demo Google auth error:', error);
        res.redirect('/?error=auth_failed');
      }
    });

    app.get('/api/auth/google/callback', (req: any, res) => {
      res.redirect('/?auth=google_success');
    });

    return;
  }

  // Production mode with real Google OAuth
  console.log('🔐 Google OAuth in production mode - using real credentials');
  console.log('🔐 OAuth Callback URL:', `${BASE_URL}/api/auth/google/callback`);
  console.log('🔐 REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await AuthService.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: `${BASE_URL}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      const existingUser = await AuthService.findUserByGoogleId(profile.id);
      
      if (existingUser) {
        return done(null, existingUser);
      }

      // Check if user exists with the same email
      const emailUser = await AuthService.findUserByEmail(profile.emails?.[0]?.value || '');
      
      if (emailUser) {
        // Link Google account to existing user
        await AuthService.linkGoogleAccount(emailUser.id, profile.id);
        return done(null, emailUser);
      }

      // Create new user
      const newUser = await AuthService.createGoogleUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value || '',
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        profileImageUrl: profile.photos?.[0]?.value || null,
        emailVerified: true // Google accounts are pre-verified
      });

      return done(null, newUser);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, undefined);
    }
  }));

  // Google OAuth routes
  app.get('/api/auth/google', 
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account' // Force account selection every time
    })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (req: any, res) => {
      // Set session data and explicitly save
      if (req.user) {
        req.session.userId = req.user.id;
        req.session.user = req.user;
        req.session.save((err: any) => {
          if (err) {
            console.error('Session save error:', err);
            return res.redirect('/?error=session_failed');
          }
          // Redirect to main app
          res.redirect('/?auth=success');
        });
      } else {
        res.redirect('/?auth=success');
      }
    }
  );
}

