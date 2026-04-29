const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./src/config/database');
const Industry = require('./src/models/Industry');
const EventInterest = require('./src/models/EventInterest');

const seedCategories = async () => {
  try {
    await connectDB();

    const industries = [
      { name: 'Technology', slug: 'tech' },
      { name: 'Healthcare', slug: 'healthcare' },
      { name: 'Finance', slug: 'finance' },
      { name: 'Marketing', slug: 'marketing' },
      { name: 'Education', slug: 'education' },
      { name: 'Manufacturing', slug: 'manufacturing' },
    ];

    const interests = [
      { name: 'AI & Machine Learning', slug: 'ai-ml' },
      { name: 'Cloud Computing', slug: 'cloud' },
      { name: 'Cybersecurity', slug: 'security' },
      { name: 'Product Management', slug: 'product' },
      { name: 'Blockchain', slug: 'blockchain' },
      { name: 'Data Engineering', slug: 'data' },
    ];

    await Industry.deleteMany({});
    await EventInterest.deleteMany({});

    await Industry.insertMany(industries);
    await EventInterest.insertMany(interests);

    console.log('✅ Categories seeded successfully!');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding categories:', err);
    process.exit(1);
  }
};

seedCategories();
