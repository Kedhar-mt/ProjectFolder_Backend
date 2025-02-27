const express = require('express');
const router = express.Router();
const { 
  getAllUsers, 
  getUserById, 
  updateUser, 
  deleteUser,
  createUser
} = require('../controllers/userController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Protected routes
router.get('/', verifyToken, verifyAdmin, getAllUsers); // Admin-only access
router.get('/:id', verifyToken, getUserById); // Authenticated users can view a user
router.put('/:id', verifyToken, updateUser); // Users can update their own data, admin can update anyone
router.delete('/:id', verifyToken, verifyAdmin, deleteUser); // Admin-only access
router.post('/', verifyToken, verifyAdmin, createUser);

module.exports = router;
