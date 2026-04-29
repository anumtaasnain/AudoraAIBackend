const EventRegistration = require('../../models/EventRegistration');
const ActivityLog       = require('../../models/ActivityLog');
const EngagementMetric  = require('../../models/EngagementMetric');
const Event             = require('../../models/Event');
const AudienceRequest  = require('../../models/AudienceRequest');

// ─── GET /api/v1/dashboard/summary ───────────────────────────────────────────
exports.getSummary = async (req, res, next) => {
  try {
    let filter = {};
    let eventFilter = {};
    let audienceRequestCount = 0;

    if (req.user.role === 'organizer') {
      const myEvents = await Event.find({ organizerId: req.user._id }, '_id');
      const myEventIds = myEvents.map(e => e._id);
      filter.eventId = { $in: myEventIds };
      eventFilter.organizerId = req.user._id;
      
      const requests = await AudienceRequest.find({ organizerId: req.user._id, status: 'paid_and_fulfilled' });
      audienceRequestCount = requests.reduce((acc, curr) => acc + curr.requestedParticipants, 0);
    }

    const all      = await EventRegistration.find(filter).lean();
    const total    = all.length;
    const high     = all.filter((r) => r.relevanceStatus === 'high').length;
    const moderate = all.filter((r) => r.relevanceStatus === 'moderate').length;
    const low      = all.filter((r) => r.relevanceStatus === 'low').length;

    const highPct = total > 0 ? Math.round((high / total) * 100) : 0;
    const modPct  = total > 0 ? Math.round((moderate / total) * 100) : 0;
    const lowPct  = total > 0 ? Math.round((low / total) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAttendees:     total,
        totalAttendeesChange: 12.5,
        highRelevance:  { count: high,     percentage: highPct },
        moderate:       { count: moderate, percentage: modPct  },
        lowRelevance:   { count: low,      percentage: lowPct  },
        purchasedLeads: audienceRequestCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/dashboard/activity ──────────────────────────────────────────
exports.getActivity = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'organizer') {
      const myEvents = await Event.find({ organizerId: req.user._id }, '_id');
      const myEventIds = myEvents.map(e => e._id);
      filter.$or = [
        { eventId: { $in: myEventIds } },
        { userId: req.user._id }
      ];
    } else if (req.user.role === 'attendee') {
      filter.userId = req.user._id;
    }

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const activities = logs.map((l) => ({
      id:          l._id,
      type:        l.type,
      title:       l.title,
      description: l.description,
      createdAt:   l.createdAt,
    }));

    res.status(200).json({ success: true, activities });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/dashboard/engagement-trend ──────────────────────────────────
exports.getEngagementTrend = async (req, res, next) => {
  try {
    const metrics = await EngagementMetric.find().sort({ month: 1 }).lean();

    const months   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const fallback = months.map((m, i) => ({
      month: m, engagement: 65 + i * 4, prediction: 62 + i * 5,
    }));

    const data = metrics.length
      ? metrics.map((m) => ({
          month:      new Date(m.month).toLocaleString('default', { month: 'short' }),
          engagement: m.engagementRate,
          prediction: m.predictedRate ?? m.engagementRate + 3,
        }))
      : fallback;

    res.status(200).json({ success: true, data, predictedGrowth: 15 });
  } catch (err) {
    next(err);
  }
};
