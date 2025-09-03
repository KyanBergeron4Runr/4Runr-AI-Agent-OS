"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDEK = generateDEK;
exports.wrapDEK = wrapDEK;
exports.unwrapDEK = unwrapDEK;
exports.encryptWithEnvelope = encryptWithEnvelope;
exports.decryptWithEnvelope = decryptWithEnvelope;
exports.serializeEnvelope = serializeEnvelope;
exports.deserializeEnvelope = deserializeEnvelope;
exports.encryptString = encryptString;
exports.decryptString = decryptString;
exports.encryptObject = encryptObject;
exports.decryptObject = decryptObject;
const crypto = __importStar(require("crypto"));
// Generate a new Data Encryption Key (DEK)
function generateDEK() {
    return crypto.randomBytes(32); // 256-bit key for AES-256
}
// Wrap a DEK with a Key Encryption Key (KEK)
function wrapDEK(dek, kek) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    let wrappedKey = cipher.update(dek);
    wrappedKey = Buffer.concat([wrappedKey, cipher.final()]);
    return {
        wrappedKey,
        iv
    };
}
// Unwrap a DEK with a Key Encryption Key (KEK)
function unwrapDEK(wrappedKey, iv, kek) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    let dek = decipher.update(wrappedKey);
    dek = Buffer.concat([dek, decipher.final()]);
    return dek;
}
// Encrypt data using envelope encryption
function encryptWithEnvelope(data, kek) {
    // Generate a new DEK for this encryption
    const dek = generateDEK();
    // Encrypt the data with the DEK
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    // Wrap the DEK with the KEK
    const { wrappedKey, iv: wrapIv } = wrapDEK(dek, kek);
    return {
        encryptedData,
        encryptedKey: wrappedKey,
        iv: wrapIv,
        tag
    };
}
// Decrypt data using envelope encryption
function decryptWithEnvelope(envelope, kek) {
    // Unwrap the DEK with the KEK
    const dek = unwrapDEK(envelope.encryptedKey, envelope.iv, kek);
    // Decrypt the data with the DEK
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, envelope.iv);
    decipher.setAuthTag(envelope.tag);
    let decryptedData = decipher.update(envelope.encryptedData);
    decryptedData = Buffer.concat([decryptedData, decipher.final()]);
    return {
        decryptedData,
        dek
    };
}
// Serialize envelope result to string (for storage/transmission)
function serializeEnvelope(envelope) {
    const serialized = {
        encryptedData: envelope.encryptedData.toString('base64'),
        encryptedKey: envelope.encryptedKey.toString('base64'),
        iv: envelope.iv.toString('base64'),
        tag: envelope.tag.toString('base64')
    };
    return JSON.stringify(serialized);
}
// Deserialize envelope result from string
function deserializeEnvelope(serialized) {
    const parsed = JSON.parse(serialized);
    return {
        encryptedData: Buffer.from(parsed.encryptedData, 'base64'),
        encryptedKey: Buffer.from(parsed.encryptedKey, 'base64'),
        iv: Buffer.from(parsed.iv, 'base64'),
        tag: Buffer.from(parsed.tag, 'base64')
    };
}
// Utility function to encrypt a string
function encryptString(data, kek) {
    const dataBuffer = Buffer.from(data, 'utf-8');
    const envelope = encryptWithEnvelope(dataBuffer, kek);
    return serializeEnvelope(envelope);
}
// Utility function to decrypt a string
function decryptString(encryptedData, kek) {
    const envelope = deserializeEnvelope(encryptedData);
    const result = decryptWithEnvelope(envelope, kek);
    return result.decryptedData.toString('utf-8');
}
// Utility function to encrypt an object (JSON)
function encryptObject(obj, kek) {
    const jsonString = JSON.stringify(obj);
    return encryptString(jsonString, kek);
}
// Utility function to decrypt an object (JSON)
function decryptObject(encryptedData, kek) {
    const jsonString = decryptString(encryptedData, kek);
    return JSON.parse(jsonString);
}
//# sourceMappingURL=envelope.js.map