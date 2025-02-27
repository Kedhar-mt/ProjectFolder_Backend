const path = require("path");
const fs = require("fs");
const sharp = require('sharp');
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Folder = require("../models/Folder");
const { s3, bucketName } = require('../config/awsConfig');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const folderController = {
    createFolder: async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ message: "Folder name is required" });
            }

            const newFolder = new Folder({ name });
            await newFolder.save();
            res.status(201).json({ message: "Folder created successfully", folder: newFolder });
        } catch (err) {
            console.error("Folder creation error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    uploadImages: async (req, res) => {
        try {
            const folder = await Folder.findById(req.params.folderId);
            if (!folder) {
                // Clean up any uploaded files
                if (req.files && req.files.length > 0) {
                    req.files.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });
                }
                return res.status(404).json({ message: "Folder not found" });
            }
    
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No images uploaded" });
            }
    
            const processedImages = [];
            
            for (const file of req.files) {
                try {
                    const outputFilename = `resized-${Date.now()}-${file.filename}`;
                    const outputFilePath = path.join(uploadDir, outputFilename);
    
                    // Ensure the upload directory exists
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
    
                    // Process image with Sharp
                    await sharp(file.path)
                        .resize(800, 800, { 
                            fit: 'inside', 
                            withoutEnlargement: true 
                        })
                        .toFormat('jpeg', { 
                            quality: 80,
                            mozjpeg: true
                        })
                        .toFile(outputFilePath);
    
                    // Upload to S3
                    const fileContent = fs.readFileSync(outputFilePath);
                    const params = {
                        Bucket: bucketName,
                        Key: `uploads/${outputFilename}`,
                        Body: fileContent,
                        ContentType: 'image/jpeg' // ✅ Removed ACL: 'public-read'
                    };
    
                    console.log("Uploading to S3 with params:", {
                        Bucket: bucketName,
                        Key: `uploads/${outputFilename}`,
                        ContentType: 'image/jpeg'
                    });
    
                    const s3Response = await s3.upload(params).promise();
                    console.log("S3 upload successful:", s3Response);
    
                    // Clean up local files
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    if (fs.existsSync(outputFilePath)) {
                        fs.unlinkSync(outputFilePath);
                    }
    
                    processedImages.push({
                        name: file.originalname,
                        path: s3Response.Location
                    });
                } catch (processError) {
                    console.error("Error processing image:", processError);
                    // Continue with other images even if one fails
                }
            }
    
            if (processedImages.length === 0) {
                return res.status(500).json({ message: "Failed to process any images" });
            }
    
            folder.images.push(...processedImages);
            await folder.save();
    
            res.json({
                message: `Successfully uploaded ${processedImages.length} images`,
                folder
            });
        } catch (err) {
            // Clean up any remaining files
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            console.error("Image upload error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },
    
    bulkUpload: async (req, res) => {
        try {
            const folderIds = JSON.parse(req.body.folderIds);
            
            if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
                req.files.forEach(file => fs.unlinkSync(file.path));
                return res.status(400).json({ message: "No folders selected" });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No images uploaded" });
            }

            const processedImages = await Promise.all(req.files.map(async (file) => {
                const outputFilename = `resized-${Date.now()}-${file.filename}.jpg`;
                const outputFilePath = path.join(uploadDir, outputFilename);
                
                await sharp(file.path)
                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                    .toFormat('jpeg', { quality: 80 })
                    .toFile(outputFilePath);

                // Upload to S3
                const fileContent = fs.readFileSync(outputFilePath);
                const params = {
                    Bucket: bucketName,
                    Key: `uploads/${outputFilename}`,
                    Body: fileContent,
                    ContentType: 'image/jpeg',
                    ACL: 'public-read'
                };

                const s3Response = await s3.upload(params).promise();
                
                // Clean up local files
                fs.unlinkSync(file.path);
                fs.unlinkSync(outputFilePath);

                return {
                    name: file.originalname,
                    path: s3Response.Location
                };
            }));

            await Promise.all(folderIds.map(async (folderId) => {
                const folder = await Folder.findById(folderId);
                if (folder) {
                    folder.images.push(...processedImages);
                    await folder.save();
                }
            }));

            res.json({
                success: true,
                message: "Images uploaded and processed successfully",
                affectedFolders: folderIds.length
            });
        } catch (err) {
            req.files?.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            console.error("Bulk image upload error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    getFolders: async (req, res) => {
        try {
            let folders;
            if (req.user.role === "admin") {
                folders = await Folder.find();
            } else {
                folders = await Folder.find({
                    isDisabled: false,
                    images: { $exists: true, $ne: [] }
                });
            }
            res.json(folders);
        } catch (err) {
            console.error("Folder fetch error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    deleteImage: async (req, res) => {
        try {
            const { imagePath } = req.body;
            const folder = await Folder.findById(req.params.folderId);
            if (!folder) return res.status(404).json({ message: "Folder not found" });
    
            const imageIndex = folder.images.findIndex(img => img.path === imagePath);
            if (imageIndex === -1) return res.status(404).json({ message: "Image not found" });
    
            // Extract key from S3 URL
            // Example URL: https://bucket-name.s3.region.amazonaws.com/uploads/filename.jpg
            try {
                const s3UrlRegex = /https?:\/\/.*?\/(.+)/;
                const matches = imagePath.match(s3UrlRegex);
                if (matches && matches[1]) {
                    const key = matches[1];
    
                    // Delete from S3
                    const deleteParams = {
                        Bucket: bucketName,
                        Key: key
                    };
    
                    await s3.deleteObject(deleteParams).promise();
                } else {
                    console.warn("Could not extract S3 key from URL:", imagePath);
                }
            } catch (s3Error) {
                console.error("Error deleting from S3:", s3Error);
                // Continue anyway to remove from database
            }
    
            // Remove from database regardless of S3 status
            folder.images.splice(imageIndex, 1);
            await folder.save();
    
            res.json({ message: "Image deleted successfully" });
        } catch (err) {
            console.error("Error deleting image:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    updateImageName: async (req, res) => {
        try {
            const { folderId, imageId } = req.params;
            const { newName } = req.body;

            const folder = await Folder.findById(folderId);
            if (!folder) return res.status(404).json({ message: "Folder not found" });

            const image = folder.images.id(imageId);
            if (!image) return res.status(404).json({ message: "Image not found" });

            image.name = newName;
            await folder.save();

            res.json({ message: "Image name updated successfully", folder });
        } catch (err) {
            console.error("Image rename error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    toggleFolderStatus: async (req, res) => {
        try {
            const folder = await Folder.findById(req.params.id);
            if (!folder) {
                return res.status(404).json({ message: "Folder not found" });
            }

            folder.isDisabled = !folder.isDisabled;
            await folder.save();
            res.json({ message: `Folder ${folder.isDisabled ? 'disabled' : 'enabled'}`, folder });
        } catch (err) {
            console.error("Folder toggle error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    updateFolderName: async (req, res) => {
        try {
            const { folderId } = req.params;
            const { newName } = req.body;

            const folder = await Folder.findById(folderId);
            if (!folder) {
                return res.status(404).json({ message: "Folder not found" });
            }

            folder.name = newName;
            await folder.save();

            res.json({ message: "Folder name updated successfully", folder });
        } catch (err) {
            console.error("Folder rename error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    deleteFolder: async (req, res) => {
        try {
            const { folderId } = req.params;

            const folder = await Folder.findById(folderId);
            if (!folder) {
                return res.status(404).json({ message: "Folder not found" });
            }

            // Delete all images from S3
            await Promise.all(folder.images.map(async (image) => {
                if (image.path.includes(bucketName)) {
                    try {
                        // Extract key from S3 URL
                        const urlParts = image.path.split('/');
                        const key = urlParts.slice(3).join('/'); // Get the part after the bucket name

                        const deleteParams = {
                            Bucket: bucketName,
                            Key: key
                        };

                        await s3.deleteObject(deleteParams).promise();
                    } catch (err) {
                        console.error("Error deleting image from S3:", err);
                    }
                }
            }));

            await Folder.findByIdAndDelete(folderId);

            res.json({ message: "Folder deleted successfully" });
        } catch (err) {
            console.error("Folder deletion error:", err);
            res.status(500).json({ message: "Server error", error: err.message });
        }
    },

    uploadUsers: async (req, res) => {
        try {
            const users = req.body;

            const usersToInsert = await Promise.all(users.map(async (user) => {
                if (!user.username || !user.phone) {
                    throw new Error("Validation failed: username and phone are required.");
                }

                return {
                    username: user.username,
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    password: await bcrypt.hash(user.password, 10),
                };
            }));

            await User.insertMany(usersToInsert);

            res.status(201).json({ message: "Users uploaded successfully!" });
        } catch (error) {
            console.error("Error uploading users:", error);
            res.status(500).json({ message: "Server error: " + error.message });
        }
    }
};

module.exports = folderController;