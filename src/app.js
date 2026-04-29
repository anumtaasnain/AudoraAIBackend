require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { sendReminders } = require('./services/reminderService');

// ─── Route modules ────────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const attendeeRoutes = require('./modules/attendees/attendees.routes');
const eventRoutes = require('./modules/events/events.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const sponsorRoutes = require('./modules/sponsors/sponsors.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const categoryRoutes = require('./modules/categories/categories.routes');
const audienceRoutes = require('./modules/audience/audience.routes');
const sponsorshipRoutes = require('./modules/sponsorship/sponsorship.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const leadRequestRoutes = require('./modules/lead-requests/leadRequests.routes');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ─── Initialize Background Jobs ──────────────────────────────────────────────
// sendReminders(); // Optional: run once on start to catch up


const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: true, // Dynamically allow the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many auth attempts, please try again in a minute.' },
});

app.use(globalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = `/api/${process.env.API_VERSION || 'v1'}`;

app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/attendees`, attendeeRoutes);
app.use(`${API}/events`, eventRoutes);
app.use(`${API}/analytics`, analyticsRoutes);
app.use(`${API}/sponsors`, sponsorRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/audience`, audienceRoutes);
app.use(`${API}/sponsorship`, sponsorshipRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/lead-requests`, leadRequestRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get(`${API}/health`, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Audora AI API is running',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Audora AI API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📡 Base URL: http://localhost:${PORT}${API}`);
  });
}

module.exports = app;
