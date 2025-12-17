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
        // Check if this is a mobile request
        const isMobile = req.query.mobile === 'true';
        
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
            if (isMobile) {
              return res.redirect('tradietrack://?error=session_failed');
            }
            return res.redirect('/?error=session_failed');
          }
          // Redirect based on platform
          if (isMobile) {
            console.log('🔐 Mobile OAuth success (dev mode), redirecting to app deep link');
            return res.redirect('tradietrack://?auth=google_success');
          }
          res.redirect('/?auth=google_success');
        });
      } catch (error) {
        console.error('Demo Google auth error:', error);
        const isMobile = req.query.mobile === 'true';
        if (isMobile) {
          res.redirect('tradietrack://?error=auth_failed');
        } else {
          res.redirect('/?error=auth_failed');
        }
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

  // Google OAuth Strategy with passReqToCallback to access session
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: `${BASE_URL}/api/auth/google/callback`,
    passReqToCallback: true
  }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
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

  // Google OAuth routes - use state parameter to track mobile requests
  app.get('/api/auth/google', (req: any, res, next) => {
    const isMobile = req.query.mobile === 'true';
    // Use state parameter to pass mobile flag through OAuth flow
    const state = isMobile ? 'mobile' : 'web';
    console.log(`🔐 Starting Google OAuth - platform: ${state}`);
    
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account',
      state: state
    })(req, res, next);
  });

  app.get('/api/auth/google/callback', (req: any, res, next) => {
    // Get mobile flag from state parameter (preserved through OAuth flow)
    const state = req.query.state;
    const isMobile = state === 'mobile';
    console.log(`🔐 Google OAuth callback - state: ${state}, isMobile: ${isMobile}`);
    
    passport.authenticate('google', (err: any, user: any, info: any) => {
      if (err || !user) {
        console.error('Google OAuth failed:', err || 'No user returned');
        if (isMobile) {
          console.log('🔐 Mobile OAuth failed, redirecting to app deep link');
          return res.redirect('tradietrack://?error=auth_failed');
        }
        return res.redirect('/?error=auth_failed');
      }
      
      // Login the user
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          if (isMobile) {
            return res.redirect('tradietrack://?error=login_failed');
          }
          return res.redirect('/?error=login_failed');
        }
        
        // Set session data
        req.session.userId = user.id;
        req.session.user = user;
        
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            if (isMobile) {
              return res.redirect('tradietrack://?error=session_failed');
            }
            return res.redirect('/?error=session_failed');
          }
          
          // Redirect based on platform
          if (isMobile) {
            // Pass session token in URL for mobile app to use
            const sessionToken = req.sessionID;
            console.log('🔐 Mobile OAuth success, redirecting to app deep link with token');
            return res.redirect(`tradietrack://?auth=google_success&token=${sessionToken}`);
          }
          
          // Redirect to web app
          console.log('🔐 Web OAuth success, redirecting to web app');
          res.redirect('/?auth=success');
        });
      });
    })(req, res, next);
  });
}

