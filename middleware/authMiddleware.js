// authMiddleware.js - Updated version
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "Kedhareswarmatha";
const Token = require('../models/Token');

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
      const storedToken = await Token.findOne({ userId: decoded.userId, accessToken: token });
      if (!storedToken) {
        return res.status(401).json({ msg: "Invalid token or session expired" });
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


