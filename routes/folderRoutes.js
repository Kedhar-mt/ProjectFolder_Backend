const express = require("express");
const multer = require("multer");
const path = require("path");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");
const folderController = require("../controllers/folderController");

const router = express.Router();

//Multer configuration
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, path.join(__dirname, "../uploads"));
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 80 * 1024 * 1024 // 5MB limit
    }
});

// Routes
router.post("/create", verifyToken, verifyAdmin, folderController.createFolder);
router.post("/upload/:folderId", verifyToken, verifyAdmin, upload.array("images", 50), folderController.uploadImages);
router.post("/bulk-upload", verifyToken, verifyAdmin, upload.array("images", 50), folderController.bulkUpload);
router.post("/users/upload", folderController.uploadUsers);
router.get("/", verifyToken, folderController.getFolders);
router.put("/disable/:id", verifyToken, verifyAdmin, folderController.toggleFolderStatus);
router.put("/:folderId", verifyToken, verifyAdmin, folderController.updateFolderName);
router.put("/:folderId/image/:imageId", verifyToken, verifyAdmin, folderController.updateImageName);
router.delete("/:folderId/image", verifyToken, verifyAdmin, folderController.deleteImage);
router.delete("/:folderId", verifyToken, verifyAdmin, folderController.deleteFolder);
router.post('/users/upload', async (req, res) => {
  try {
    const users = Array.isArray(req.body) ? req.body : [req.body];
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const userData of users) {
      try {
        const existingUser = await User.findOne({ 
          $or: [
            { email: userData.email },
            { username: userData.username }
          ]
        });
        
        if (existingUser) {
          skippedCount++;
          continue;
        }
        
        const newUser = new User(userData);
        await newUser.save();
        addedCount++;
      } catch (error) {
        // If this is a duplicate key error, just skip this user
        if (error.code === 11000) {
          skippedCount++;
        } else {
          throw error;
        }
      }
    }
    
    return res.status(200).json({ 
      message: 'Users registration completed', 
      addedCount,
      skippedCount
    });
  } catch (error) {
    console.error('Error uploading users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File is too large. Maximum size is 5MB" });
        }
        return res.status(400).json({ message: error.message });
    }
    next(error);
});

module.exports = router;
