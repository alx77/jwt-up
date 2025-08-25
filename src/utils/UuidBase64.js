var uuid = require('uuid');

exports.encode = function encode(uuid) {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    
    // Convert to Base64 and remove the trailing '=='
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    return base64.substring(0, base64.length - 2);
};

exports.decode = function decode(shortUuid) {
const repaired = shortUuid.trim().substring(0, 22) + '==';
        const binaryString = atob(repaired);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Convert bytes to two 64-bit numbers
        const dataView = new DataView(bytes.buffer);
        const high = dataView.getBigUint64(0);
        const low = dataView.getBigUint64(8);
        
        // Convert to UUID string format (for Node.js or environments with UUID support)
        const hexHigh = high.toString(16).padStart(16, '0');
        const hexLow = low.toString(16).padStart(16, '0');
        return `${hexHigh.substring(0, 8)}-${hexHigh.substring(8, 12)}-${hexHigh.substring(12, 16)}-${hexLow.substring(0, 4)}-${hexLow.substring(4, 16)}`;};