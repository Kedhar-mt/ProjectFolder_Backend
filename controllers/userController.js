const User = require('../models/User');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res) => {
  try {
    // Get pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get search query if it exists
    const searchQuery = req.query.search || '';
    
    // Build the search condition for multiple fields
    let searchCondition = {};
    
    if (searchQuery) {
      // First check if there's an exact match on username
      const exactMatch = await User.findOne({ username: searchQuery })
        .select('-password -__v');
      
      if (exactMatch) {
        // If exact username match found, return only that user
        return res.json({
          users: [exactMatch],
          pagination: {
            totalRecords: 1,
            totalPages: 1,
            currentPage: 1,
            pageSize: 1,
            startRecord: 1,
            endRecord: 1
          },
          searchQuery
        });
      }
      
      // If no exact match, proceed with regular partial matching
      searchCondition = {
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
          { phone: { $regex: searchQuery, $options: 'i' } },
          { role: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }
    
    // Count total matching users for pagination metadata
    const total = await User.countDocuments(searchCondition);
    
    // Fetch users with pagination and search
    const users = await User.find(searchCondition)
      .select('-password -__v')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Gmail-like pagination format
    const startRecord = total === 0 ? 0 : skip + 1;
    const endRecord = Math.min(skip + limit, total);
    
    // Prepare pagination metadata
    const pagination = {
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      pageSize: limit,
      startRecord,
      endRecord
    };
    
    // Add search query to the response
    res.json({
      users: users.length ? users : [],
      pagination,
      searchQuery
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).send('Server Error');
  }
};

const updateUser = async (req, res) => {
  const { username, email, phone, role } = req.body;
  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    // Ensure user can only update their own data unless they are an admin
    if (req.user.userId !== user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Unauthorized to update this user' });
    }
    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ msg: 'Email already exists' });
      }
    }
    
    // Create update object with all fields
    const updateFields = {
      username,
      email,
      phone,
      role: role === 'admin' || role === 'user' ? role : 'user'
    };
    
    user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    console.error('Error updating user:', err.message);
    res.status(500).send('Server Error');
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Ensure admin privileges
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    // Get updated total count after deletion
    const total = await User.countDocuments();
    
    res.json({ 
      msg: 'User removed',
      totalRecords: total 
    });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};
const deleteAllUsers = async (req, res) => {
  try {
    // Ensure admin privileges
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required' });
    }
    
    // Delete all users except the current admin
    const result = await User.deleteMany({ _id: { $ne: req.user.userId } });
    
    res.json({ 
      msg: 'All users removed',
      deletedCount: result.deletedCount,
      totalRecords: 1 // Only current admin remains
    });
  } catch (err) {
    console.error('Error deleting all users:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};
const createUser = async (req, res) => {
  const { username, email, phone, password, role } = req.body;
  
  try {
    // Check if user with this email already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }
    
    // Ensure only admins can create admin users
    const userRole = role === 'admin' && req.user.role === 'admin' ? 'admin' : 'user';
    
    // Create new user
    user = new User({
      username,
      email,
      phone,
      password,
      role: userRole
    });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    await user.save();
    
    // Get updated total count after creation
    const total = await User.countDocuments();
    
    // Return user without password
    const userResponse = await User.findById(user._id).select('-password');
    res.status(201).json({
      user: userResponse,
      totalRecords: total
    });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  deleteAllUsers
};
