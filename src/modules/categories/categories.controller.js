const Industry = require('../../models/Industry');
const EventInterest = require('../../models/EventInterest');

// ─── PUBLIC LISTING ───────────────────────────────────────────────

exports.getIndustries = async (req, res, next) => {
  try {
    const industries = await Industry.find().sort({ name: 1 });
    res.status(200).json({ success: true, data: industries });
  } catch (err) { next(err); }
};

exports.getInterests = async (req, res, next) => {
  try {
    const interests = await EventInterest.find().sort({ name: 1 });
    res.status(200).json({ success: true, data: interests });
  } catch (err) { next(err); }
};

// ─── ADMIN CRUD: INDUSTRIES ────────────────────────────────────────

exports.createIndustry = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const industry = await Industry.create({ name, slug, description });
    res.status(201).json({ success: true, data: industry });
  } catch (err) { next(err); }
};

exports.updateIndustry = async (req, res, next) => {
  try {
    const industry = await Industry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found' });
    res.status(200).json({ success: true, data: industry });
  } catch (err) { next(err); }
};

exports.deleteIndustry = async (req, res, next) => {
  try {
    const industry = await Industry.findByIdAndDelete(req.params.id);
    if (!industry) return res.status(404).json({ success: false, message: 'Industry not found' });
    res.status(200).json({ success: true, message: 'Industry deleted' });
  } catch (err) { next(err); }
};

// ─── ADMIN CRUD: INTERESTS ─────────────────────────────────────────

exports.createInterest = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const interest = await EventInterest.create({ name, slug, description });
    res.status(201).json({ success: true, data: interest });
  } catch (err) { next(err); }
};

exports.updateInterest = async (req, res, next) => {
  try {
    const interest = await EventInterest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!interest) return res.status(404).json({ success: false, message: 'Interest not found' });
    res.status(200).json({ success: true, data: interest });
  } catch (err) { next(err); }
};

exports.deleteInterest = async (req, res, next) => {
  try {
    const interest = await EventInterest.findByIdAndDelete(req.params.id);
    if (!interest) return res.status(404).json({ success: false, message: 'Interest not found' });
    res.status(200).json({ success: true, message: 'Interest deleted' });
  } catch (err) { next(err); }
};
