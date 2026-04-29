const express    = require('express');
const router     = express.Router();
const controller = require('./auth.controller');
const { protect } = require('../../middleware/auth');

router.post('/register', controller.register);
router.post('/login',    controller.login);
router.post('/refresh',  controller.refresh);
router.post('/logout',   controller.logout);
router.get('/me',        protect, controller.getMe);

module.exports = router;
