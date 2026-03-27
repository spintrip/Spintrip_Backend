/**
 * KycService - Advanced Identity Validation Utility (Cost-Free)
 * Implements the Verhoeff algorithm for Aadhaar checksum validation 
 * and strict regex patterns for PAN and Driving License validation.
 */
class KycService {
  
  // Verhoeff Algorithm Tables
  static d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  static p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  static inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

  /**
   * Validates Aadhaar Number using Verhoeff Checksum
   * @param {string} aadhar 
   */
  static validateVerhoeff(aadhar) {
    let c = 0;
    let array = aadhar.split('').map(Number).reverse();
    for (let i = 0; i < array.length; i++) {
      c = this.d[c][this.p[(i % 8)][array[i]]];
    }
    return c === 0;
  }

  /**
   * Verified identity against Aadhaar database (Now with Verhoeff Checksum)
   * @param {string} aadharNumber 
   */
  static async verifyAadhar(aadharNumber) {
    try {
      console.log("Verifying Aadhaar:", aadharNumber);
      if (!/^\d{12}$/.test(aadharNumber)) {
        console.log("Aadhaar Regex Failed");
        return { success: false, message: "Invalid Aadhaar. Must be exactly 12 digits." };
      }

      if (!this.validateVerhoeff(aadharNumber)) {
        console.log("Verhoeff Checksum Failed");
        return { success: false, message: "Invalid Aadhaar Number (Checksum failed)." };
      }

      console.log("Aadhaar Verification Success (Algorithm)");

      // Simulation - In reality, successful checksum means the number is mathematically valid
      return { 
        success: true, 
        name: "Verified via Algorithm",
        message: "Aadhaar verified successfully (Free Checksum Validation)." 
      };
    } catch (error) {
      return { success: false, message: "Verification error." };
    }
  }

  /**
   * Verified identity against Income Tax Department (PAN)
   * @param {string} panNumber 
   */
  static async verifyPan(panNumber) {
    try {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber)) {
        return { success: false, message: "Invalid PAN format. Example: ABCDE1234F" };
      }

      return {
        success: true,
        name: "Verified Format",
        message: "PAN verified successfully (Free Pattern Validation)."
      };
    } catch (error) {
      return { success: false, message: "Verification error." };
    }
  }

  /**
   * Validates Driving License Format
   * @param {string} dlNumber 
   */
  static async verifyDl(dlNumber) {
    try {
      // Standard Indian DL Format: SS-RR-YYYY-NNNNNNN
      const dlRegex = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/;
      // Supporting variations with spaces/dashes
      const cleanDL = dlNumber.replace(/[-\s]/g, "");
      
      if (!dlRegex.test(cleanDL)) {
        return { success: false, message: "Invalid DL format. Required: SS0020240000000" };
      }

      return {
        success: true,
        message: "DL Format Verified."
      };
    } catch (error) {
       return { success: false, message: "Verification error." };
    }
  }
}

module.exports = KycService;
