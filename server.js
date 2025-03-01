const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const folderRoutes = require("./routes/folderRoutes");
const authRoutes = require("./routes/authRoutes");
const { sendResetEmail } = require('./utils/emailService');
const setupTokenCleanupJob = require('./jobs/tokenCleanupJob');
const userRoutes = require("./routes/userRoutes");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000','https://folderly2.vercel.app'],
    methods: ['GET', 'POST','PUT','DELETE'],
    credentials: true,
  }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));
// Initialize token cleanup job
 setupTokenCleanupJob();

const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error(`MongoDB connection error: ${err}`));


// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/folder", folderRoutes);

// Test email route
app.get('/test-email', async (req, res) => {
    try {
      await sendResetEmail('your-test-email@example.com', '123456');
      res.json({ msg: 'Test email sent' });
    } catch (err) {
      console.error('Test email error:', err);
      res.status(500).json({ msg: err.message });
    }
  });

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
server.timeout=120000;
