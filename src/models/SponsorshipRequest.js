const mongoose = require('mongoose');

const sponsorshipRequestSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    tier: {
      type: String,
      enum: ['Silver', 'Gold', 'Platinum'],
      default: 'Silver',
    },
    amount: {
      type: Number,
      required: true,
      default: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SponsorshipRequest', sponsorshipRequestSchema);
