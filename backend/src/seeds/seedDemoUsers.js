require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendeeProfile = require('../models/AttendeeProfile');

const demoUsers = [
  {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin',
    profile: { firstName: 'Admin', lastName: 'User', phone: '+1-555-0001' },
  },
  {
    email: 'organizer@test.com',
    password: 'password123',
    role: 'organizer',
    profile: { firstName: 'Event', lastName: 'Organizer', phone: '+1-555-0002', company: 'EventPro Ltd', jobTitle: 'Event Manager', companySize: 'Medium' },
  },
  {
    email: 'sponsor@test.com',
    password: 'password123',
    role: 'sponsor',
    profile: { firstName: 'Big', lastName: 'Sponsor', phone: '+1-555-0003', company: 'TechCorp Inc', jobTitle: 'Marketing Director', companySize: 'Large' },
  },
  {
    email: 'attendee@test.com',
    password: 'password123',
    role: 'attendee',
    profile: { firstName: 'Test', lastName: 'Attendee', phone: '+1-555-0004', company: 'StartupCo', jobTitle: 'Developer', companySize: 'Small' },
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    for (const demo of demoUsers) {
      // Check if user already exists
      const existing = await User.findOne({ email: demo.email });
      if (existing) {
        console.log(`⚠️  User already exists: ${demo.email} (skipping)`);
        continue;
      }

      // Create user
      const user = await User.create({
        email: demo.email,
        passwordHash: demo.password,
        role: demo.role,
      });

      // Create attendee profile for all roles
      await AttendeeProfile.create({
        userId: user._id,
        ...demo.profile,
        hearAboutUs: 'other',
        interestIds: [],
        industryIds: [],
      });

      console.log(`✅ Created ${demo.role}: ${demo.email}`);
    }

    console.log('\n🎉 Demo users seeded successfully!');
    console.log('─────────────────────────────────');
    console.log('  admin@test.com     / password123');
    console.log('  organizer@test.com / password123');
    console.log('  sponsor@test.com   / password123');
    console.log('  attendee@test.com  / password123');
    console.log('─────────────────────────────────');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
