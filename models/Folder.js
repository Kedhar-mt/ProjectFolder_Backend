const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },  // Store the original file name
  path: { 
    type: String, 
    required: true 
  }  // Store the S3 URL of the image
});

const folderSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  images: [imageSchema],  // Array of image objects
  isDisabled: { 
    type: Boolean, 
    default: false 
  }  // Flag to control visibility for non-admin users
}, { 
  timestamps: true 
});

// Add a virtual property to get image count
folderSchema.virtual('imageCount').get(function() {
  return this.images.length;
});

// Add any middleware or methods needed based on the controller

// Ensure empty folder gets returned correctly
folderSchema.set('toJSON', { 
  virtuals: true,
  versionKey: false,
  transform: function(doc, ret) {
    if (!ret.images) {
      ret.images = [];
    }
    return ret;
  }
});

module.exports = mongoose.model("Folder", folderSchema);