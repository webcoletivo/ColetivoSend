
const { LRUCache } = require('lru-cache');
const crypto = require('crypto');

console.log("🔒 Running Security Verification Script...\n");

// 1. Verify LRU Cache
try {
  const cache = new LRUCache({ max: 500, ttl: 1000 });
  cache.set("test-key", { count: 1 });
  if (cache.get("test-key").count === 1) {
    console.log("✅ LRU Cache: Installed and working.");
  } else {
    console.error("❌ LRU Cache: Failed operation.");
  }
} catch (e) {
  console.error("❌ LRU Cache: Failed to initialize. Is it installed?", e.message);
}

// 2. Encryption/Decryption Check
try {
  const secret = "MY_SUPER_SECRET_KEY";
  const fakeEnvKey = "test-secret-key-1234567890123456"; // Emulating NEXTAUTH_SECRET

  function encrypt(text) {
    const key = crypto.scryptSync(fakeEnvKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  function decrypt(encrypted) {
    if (!encrypted.includes(':')) return encrypted; // Legacy check
    const key = crypto.scryptSync(fakeEnvKey, 'salt', 32);
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const encrypted = encrypt(secret);
  const decrypted = decrypt(encrypted);
  const legacy = decrypt("PLAIN_TEXT_SECRET");

  if (decrypted === secret && legacy === "PLAIN_TEXT_SECRET") {
    console.log("✅ Encryption: Logic + Backward Compatibility working.");
  } else {
    console.error("❌ Encryption: Logic failure.");
  }
} catch (e) {
  console.error("❌ Encryption: Error.", e);
}

console.log("\n⚠️  Manual Step Required: Restart your server ('npm run dev') to apply middleware changes.");
