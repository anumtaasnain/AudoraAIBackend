const EventRegistration = require('../../models/EventRegistration');
const AttendeeProfile   = require('../../models/AttendeeProfile');
const EngagementMetric  = require('../../models/EngagementMetric');
const { getSenioritySegment } = require('../../services/aiScoring');

// ─── GET /api/v1/analytics/overview ──────────────────────────────────────────
exports.getOverview = async (req, res, next) => {
  try {
    const all      = await EventRegistration.find().lean();
    const total    = all.length;
    const high     = all.filter((r) => r.relevanceStatus === 'high').length;
    const moderate = all.filter((r) => r.relevanceStatus === 'moderate').length;
    const low      = all.filter((r) => r.relevanceStatus === 'low').length;

    const qualified  = all.filter((r) => r.isQualifiedLead).length;
    const converted  = all.filter((r) => r.isConverted).length;
    const convRate   = total > 0 ? +((converted / total) * 100).toFixed(1) : 0;

    // Average engagement
    const metrics   = await EngagementMetric.find().lean();
    const avgEng    = metrics.length
      ? +(metrics.reduce((s, m) => s + m.engagementRate, 0) / metrics.length).toFixed(1)
      : 82.5;

    // Simulated ROI based on high-relevance ratio
    const avgROI = total > 0 ? +(2.0 + (high / total) * 4.0).toFixed(1) : 4.5;

    res.status(200).json({
      success: true,
      data: {
        avgEngagementRate:      avgEng,
        avgROI,
        conversionRate:         convRate,
        qualifiedLeadsThisMonth: qualified,
        totalAttendees:         total,
        highRelevanceCount:     high,
        moderateCount:          moderate,
        lowRelevanceCount:      low,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/engagement-by-industry ────────────────────────────
exports.getEngagementByIndustry = async (req, res, next) => {
  try {
    const profiles = await AttendeeProfile.find().lean();
    const regs     = await EventRegistration.find().lean();

    const regMap = {};
    for (const r of regs) regMap[r.userId.toString()] = r;

    const industryMap = {};
    for (const p of profiles) {
      const key = p.industry || 'other';
      const reg = regMap[p.userId.toString()];
      const score = reg?.relevanceScore ?? 50;
      if (!industryMap[key]) industryMap[key] = { total: 0, count: 0 };
      industryMap[key].total += score;
      industryMap[key].count += 1;
    }

    const data = Object.entries(industryMap).map(([industry, { total, count }]) => {
      const engagement = Math.round(total / count);
      return {
        industry:   industry.charAt(0).toUpperCase() + industry.slice(1),
        engagement,
        prediction: Math.min(100, engagement + Math.floor(Math.random() * 5) + 2),
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/segmentation ──────────────────────────────────────
exports.getSegmentation = async (req, res, next) => {
  try {
    const profiles = await AttendeeProfile.find().lean();
    const segments = { 'C-Level Executives': 0, 'Directors/VPs': 0, 'Managers': 0, 'Individual Contributors': 0 };

    for (const p of profiles) {
      const seg = getSenioritySegment(p.jobTitle || '');
      segments[seg] = (segments[seg] || 0) + 1;
    }

    const colors = {
      'C-Level Executives':      '#3b82f6',
      'Directors/VPs':           '#8b5cf6',
      'Managers':                '#ec4899',
      'Individual Contributors': '#f59e0b',
    };

    const data = Object.entries(segments).map(([name, value]) => ({
      name, value, color: colors[name],
    }));

    res.status(200).json({ success: true, total: profiles.length, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/roi-trend ─────────────────────────────────────────
exports.getRoiTrend = async (req, res, next) => {
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data   = months.map((month, i) => ({
      month,
      traditional: +(2.1 + i * 0.07).toFixed(1),
      withAI:      +(3.5 + i * 0.26).toFixed(1),
    }));

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/funnel ────────────────────────────────────────────
exports.getFunnel = async (req, res, next) => {
  try {
    const all      = await EventRegistration.find().lean();
    const total    = all.length;
    const high     = all.filter((r) => r.relevanceStatus === 'high').length;
    const engaged  = Math.round(high * 0.83);
    const leads    = all.filter((r) => r.isQualifiedLead).length;
    const converted = all.filter((r) => r.isConverted).length;

    const stages = [
      { stage: 'Total Registrations', value: total,     color: '#3b82f6' },
      { stage: 'High Relevance',      value: high,      color: '#10b981' },
      { stage: 'Engaged',             value: engaged,   color: '#f59e0b' },
      { stage: 'Qualified Leads',     value: leads,     color: '#8b5cf6' },
      { stage: 'Conversions',         value: converted, color: '#ec4899' },
    ];

    res.status(200).json({ success: true, stages });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/analytics/engagement-trend ──────────────────────────────────
exports.getEngagementTrend = async (req, res, next) => {
  try {
    const metrics = await EngagementMetric.find().sort({ month: 1 }).lean();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const fallback = months.map((month, i) => ({
      month,
      engagement: 65 + i * 4,
      prediction: 62 + i * 5,
    }));

    const data = metrics.length
      ? metrics.map((m) => ({
          month:      new Date(m.month).toLocaleString('default', { month: 'short' }),
          engagement: m.engagementRate,
          prediction: m.predictedRate ?? m.engagementRate + 3,
        }))
      : fallback;

    const predictedGrowth = 15;
    res.status(200).json({ success: true, data, predictedGrowth });
  } catch (err) {
    next(err);
  }
};
