require('dotenv').config();
const mongoose        = require('mongoose');
const bcrypt          = require('bcryptjs');
const connectDB       = require('../config/database');
const User            = require('../models/User');
const AttendeeProfile = require('../models/AttendeeProfile');
const Event           = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const SponsorLead     = require('../models/SponsorLead');
const EngagementMetric = require('../models/EngagementMetric');
const ActivityLog     = require('../models/ActivityLog');
const Industry        = require('../models/Industry');
const EventInterest   = require('../models/EventInterest');
const { calculateAIRelevanceScore, getRelevanceStatus, calculateMatchScore, getLeadQuality, calculateConversionProbability, estimateDealValue } = require('../services/aiScoring');

const seed = async () => {
  await connectDB();
  console.log('🌱 Starting database seed...');

  // ── Clear all collections ─────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    AttendeeProfile.deleteMany({}),
    Event.deleteMany({}),
    EventRegistration.deleteMany({}),
    SponsorLead.deleteMany({}),
    EngagementMetric.deleteMany({}),
    ActivityLog.deleteMany({}),
    Industry.deleteMany({}),
    EventInterest.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data.');

  // ── Create Organizer ──────────────────────────────────────────────────────
  const organizer = await User.create({
    email: 'organizer@audoraai.com',
    passwordHash: 'password123',
    role: 'organizer',
    isVerified: true,
  });

  // ── Create Sponsor ────────────────────────────────────────────────────────
  const sponsor = await User.create({
    email: 'sponsor@dataflow.io',
    passwordHash: 'password123',
    role: 'sponsor',
    isVerified: true,
  });

  // ── Create Admin ──────────────────────────────────────────────────────────
  const admin = await User.create({
    email: 'admin@audoraai.com',
    passwordHash: 'password123',
    role: 'admin',
    isVerified: true,
  });

  // ── Create Categories ─────────────────────────────────────────────────────
  const aiIndustry = await Industry.create({ name: 'Technology', slug: 'technology' });
  const softwareIndustry = await Industry.create({ name: 'Software', slug: 'software' });
  const aiInterest = await EventInterest.create({ name: 'AI & Machine Learning', slug: 'ai-ml' });
  const dataInterest = await EventInterest.create({ name: 'Data Science', slug: 'data' });

  console.log('✅ Created initial industries and interests.');

  // ── Create Event ──────────────────────────────────────────────────────────
  const event = await Event.create({
    organizerId: organizer._id,
    title:       'AI Summit 2026',
    description: 'The premier event for AI and Machine Learning professionals.',
    eventType:   'ai-ml',
    interestId:  aiInterest._id,
    industryId:  aiIndustry._id,
    location:    'San Francisco, CA',
    startsAt:    new Date('2026-06-15'),
    endsAt:      new Date('2026-06-17'),
    isActive:    true,
  });
  console.log(`✅ Created event: ${event.title}`);

  // ── Create Attendees ──────────────────────────────────────────────────────
  const attendeesData = [
    { email: 'sarah.chen@techcorp.com',      firstName: 'Sarah',   lastName: 'Chen',      jobTitle: 'Chief Technology Officer', company: 'TechCorp Industries',   industry: 'technology', companySize: '1000+',    eventInterest: 'ai-ml',      phone: '+1 (555) 123-4567' },
    { email: 'mrodriguez@dataflow.io',       firstName: 'Michael', lastName: 'Rodriguez', jobTitle: 'VP of Engineering',        company: 'DataFlow Solutions',    industry: 'software',   companySize: '501-1000', eventInterest: 'data',       phone: '+1 (555) 234-5678' },
    { email: 'ewatson@cloudscale.com',       firstName: 'Emily',   lastName: 'Watson',    jobTitle: 'Product Manager',         company: 'CloudScale Inc',        industry: 'cloud',      companySize: '201-500',  eventInterest: 'product',    phone: '+1 (555) 345-6789' },
    { email: 'dkim@codebase.dev',            firstName: 'David',   lastName: 'Kim',       jobTitle: 'Senior Developer',        company: 'CodeBase Labs',         industry: 'software',   companySize: '51-200',   eventInterest: 'devops',     phone: '+1 (555) 456-7890' },
    { email: 'jtaylor@brandworks.com',       firstName: 'Jessica', lastName: 'Taylor',    jobTitle: 'Marketing Director',      company: 'BrandWorks Agency',     industry: 'marketing',  companySize: '51-200',   eventInterest: 'product',    phone: '+1 (555) 567-8901' },
    { email: 'randerson@salespro.com',       firstName: 'Robert',  lastName: 'Anderson',  jobTitle: 'Sales Manager',           company: 'SalesPro Systems',      industry: 'sales',      companySize: '11-50',    eventInterest: 'leadership', phone: '+1 (555) 678-9012' },
    { email: 'afoster@analyticsplus.com',    firstName: 'Amanda',  lastName: 'Foster',    jobTitle: 'Business Analyst',        company: 'Analytics Plus',        industry: 'analytics',  companySize: '11-50',    eventInterest: 'data',       phone: '+1 (555) 789-0123' },
    { email: 'cmartinez@peoplefirst.com',    firstName: 'Chris',   lastName: 'Martinez',  jobTitle: 'HR Specialist',           company: 'PeopleFirst Corp',      industry: 'other',      companySize: '201-500',  eventInterest: 'leadership', phone: '+1 (555) 890-1234' },
    { email: 'lpatterson@officesol.com',     firstName: 'Linda',   lastName: 'Patterson', jobTitle: 'Administrative Assistant',company: 'Office Solutions',      industry: 'other',      companySize: '11-50',    eventInterest: 'leadership', phone: '+1 (555) 901-2345' },
    { email: 'kbrooks@helpdesk.com',         firstName: 'Kevin',   lastName: 'Brooks',    jobTitle: 'Customer Support',        company: 'HelpDesk Pro',          industry: 'other',      companySize: '1-10',     eventInterest: 'startup',    phone: '+1 (555) 012-3456' },
  ];

  for (const a of attendeesData) {
    const user = await User.create({ email: a.email, passwordHash: 'password123', role: 'attendee', isVerified: true });
    const profile = await AttendeeProfile.create({
      userId: user._id,
      firstName: a.firstName, lastName: a.lastName, phone: a.phone,
      company: a.company, jobTitle: a.jobTitle, 
      industryIds: [aiIndustry._id],
      interestIds: [aiInterest._id],
      companySize: a.companySize,
      hearAboutUs: 'referral',
    });

    const aiResult = await calculateAIRelevanceScore(profile, event);
    const { relevanceScore, relevanceStatus, analysis, engagementPrediction } = aiResult;

    await EventRegistration.create({
      eventId: event._id, userId: user._id,
      relevanceScore: relevanceScore, 
      relevanceStatus: relevanceStatus,
      aiAnalysis: analysis,
      engagementPrediction: engagementPrediction,
      isQualifiedLead: relevanceScore >= 80,
    });

    await ActivityLog.create({
      eventId: event._id, userId: user._id,
      type:  relevanceScore >= 80 ? 'lead_identified' : 'attendee_flagged',
      title: relevanceScore >= 80 ? 'High-quality lead identified' : 'Low relevance attendee flagged',
      description: `${a.firstName} ${a.lastName} (${a.jobTitle}, ${a.company}) registered for ${event.title}`,
    });
    console.log(`  👤 ${a.firstName} ${a.lastName} → score: ${relevanceScore} [${relevanceStatus}]`);
  }

  // ── Engagement Metrics (6 months) ─────────────────────────────────────────
  const engData = [
    { month: '2026-01-01', engagementRate: 65, predictedRate: 62 },
    { month: '2026-02-01', engagementRate: 72, predictedRate: 70 },
    { month: '2026-03-01', engagementRate: 78, predictedRate: 80 },
    { month: '2026-04-01', engagementRate: 82, predictedRate: 85 },
    { month: '2026-05-01', engagementRate: 85, predictedRate: 88 },
    { month: '2026-06-01', engagementRate: 88, predictedRate: 90 },
  ];
  for (const m of engData) {
    await EngagementMetric.create({ eventId: event._id, month: new Date(m.month), engagementRate: m.engagementRate, predictedRate: m.predictedRate });
  }
  console.log('✅ Engagement metrics seeded.');

  // ── Generate Sponsor Leads ─────────────────────────────────────────────────
  const regs = await EventRegistration.find({ eventId: event._id, relevanceStatus: { $in: ['high', 'moderate'] } }).lean();
  for (const reg of regs) {
    const profile = await AttendeeProfile.findOne({ userId: reg.userId }).lean();
    if (!profile) continue;
    const matchScore   = calculateMatchScore(reg, profile, null);
    const quality      = getLeadQuality(matchScore);
    const convProb     = calculateConversionProbability(profile, matchScore);
    const [min, max]   = estimateDealValue(profile);
    const engagement   = reg.relevanceScore >= 80 ? 'High' : 'Medium';
    await SponsorLead.create({
      sponsorId: sponsor._id, attendeeId: reg.userId, eventId: event._id,
      matchScore, leadQuality: quality, conversionProbability: convProb,
      estimatedValueMin: min, estimatedValueMax: max,
      previousEngagement: engagement,
      interests: [profile.eventInterest, profile.industry].filter(Boolean),
      status: 'new',
    });
  }
  console.log(`✅ Sponsor leads generated: ${regs.length}`);

  // ── Extra activity log entries ─────────────────────────────────────────────
  await ActivityLog.create([
    { eventId: event._id, type: 'sponsor_interest', title: 'New sponsor interested', description: 'DataFlow Inc. requesting access to lead dashboard' },
    { eventId: event._id, type: 'roi_updated',      title: 'ROI prediction updated', description: 'Expected sponsor ROI increased to 4.2x based on new registrations' },
  ]);

  console.log('\n✅ Seed complete! Default credentials:');
  console.log('   Organizer → organizer@audoraai.com / password123');
  console.log('   Sponsor   → sponsor@dataflow.io      / password123');
  console.log('   Admin     → admin@audoraai.com     / password123');
  console.log('   Attendees → (see list above)         / password123');

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
