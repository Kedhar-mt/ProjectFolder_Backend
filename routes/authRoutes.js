const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  forgotPassword,
  resetPassword ,
  refreshToken,
  logout
} = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');


router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate,logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);



module.exports = router;