const Event             = require('../../models/Event');
const EventRegistration = require('../../models/EventRegistration');
const AttendeeProfile   = require('../../models/AttendeeProfile');
const ActivityLog       = require('../../models/ActivityLog');
const { calculateAIRelevanceScore, getRelevanceStatus } = require('../../services/aiScoring');

// ─── GET /api/v1/events ───────────────────────────────────────────────────────
exports.getEvents = async (req, res, next) => {
  try {
    let filter = { isActive: true };
    
    // Role-based filtering
    if (req.user.role === 'organizer') {
      filter.organizerId = req.user._id;
    } else if (req.user.role === 'sponsor') {
      filter.status = { $in: ['pending_sponsor', 'approved'] };
    } else if (req.user.role === 'attendee') {
      const profile = await AttendeeProfile.findOne({ userId: req.user._id });
      if (profile) {
        filter.status = 'approved';
        filter.$or = [
          { industryId: { $in: profile.industryIds } },
          { interestId: { $in: profile.interestIds } }
        ];
      }
    }
    // admin sees all events

    const events = await Event.find(filter)
      .populate('organizerId', 'email')
      .populate('interestId industryId')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, total: events.length, data: events });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/events/:id ───────────────────────────────────────────────────
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizerId', 'email').lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/events ──────────────────────────────────────────────────────
exports.createEvent = async (req, res, next) => {
  try {
    const { title, description, location, startsAt, endsAt, interestId, industryId } = req.body;
    const event = await Event.create({
      title, description, location, startsAt, endsAt,
      interestId, industryId,
      organizerId: req.user._id,
      status: 'pending_admin'
    });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/events/:id ─────────────────────────────────────────────────
exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/events/:id/status ──────────────────────────────────────────
exports.updateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const event = await Event.findById(req.params.id);
    
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    // Validate transition
    if (req.user.role === 'admin') {
      if (!['pending_sponsor', 'rejected'].includes(status)) {
         return res.status(400).json({ success: false, message: 'Admin can only transition to pending_sponsor or rejected.' });
      }
    } else if (req.user.role === 'sponsor') {
      if (event.status !== 'pending_sponsor') {
         return res.status(400).json({ success: false, message: 'Event is not pending sponsor approval.' });
      }
      if (!['approved', 'rejected'].includes(status)) {
         return res.status(400).json({ success: false, message: 'Sponsor can only transition to approved or rejected.' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to change status.' });
    }

    event.status = status;
    await event.save();
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/events/:id ───────────────────────────────────────────────
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });
    res.status(200).json({ success: true, message: 'Event deactivated.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/events/:id/register ────────────────────────────────────────
exports.registerForEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, isActive: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const profile = await AttendeeProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(400).json({ success: false, message: 'Complete your profile before registering.' });

    // Check already registered
    const existing = await EventRegistration.findOne({ eventId: event._id, userId: req.user._id });
    if (existing) return res.status(409).json({ success: false, message: 'Already registered for this event.' });

    // Fetch past events to calculate past experience score
    const pastRegistrations = await EventRegistration.find({
      userId: req.user._id,
      status: { $in: ['approved', 'attended'] },
      attendanceStatus: { $ne: 'no_show' }
    }).populate('eventId');
    const pastEvents = pastRegistrations.map(r => r.eventId).filter(Boolean);

    const noShowRegistrations = await EventRegistration.find({
      userId: req.user._id,
      attendanceStatus: 'no_show'
    });

    // AI Score
    const aiResult = await calculateAIRelevanceScore(profile, event);
    const { relevanceScore, relevanceStatus, analysis, engagementPrediction } = aiResult;

    const reg = await EventRegistration.create({
      eventId:         event._id,
      userId:          req.user._id,
      relevanceScore:  relevanceScore,
      relevanceStatus: relevanceStatus,
      aiAnalysis:      analysis,
      engagementPrediction: engagementPrediction,
      isQualifiedLead: relevanceScore >= 80,
      status:          'pending_admin',
    });

    // Log activity
    await ActivityLog.create({
      eventId:     event._id,
      userId:      req.user._id,
      type:        relevanceScore >= 80 ? 'lead_identified' : 'attendee_flagged',
      title:       relevanceScore >= 80 ? 'High-quality lead identified' : 'Low relevance attendee flagged',
      description: `${profile.firstName} ${profile.lastName} registered for ${event.title}`,
    });

    res.status(201).json({
      success: true,
      message: 'Successfully registered for event.',
      data: { relevanceScore, relevanceStatus, status: 'pending_admin' },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/events/registrations ────────────────────────────────────
exports.getRegistrations = async (req, res, next) => {
  try {
    let filter = {};
    
    if (req.user.role === 'attendee') {
      filter.userId = req.user._id;
    } else if (req.user.role === 'organizer') {
      const myEvents = await Event.find({ organizerId: req.user._id }, '_id');
      const myEventIds = myEvents.map(e => e._id);
      filter.eventId = { $in: myEventIds };
    } else if (req.user.role === 'sponsor') {
      return res.status(403).json({ success: false, message: 'Sponsors do not manage registrations.'});
    }

    const registrations = await EventRegistration.find(filter)
      .populate('eventId', 'title startsAt eventType')
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .lean();
      
    res.status(200).json({ success: true, data: registrations });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/events/registrations/:id/status ────────────────────────
exports.updateRegistrationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const reg = await EventRegistration.findById(req.params.id).populate('eventId');
    
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });

    if (req.user.role === 'admin') {
       if (!['pending_organizer', 'rejected'].includes(status)) {
         return res.status(400).json({ success: false, message: 'Admin can only transition to pending_organizer or rejected' });
       }
    } else if (req.user.role === 'organizer') {
       if (reg.eventId.organizerId.toString() !== req.user._id.toString()) {
         return res.status(403).json({ success: false, message: 'Not authorized for this event.' });
       }
       if (reg.status !== 'pending_organizer') {
         return res.status(400).json({ success: false, message: 'Registration is not waiting for organizer approval.' });
       }
       if (!['approved', 'rejected'].includes(status)) {
         return res.status(400).json({ success: false, message: 'Organizer can only transition to approved or rejected.' });
       }
    } else {
       return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    reg.status = status;
    await reg.save();
    res.status(200).json({ success: true, data: reg });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/events/registrations/:id/attendance ─────────────────────
exports.updateRegistrationAttendance = async (req, res, next) => {
  try {
    const { attendanceStatus } = req.body;
    const reg = await EventRegistration.findById(req.params.id).populate('eventId');
    
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found.' });

    if (req.user.role === 'admin' || (req.user.role === 'organizer' && reg.eventId.organizerId.toString() === req.user._id.toString())) {
       if (!['pending', 'attended', 'no_show'].includes(attendanceStatus)) {
         return res.status(400).json({ success: false, message: 'Invalid attendance status.' });
       }
    } else {
       return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    reg.attendanceStatus = attendanceStatus;
    await reg.save();
    res.status(200).json({ success: true, data: reg });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/events/public ────────────────────────────────────────────────
exports.getPublicEvents = async (req, res, next) => {
  try {
    const now = new Date();
    const events = await Event.find({
      isActive: true,
      status: 'approved',
      $or: [
        { startsAt: { $gte: now } },  // future events
        { startsAt: null }             // or events with no date set yet
      ]
    })
      .populate('interestId industryId')
      .populate('organizerId', 'email')
      .sort({ startsAt: 1 })  // nearest first
      .lean();
    res.status(200).json({ success: true, total: events.length, data: events });
  } catch (err) {
    next(err);
  }
};
