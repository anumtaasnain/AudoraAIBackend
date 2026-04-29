const mongoose = require('mongoose');

const attendeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    phone:     { type: String, trim: true },
    dob:       { type: Date },
    gender:    { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'] },

    // Social Profiles
    linkedinProfile:  { type: String, trim: true },
    indeedProfile:    { type: String, trim: true },
    facebookProfile:  { type: String, trim: true },
    instagramProfile: { type: String, trim: true },

    // Professional Info
    company:   { type: String, trim: true },
    jobTitle:  { type: String, trim: true },
    industryIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Industry',
    }],
    companySize: {
      type: String,
      enum: ['Small', 'Medium', 'Large', '1-10','11-50','51-200','201-500','501-1000','1000+'],
    },

    // Event Preferences
    interestIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventInterest',
    }],
    hearAboutUs: {
      type: String,
      enum: ['search','social','referral','event','advertisement','other'],
    },
  },
  { timestamps: true }
);

// Virtual: full name
attendeeProfileSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('AttendeeProfile', attendeeProfileSchema);
