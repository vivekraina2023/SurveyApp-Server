const express = require('express');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config();
const chatService = require('./services/chatService');

const app = express();

// Trust proxy headers
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTP to HTTPS redirect middleware for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      const host = process.env.DOMAIN || req.hostname;
      const httpsUrl = `https://${host}${req.url}`;
      return res.status(301).redirect(httpsUrl);
    }
    next();
  });
}

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    domain: process.env.NODE_ENV === 'production' ? '.priyaraina.com' : undefined
  },
  proxy: true // Add this if you're behind a proxy
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
      ? `https://${process.env.DOMAIN}/auth/google/callback`
      : "http://localhost:5000/auth/google/callback",
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log('Google auth callback received:', {
      accessToken,
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails
      }
    });
    // Here you would typically find or create a user in your database
    return cb(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.CLIENT_URL}/login`,
    session: true
  }), (req, res) => {
    // Successful authentication, redirect to survey-designer
    res.redirect(`${process.env.CLIENT_URL}/survey-designer`);
  });

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not destroy session' });
      }
      res.clearCookie('connect.sid');
      res.clearCookie('connect.sid', { path: '/' });
      res.json({ success: true });
    });
  });
});

// Check auth status
app.get('/auth/status', (req, res) => {
  console.log('Auth status check received');
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      isAuthenticated: false,
      user: null
    });
  }
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  console.error('Vivek: chat mesage has been received');
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await chatService.processMessage(message);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Use environment port or default to 80
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});