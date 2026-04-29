const mongoose = require('mongoose');

const audienceRequestSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    requestedParticipants: {
      type: Number,
      required: true,
      min: 1,
    },
    feePerParticipant: {
      type: Number,
      default: 5.0,
    },
    totalFee: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    status: {
      type: String,
      enum: ['pending', 'paid_and_fulfilled', 'failed'],
      default: 'pending',
    },
    stripePaymentIntentId: {
      type: String,
    },
    allocatedLeads: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('AudienceRequest', audienceRequestSchema);
