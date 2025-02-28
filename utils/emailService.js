const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kedharcourseera@gmail.com',  // Replace with your Gmail email
    pass: 'kcvp rqdb praf sjbb'  // Replace with your App Password (not your actual password)
  },
  tls: {
    rejectUnauthorized: false // ✅ Allows self-signed certificates
  }
});

const sendResetEmail = async (email, otp) => {
  const mailOptions = {
    from: 'youremail@gmail.com',  // Must match the authenticated Gmail user
    to: email,
    subject: 'Password Reset Code',
    html: `
      <h1>Password Reset Request</h1>
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>This code will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = { sendResetEmail };
