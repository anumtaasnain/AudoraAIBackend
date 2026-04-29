const User            = require('../../models/User');
const AttendeeProfile = require('../../models/AttendeeProfile');
const EventRegistration = require('../../models/EventRegistration');

// ─── GET /api/v1/attendees ────────────────────────────────────────────────────
exports.getAttendees = async (req, res, next) => {
  try {
    const { status, search, industryId, interestId, eventId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build profile filter
    const profileFilter = {};
    if (industryId) profileFilter.industryIds = industryId;
    if (interestId) profileFilter.interestIds = interestId;
    
    if (search) {
      const regex = new RegExp(search, 'i');
      profileFilter.$or = [
        { firstName: regex }, { lastName: regex },
        { company: regex },   { jobTitle: regex },
      ];
    }

    let profiles = await AttendeeProfile.find(profileFilter)
      .populate('industryIds interestIds')
      .lean();

    // Build set of user IDs that have registrations for the specified event (or any event if not specified)
    const registrationFilter = { userId: { $in: profiles.map(p => p.userId) } };
    if (eventId) {
      registrationFilter.eventId = eventId;
    }
    
    const registrations = await EventRegistration.find(registrationFilter).lean();
    const regUserIdSet = new Set(registrations.map(r => r.userId.toString()));

    // Build registration map (for latest registration per user)
    const regMap = {};
    for (const r of registrations) {
      const key = r.userId.toString();
      if (!regMap[key]) regMap[key] = r;
    }

    // Build attendee list, filtering by event presence if eventId specified
    let attendees = profiles.map((p) => {
      const userIdStr = p.userId.toString();
      // If eventId is specified, only include if user has a registration for that event
      if (eventId && !regUserIdSet.has(userIdStr)) return null;
      const reg = regMap[userIdStr] || {};
      return {
        id:             p.userId,
        name:           `${p.firstName} ${p.lastName}`,
        title:          p.jobTitle || '',
        company:        p.company  || '',
        email:          '',
        industry:       p.industryIds?.[0]?.name || '',
        relevanceScore: reg.relevanceScore ?? null,
        status:         reg.relevanceStatus ?? null,
      };
    }).filter(Boolean);

    // Filter by status
    if (status && status !== 'all') {
      attendees = attendees.filter((a) => a.status === status);
    }

    // Attach emails
    const validUserIds = attendees.map((a) => a.id);
    const users = await User.find({ _id: { $in: validUserIds } }).select('email').lean();
    const emailMap = {};
    for (const u of users) emailMap[u._id.toString()] = u.email;
    attendees = attendees.map((a) => ({ ...a, email: emailMap[a.id.toString()] || '' }));

    const total = attendees.length;
    const paginated = attendees.slice(skip, skip + Number(limit));

    res.status(200).json({
      success: true,
      total,
      page:  Number(page),
      limit: Number(limit),
      data:  paginated,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/attendees/:id ────────────────────────────────────────────────
exports.getAttendee = async (req, res, next) => {
  try {
    const profile = await AttendeeProfile.findOne({ userId: req.params.id })
      .populate('industryIds interestIds')
      .lean();
    if (!profile) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    const user = await User.findById(req.params.id).select('email role').lean();
    const reg  = await EventRegistration.findOne({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        id:             profile.userId,
        name:           `${profile.firstName} ${profile.lastName}`,
        email:          user?.email || '',
        title:          profile.jobTitle,
        company:        profile.company,
        industry:       profile.industryIds?.[0]?.name || '',
        companySize:    profile.companySize,
        eventInterest:  profile.interestIds?.[0]?.name || '',
        relevanceScore: reg?.relevanceScore ?? null,
        status:         reg?.relevanceStatus ?? null,
        isQualifiedLead: reg?.isQualifiedLead ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/attendees/:id/score ─────────────────────────────────────────
exports.getAttendeeScore = async (req, res, next) => {
  try {
    const reg = await EventRegistration.findOne({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('eventId', 'title eventType')
      .lean();

    if (!reg) return res.status(404).json({ success: false, message: 'No score found for this attendee.' });

    res.status(200).json({
      success: true,
      data: {
        attendeeId:      req.params.id,
        relevanceScore:  reg.relevanceScore,
        relevanceStatus: reg.relevanceStatus,
        scoringVersion:  reg.scoringVersion,
        event:           reg.eventId,
        isQualifiedLead: reg.isQualifiedLead,
      },
    });
  } catch (err) {
    next(err);
  }
};
