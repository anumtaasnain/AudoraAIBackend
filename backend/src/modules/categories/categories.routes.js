const express = require('express');
const router = express.Router();
const controller = require('./categories.controller');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

// Public
router.get('/industries', controller.getIndustries);
router.get('/interests',  controller.getInterests);

// Admin Only
router.use(protect);
router.use(authorize('admin'));

router.post('/industries',      controller.createIndustry);
router.patch('/industries/:id', controller.updateIndustry);
router.delete('/industries/:id', controller.deleteIndustry);

router.post('/interests',       controller.createInterest);
router.patch('/interests/:id',  controller.updateInterest);
router.delete('/interests/:id', controller.deleteInterest);

module.exports = router;
