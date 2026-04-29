const mongoose = require('mongoose');

const eventInterestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Interest name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventInterest', eventInterestSchema);
