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

// CORS Middleware
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://folderly2.vercel.app"
];

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true, // Allows cookies/session headers
}));

// Explicitly handle preflight requests
app.options("*", cors());

// Middleware
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Initialize token cleanup job
setupTokenCleanupJob();

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error(`❌ MongoDB connection error: ${err.message}`));

// Debugging MongoDB connection
mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connection established successfully.");
});
mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
});
mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB disconnected. Reconnecting...");
});

// Global CORS Headers (Backup)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", allowedOrigins.join(","));
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/folder", folderRoutes);

// Test email route
app.get('/test-email', async (req, res) => {
    try {
        await sendResetEmail('your-test-email@example.com', '123456');
        res.json({ msg: '✅ Test email sent successfully' });
    } catch (err) {
        console.error('❌ Test email error:', err);
        res.status(500).json({ msg: err.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Optional: Set timeout for long requests (if needed)
server.timeout = 120000;
