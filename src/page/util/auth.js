import CryptoJS from "crypto-js";

const STORAGE_KEY = process.env.REACT_APP_LOGIN_COOKIE_CLIENT_SRECRET_KEY || "inventory_pos_admin_login";

class Auth {
  static encryptionKey = "encryption-key";

  setClientLogin(userData) {
    const encryptedData = this.encryptObject(userData);
    // Use localStorage instead of cookie
    localStorage.setItem(STORAGE_KEY, encryptedData);
  }

  getClientLogin() {
    const encryptedData = localStorage.getItem(STORAGE_KEY);
    return encryptedData ? this.decryptObject(encryptedData) : null;
  }

  removeClientLogin() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Set a cookie (for small data only)
  setCookie(name, value, hours) {
    let expires = "";
    if (hours) {
      let date = new Date();
      date.setTime(date.getTime() + hours * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
  }

  // Delete a cookie
  deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }

  // Get a cookie value
  getCookie(name) {
    let cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
      let [cookieName, cookieValue] = cookie.split("=");
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  }

  // Encrypt the object
  encryptObject(object) {
    const jsonString = JSON.stringify(object);
    return CryptoJS.AES.encrypt(jsonString, Auth.encryptionKey).toString();
  }

  // Decrypt the encrypted string
  decryptObject(encryptedString) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedString, Auth.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return decryptedString ? JSON.parse(decryptedString) : null;
    } catch (error) {
      console.error("Decryption failed:", error);
      return null;
    }
  }
}

export default Auth;
