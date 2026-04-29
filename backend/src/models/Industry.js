const mongoose = require('mongoose');

const industrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Industry name is required'],
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

module.exports = mongoose.model('Industry', industrySchema);
