// Generate valid standalone PNG icons using pure Node.js and zlib
import fs from 'node:fs';
import zlib from 'node:zlib';

function createPng(size, r, g, b) {
  const width = size;
  const height = size;

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // non-interlaced

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with scanline filter byte 0
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  const radius = size * 0.42;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded app icon shape
      const isInIcon = dist <= radius || (Math.abs(dx) < radius && Math.abs(dy) < radius);

      // Pill shape inside
      const pillWidth = size * 0.12;
      const pillHeight = size * 0.35;
      const isInPill = Math.abs(dx) <= pillWidth && Math.abs(dy) <= pillHeight;
      const isInCross = Math.abs(dx) <= pillHeight && Math.abs(dy) <= pillWidth;

      if (isInPill || isInCross) {
        rawData[pixelOffset] = 255; // White cross/pill
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
        rawData[pixelOffset + 3] = 255;
      } else if (isInIcon) {
        rawData[pixelOffset] = r; // Teal (#0D9488)
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0; // Transparent background
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeInt32BE(crc, 8 + length);
  return buffer;
}

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// Generate icons
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/icon-192.png', createPng(192, 13, 148, 136));
fs.writeFileSync('public/icon-512.png', createPng(512, 13, 148, 136));
fs.writeFileSync('public/icon-maskable-512.png', createPng(512, 13, 148, 136));
console.log('Icons generated successfully!');
