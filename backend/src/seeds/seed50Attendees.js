const faker = require('faker');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const AttendeeProfile = require('../models/AttendeeProfile');
const Industry = require('../models/Industry');
const Interest = require('../models/Interest');

// Industry mapping for realistic tech/startup attendees
const INDUSTRIES = [
  'technology', 'software', 'cloud', 'data', 'ai-ml', 'security',
  'devops', 'analytics', 'fintech', 'healthtech', 'salestech'
];

// Interest categories
const INTERESTS = [
  'ai-ml', 'cloud', 'devops', 'data', 'security', 'product',
  'startup', 'leadership', 'marketing', 'sales', 'finance'
];

// Job titles by seniority
const JOB_TITLES = [
  // Executive
  'CEO', 'CTO', 'CFO', 'COO', 'Chief Data Officer', 'VP Engineering',
  'VP Product', 'VP Marketing', 'VP Sales',
  // Director
  'Director of Engineering', 'Director of Product', 'Director of Marketing',
  'Director of Sales', 'Director of Data Science', 'IT Director',
  // Senior Individual Contributor
  'Senior Software Engineer', 'Senior Data Scientist', 'Senior DevOps Engineer',
  'Senior Security Engineer', 'Product Manager', 'Technical Lead',
  // Mid-level
  'Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Security Analyst',
  'Product Owner', 'Business Analyst', 'Consultant',
  // Junior
  'Junior Developer', 'Associate', 'Analyst', 'Support Engineer'
];

// Company sizes (affects relevance)
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

// Locations (can expand)
const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA',
  'Boston, MA', 'Los Angeles, CA', 'Chicago, IL', 'Denver, CO',
  'Remote', 'Palo Alto, CA', 'Mountain View, CA', 'Cupertino, CA'
];

/**
 * Generate a random attendee with realistic data
 * Creates both User and AttendeeProfile documents
 */
const generateAttendee = async (industry, interest, index) => {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

  // Generate password and hash
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Create User account
  const user = new User({
    email,
    password: passwordHash,
    role: 'attendee',
    verified: true,
    profile: {
      firstName,
      lastName,
      phone: faker.phone.phoneNumber(),
      company: faker.company.companyName(),
      jobTitle: faker.random.arrayElement(JOB_TITLES),
      companySize: faker.random.arrayElement(COMPANY_SIZES),
      industryIds: [industry._id],
      interestIds: [interest._id],
      location: faker.random.arrayElement(LOCATIONS),
      linkedinProfile: `https://linkedin.com/in/${firstName}${lastName}`.toLowerCase(),
    }
  });

  await user.save();

  // Create AttendeeProfile (for matching/relevance)
  const attendeeProfile = new AttendeeProfile({
    userId: user._id,
    firstName,
    lastName,
    phone: user.profile.phone,
    company: user.profile.company,
    jobTitle: user.profile.jobTitle,
    companySize: user.profile.companySize,
    industryIds: [industry],
    interestIds: [interest],
    location: user.profile.location,
    linkedinProfile: user.profile.linkedinProfile,
  });

  await attendeeProfile.save();

  return { user, attendeeProfile };
};

/**
 * Seed database with 50 attendees
 * - Well-balanced mix of seniority levels
 * - Spread across industries and interests
 * - Realistic names/companies
 * */
const seed50Attendees = async () => {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/audoraai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Fetch or create industries
    const industries = await Industry.find({});
    if (industries.length === 0) {
      console.log('Creating industries...');
      const industryPromises = INDUSTRIES.map(name => Industry.create({ name, slug: name }));
      await Promise.all(industryPromises);
      console.log('✅ Industries created');
      const industries = await Industry.find({});
    }

    // Fetch or create interests
    const interests = await Interest.find({});
    if (interests.length === 0) {
      console.log('Creating interests...');
      const interestPromises = INTERESTS.map(name => Interest.create({ name, slug: name }));
      await Promise.all(interestPromises);
      console.log('✅ Interests created');
      const interests = await Interest.find({});
    }

    // Clear existing demo attendees (optional)
    // await User.deleteMany({ email: /@example\.com$/ });
    // await AttendeeProfile.deleteMany({});
    // console.log('Cleared existing demo attendees');

    const generated = [];
    const batchSize = 50;
    console.log(`Generating ${batchSize} attendees...`);

    for (let i = 0; i < batchSize; i++) {
      // Pick random industry and interest (ensuring variety)
      const industry = industries[Math.floor(Math.random() * industries.length)];
      const interest = interests[Math.floor(Math.random() * interests.length)];

      const { user, attendeeProfile } = await generateAttendee(industry, interest, i);
      generated.push({ user, attendeeProfile });

      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ ${i + 1}/${batchSize} attendees created`);
      }
    }

    console.log(`\n✅ Successfully generated ${generated.length} attendees!`);
    console.log('Summary:');
    console.log('- Users with passwords: password123');
    console.log('- All attendees have profile data for matching');
    console.log('- Distribution across industries and interests');

    // Print sample user credentials
    console.log('\n📋 Sample credentials (first 5):');
    generated.slice(0, 5).forEach((g, idx) => {
      console.log(`${idx + 1}. ${g.user.profile.firstName} ${g.user.profile.lastName} (${g.user.email})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed50Attendees();
