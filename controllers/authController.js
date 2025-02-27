const User = require("../models/User");
const Token = require("../models/Token"); // Import the Token model
const bcrypt = require("bcryptjs");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { sendResetEmail } = require("../utils/emailService");
const { encrypt, decrypt } = require("../utils/encryption");
const SECRET_KEY = process.env.SECRET_KEY || "Kedhareswarmatha";

exports.generateTokens = (user) => {
  const payload = { id: user.id };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1m",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "1h",
  });

  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  console.log("🔒 Encrypted Access Token:", encryptedAccessToken);
  console.log("🔒 Encrypted Refresh Token:", encryptedRefreshToken);

  return { 
    accessToken: encryptedAccessToken, 
    refreshToken: encryptedRefreshToken,
    accessTokenExpiry: Date.now() + 60 * 1000, // 1 minute in milliseconds
    refreshTokenExpiry: Date.now() + 60 * 60 * 1000 // 1 hour in milliseconds
  };
};

exports.register = async (req, res) => {
    const { username, email, phone, password, role } = req.body;
  
    try {
      if (!SECRET_KEY) {
        return res.status(500).json({ msg: "Server configuration error: SECRET_KEY is missing" });
      }
  
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ msg: "Email already registered" });
      }
  
      // Check if phone number already exists
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ msg: "Phone number already registered" });
      }
  
      // Decrypt the encrypted password from frontend
      // const bytes = CryptoJS.AES.decrypt(password, SECRET_KEY);
      // const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
      const decryptedPassword = password;
  
      if (!decryptedPassword) {
        console.error("Decryption failed: Empty result");
        return res.status(400).json({ msg: "Invalid encrypted password" });
      }
  
      // Hash the decrypted password with bcrypt before storing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(decryptedPassword, salt);
  
      // Validate role
      const validRole = role === 'admin' || role === 'user' ? role : 'user';
  
      // Save user with hashed password and phone number
      const newUser = new User({ 
        username, 
        email, 
        phone,
        password: hashedPassword,
        role: validRole 
      });
      await newUser.save();
  
      res.status(201).json({ msg: "User registered successfully" });
    } catch (err) {
      console.error("Registration error:", err.message);
      res.status(500).send("Server Error");
    }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Decrypt the incoming encrypted password
    // const bytes = CryptoJS.AES.decrypt(password, SECRET_KEY);
    // const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
    const decryptedPassword = password;

    if (!decryptedPassword) {
      console.error("Decryption failed: Empty result");
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Compare decrypted password with hashed password in DB
    const isMatch = await bcrypt.compare(decryptedPassword, user.password);
    if (!isMatch) {
      console.error("Password mismatch");
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        userId: user._id,
        role: user.role || "user"
      },
      SECRET_KEY, 
      { expiresIn: "1h" }
    );
    
    const refreshToken = jwt.sign(
      { 
        userId: user._id,
        role: user.role || "user"
      }, 
      SECRET_KEY, 
      { expiresIn: "7d" }
    );

    // Get client information
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    // Store tokens in database
    const newToken = new Token({
      userId: user._id,
      accessToken,
      refreshToken,
      userAgent,
      ip,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await newToken.save();
    console.log(`Tokens stored in database for user: ${user._id}`);

    res.json({ 
      accessToken, 
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || "user"
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

exports.logout = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    // Delete all token documents for this user
    const result = await Token.deleteMany({ userId });
    
    if (result.deletedCount > 0) {
      console.log(`Successfully deleted ${result.deletedCount} tokens for user ${userId}`);
      res.json({ 
        success: true, 
        msg: "Logged out successfully", 
        tokensRemoved: result.deletedCount 
      });
    } else {
      console.log(`No tokens found for user ${userId}`);
      res.json({ 
        success: true, 
        msg: "No active sessions found",
        tokensRemoved: 0 
      });
    }
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ msg: "Please provide email, OTP, and new password" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    if (!user.resetPasswordOTP) {
      return res.status(400).json({ msg: "OTP not found, please request a new one" });
    }

    // Check OTP expiration
    const currentTime = new Date();
    const expireTime = new Date(user.resetPasswordExpire);
    
    if (!user.resetPasswordExpire || currentTime > expireTime) {
      return res.status(400).json({ msg: "OTP has expired. Please request a new one" });
    }

    const isValidOTP = await bcrypt.compare(otp, user.resetPasswordOTP);
    if (!isValidOTP) {
      return res.status(400).json({ msg: "Invalid reset code" });
    }

    // Decrypt the encrypted password from frontend
    // const bytes = CryptoJS.AES.decrypt(newPassword, SECRET_KEY);
    // const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
    const decryptedPassword = newPassword;

    if (!decryptedPassword) {
      return res.status(400).json({ msg: "Invalid password format" });
    }

    // Hash the decrypted password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(decryptedPassword, salt);

    // Update user with new hashed password and reset OTP fields
    await User.findByIdAndUpdate(user._id, {
      $set: {
        password: hashedPassword,
        resetPasswordOTP: null,
        resetPasswordExpire: null
      }
    }, { new: true });

    // Invalidate all existing tokens for this user
    await Token.deleteMany({ userId: user._id });

    res.json({ msg: "Password has been reset successfully" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ msg: "Server error while resetting password" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP:", otp);

    const salt = await bcrypt.genSalt(10);
    user.resetPasswordOTP = await bcrypt.hash(otp, salt);
    // Extend expiration time to 30 minutes
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);

    await user.save();

    console.log("OTP stored successfully:", user.resetPasswordOTP);
    console.log("OTP expires at:", user.resetPasswordExpire);

    await sendResetEmail(user.email, otp);

    res.json({ msg: "Reset OTP sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ msg: "Server error while sending OTP" });
  }
};

exports.refreshToken = async (req, res) => {

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ msg: "Refresh token is required" });
  }

  try {
    const decryptedToken = decrypt(refreshToken);
    console.log("🔓 Decrypted Refresh Token:", decryptedToken);

    const decoded = jwt.verify(decryptedToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // Find the token in the database
    const tokenDoc = await Token.findOne({ 
      userId: user._id,
      refreshToken: decryptedToken
    });

    if (!tokenDoc) {
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    // Generate new tokens
    const tokens = exports.generateTokens(user);
    
    // Update token in database
    tokenDoc.accessToken = tokens.accessToken;
    tokenDoc.refreshToken = tokens.refreshToken;
    tokenDoc.issuedAt = new Date();
    tokenDoc.expiresAt = new Date(tokens.refreshTokenExpiry);
    
    await tokenDoc.save();

    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (error) {
    console.error("Error refreshing token:", error);
    
    // If token verification fails, invalid token
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Invalid or expired refresh token" });
    }
    
    res.status(500).json({ msg: "Server error" });
  }
};

// New method to clean up expired tokens (can be called by a cron job)
exports.cleanupExpiredTokens = async () => {
  try {
    const result = await Token.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    console.log(`Cleaned up ${result.deletedCount} expired tokens`);
    return result.deletedCount;
  } catch (err) {
    console.error("Token cleanup error:", err);
    throw err;
  }
};