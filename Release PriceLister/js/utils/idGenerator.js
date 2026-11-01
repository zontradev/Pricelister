const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const generateUniqueId = (legacyPrefixIgnored = '') => {
    let t = Date.now();
    let id = '';
    
    // First 7 characters based on timestamp
    for (let i = 0; i < 7; i++) {
        id = BASE64_CHARS.charAt(t % 64) + id;
        t = Math.floor(t / 64);
    }
    
    // Remaining 6 characters of randomness
    for (let i = 0; i < 6; i++) {
        id += BASE64_CHARS.charAt(Math.floor(Math.random() * 64));
    }
    
    return id;
};
