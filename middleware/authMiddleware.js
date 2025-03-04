const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "Kedhareswarmatha";
const Token = require('../models/Token');
const User = require('../models/User');

exports.verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }
    
    // Extract the token
    const token = authHeader.split(" ")[1];
    
    // Verify token signature
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Check if the token exists in the database
    const storedToken = await Token.findOne({ 
      userId: decoded.userId, 
      accessToken: token 
    });
    
    if (!storedToken) {
      return res.status(401).json({ msg: "Invalid token or session expired" });
    }
    
    // Check if user is still logged in
    const user = await User.findById(decoded.userId);
    if (!user || !user.isLoggedIn) {
      return res.status(401).json({ 
        msg: "Your session has expired. Please log in again.",
        sessionExpired: true
      });
    }
    
    // Update last activity time
    if (user.deviceInfo) {
      await User.findByIdAndUpdate(decoded.userId, {
        'deviceInfo.lastActivity': new Date()
      });
    }
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role || "user" // Default to user if role is missing
    };
    
    console.log("Token verified successfully for user:", req.user);
    next();
  } catch (err) {
    console.error("Token verification error:", err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        msg: "Your session has expired. Please log in again.",
        tokenExpired: true
      });
    }
    
    return res.status(401).json({ msg: "Token is not valid" });
  }
};

exports.verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'User not authenticated' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied. Admin privileges required' });
  }
  
  next();
};
