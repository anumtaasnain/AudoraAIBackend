const User            = require('../../models/User');
const AttendeeProfile = require('../../models/AttendeeProfile');

// ─── GET /api/v1/users/me ─────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const profile = await AttendeeProfile.findOne({ userId: req.user._id }).lean();
    res.status(200).json({
      success: true,
      data: {
        user: {
          id:         req.user._id,
          email:      req.user.email,
          role:       req.user.role,
          isVerified: req.user.isVerified,
          createdAt:  req.user.createdAt,
        },
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/users/me ───────────────────────────────────────────────────
exports.updateMe = async (req, res, next) => {
  try {
    // Prevent password/role updates through this route
    const forbidden = ['passwordHash', 'password', 'role'];
    for (const f of forbidden) delete req.body[f];

    const profile = await AttendeeProfile.findOneAndUpdate(
      { userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/users/me ──────────────────────────────────────────────────
exports.deleteMe = async (req, res, next) => {
  try {
    await AttendeeProfile.deleteOne({ userId: req.user._id });
    await User.findByIdAndDelete(req.user._id);
    res.status(200).json({ success: true, message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/users (admin only) ──────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments();
    const users = await User.find().skip(skip).limit(Number(limit)).lean();
    res.status(200).json({ success: true, total, page: Number(page), data: users });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/users/sponsors (public protected) ───────────────────────────
exports.getSponsors = async (req, res, next) => {
  try {
    const sponsors = await User.find({ role: 'sponsor' }).select('email').lean();
    const sponsorIds = sponsors.map(s => s._id);
    const profiles = await AttendeeProfile.find({ userId: { $in: sponsorIds } }).populate('industryIds interestIds').lean();
    
    const profileMap = {};
    for (const p of profiles) profileMap[p.userId.toString()] = p;

    const data = sponsors.map(s => ({
      id: s._id,
      email: s.email,
      profile: profileMap[s._id.toString()] || null
    }));

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/users/:id (admin only) ──────────────────────────────────────
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const profile = await AttendeeProfile.findOne({ userId: req.params.id }).lean();
    res.status(200).json({ success: true, data: { user, profile } });
  } catch (err) {
    next(err);
  }
};
