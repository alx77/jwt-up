export function encode(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  const base64 = Buffer.from(bytes).toString("base64");
  return base64.substring(0, base64.length - 2);
}

export function decode(shortUuid: string): string {
  const repaired = shortUuid.trim().substring(0, 22) + "==";
  const bytes = Buffer.from(repaired, "base64");
  const dataView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const high = dataView.getBigUint64(0);
  const low = dataView.getBigUint64(8);
  const hexHigh = high.toString(16).padStart(16, "0");
  const hexLow = low.toString(16).padStart(16, "0");
  return `${hexHigh.substring(0, 8)}-${hexHigh.substring(8, 12)}-${hexHigh.substring(12, 16)}-${hexLow.substring(0, 4)}-${hexLow.substring(4, 16)}`;
}

export default { encode, decode };
