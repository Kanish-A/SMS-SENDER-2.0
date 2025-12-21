// server.js

// --- Core Imports ---
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { initializeDatabase } = require('./db'); // Database initialization function

// --- Route Imports ---
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const advisorRoutes = require('./routes/advisor');

// Load environment variables from the .env file
require('dotenv').config();

// Initialize the Express app
const app = express();


// --- Middleware Setup ---

// This list contains all the URLs that are allowed to connect to your backend.
const allowedOrigins = [
  'https://esec-sms-sender.onrender.com', // Your DEPLOYED frontend URL
  'http://localhost:3000',               // Your LOCAL development U
  //'http://157.51.80.162:3000'           // Your MOBILE/NETWORK access URL
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests if the origin is in our list (or if there's no origin, like from Postman)
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('This origin is not allowed by the CORS policy.'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));


// Body Parsers: Allow the server to understand incoming JSON and form data.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Management: Creates a persistent login session for users.
// THIS MUST BE DEFINED BEFORE THE API ROUTES.
app.use(session({
  // IMPORTANT: The secret should always be loaded from your .env file for security.
  secret: process.env.SESSION_SECRET || 'this-is-not-a-secure-secret-for-production',
  resave: false,
  // --- THIS IS THE KEY CHANGE ---
  // Set to false. This prevents empty session objects from being saved for unauthenticated users.
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use 'true' in production (HTTPS)
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    sameSite: 'lax', // Use 'none' for cross-site cookies, but 'lax' is safer for most cases
    maxAge: 24 * 60 * 60 * 1000 // Cookie expires in 1 day
  }
}));


// --- API Routes ---
// This is where your application's API endpoints are connected.
console.log('🔌 Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/advisor', advisorRoutes);
console.log('✅ API routes registered.');


// Health Check: A simple route to verify that the server is running.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});


// --- Global Error Handling ---
// This middleware catches any unhandled errors from your routes.
app.use((err, req, res, next) => {
  console.error('❌ UNHANDLED ERROR:', err.stack);
  res.status(500).json({ message: 'An unexpected internal server error occurred.' });
});


// --- Server Startup Logic ---
async function startServer() {
  try {
    // 1. Initialize the database connection first.
    console.log('🔄 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connected successfully.');

    // 2. Start the Express server only after the database is ready.
    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0'; // Listen on all available network interfaces

    app.listen(PORT, HOST, () => {
      const isProduction = process.env.NODE_ENV === 'production';
      const liveUrl = 'https://esec-sms-backend.onrender.com'; // Your backend's live URL
      const localUrl = `http://localhost:${PORT}`;
     // const networkUrl = `http://157.51.80.162:${PORT}`; // For easy reference

      console.log(`\n🚀 Server is live!`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Local access: ${localUrl}`);
     // console.log(`   Network access: ${networkUrl}`); // Log the network URL for mobile access
    });
  } catch (error) {
    console.error('❌ FATAL: Could not initialize database. Server is shutting down.', error.message);
    process.exit(1); // Exit the application if the database connection fails
  }
}

// Start the server
startServer();