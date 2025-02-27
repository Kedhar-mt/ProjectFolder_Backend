// passwordValidator.js
const passwordStrength = (password) => {
    // Regex for password strength:
    // - At least one uppercase letter (A-Z)
    // - At least one lowercase letter (a-z)
    // - At least one number (0-9)
    // - At least one special character (@, $, !, %, *, ?, &, etc.)
    // - Minimum length of 8 characters
    console.log(`Checking password: ${password}`);
    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };
  
  module.exports = { passwordStrength };
  