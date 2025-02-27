const AWS = require('aws-sdk');
require('dotenv').config(); // Ensure you have dotenv configured

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,  // Load from environment variables
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_BUCKET_NAME;

module.exports = { s3, bucketName };
