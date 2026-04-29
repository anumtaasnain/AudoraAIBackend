const User             = require('../../models/User');
const AttendeeProfile  = require('../../models/AttendeeProfile');
const ActivityLog      = require('../../models/ActivityLog');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken } = require('../../services/tokenService');
const { calculateAIRelevanceScore, getRelevanceStatus } = require('../../services/aiScoring');
const EventRegistration = require('../../models/EventRegistration');
const Event            = require('../../models/Event');

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const {
      firstName, lastName, email, password, phone,
      dob, gender, linkedinProfile, indeedProfile, facebookProfile, instagramProfile,
      company, jobTitle, industryIds, companySize,
      interestIds, hearAboutUs, role
    } = req.body;

    // Check duplicate
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Define validated role
    const userRole = (role === 'organizer' || role === 'attendee') ? role : 'attendee';

    // Validation for Organizer
    if (userRole === 'organizer') {
      if (!company || !jobTitle || !companySize) {
        return res.status(400).json({ success: false, message: 'Company name, job title, and company size are required for organizers.' });
      }
    }

    // Create user
    const user = await User.create({ email, passwordHash: password, role: userRole });

    // Create attendee profile
    const profile = await AttendeeProfile.create({
      userId: user._id,
      firstName, lastName, phone,
      dob, gender, linkedinProfile, indeedProfile, facebookProfile, instagramProfile,
      company, jobTitle, industryIds, companySize,
      interestIds, hearAboutUs,
    });
    
    await profile.populate('industryIds interestIds');

    // --- AI Scoring: register against latest active event (or default) ---
    const latestEvent = await Event.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (latestEvent) {
      const aiResult = await calculateAIRelevanceScore(profile, latestEvent);
      const { relevanceScore, relevanceStatus, analysis, engagementPrediction } = aiResult;

      await EventRegistration.create({
        eventId:         latestEvent._id,
        userId:          user._id,
        relevanceScore:  relevanceScore,
        relevanceStatus: relevanceStatus,
        aiAnalysis:      analysis,
        engagementPrediction: engagementPrediction,
        isQualifiedLead: relevanceScore >= 80,
      });

      // Log activity
      const activityType = relevanceScore >= 80 ? 'lead_identified' : 'attendee_flagged';
      const activityTitle = relevanceScore >= 80
        ? 'High-quality lead identified'
        : 'Low relevance attendee flagged';
      await ActivityLog.create({
        eventId:     latestEvent._id,
        userId:      user._id,
        type:        activityType,
        title:       activityTitle,
        description: `${firstName} ${lastName} (${jobTitle}, ${company}) registered for ${latestEvent.title}`,
      });
    }

    // Tokens
    const accessToken  = generateAccessToken(user._id, user.role);
    const refreshToken = await generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. AI profile analysis complete.',
      data: {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const accessToken  = generateAccessToken(user._id, user.role);
    const refreshToken = await generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required.' });
    }

    const record      = await verifyRefreshToken(refreshToken);
    const user        = await User.findById(record.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // Rotate: revoke old, issue new
    await revokeRefreshToken(refreshToken);
    const newAccess  = generateAccessToken(user._id, user.role);
    const newRefresh = await generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      data: { accessToken: newAccess, refreshToken: newRefresh },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await revokeRefreshToken(refreshToken);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const profile = await AttendeeProfile.findOne({ userId: req.user._id });
    res.status(200).json({
      success: true,
      data: { user: req.user, profile },
    });
  } catch (err) {
    next(err);
  }
};
