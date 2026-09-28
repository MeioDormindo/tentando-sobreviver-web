// Encoder/decoder PNG mínimo (RGBA 8 bits), sem dependências: só o zlib do Node.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array/Uint8ClampedArray com width*height*4 bytes. */
export function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // sem filtro
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodifica um PNG (8 bits, sem interlace) para RGBA. Suporta grayscale, RGB, paleta e RGBA. */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('Assinatura PNG inválida.');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null;
  let paletteAlpha = null;
  const idatParts = [];
  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      paletteAlpha = data;
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 8 + len + 4;
  }
  if (bitDepth !== 8) throw new Error(`decodePng: só suporta 8 bits por canal (veio ${bitDepth}).`);
  if (interlace !== 0) throw new Error('decodePng: imagem interlaçada (Adam7) não é suportada.');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`decodePng: colorType ${colorType} não suportado.`);

  const raw = inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const bpp = channels; // bytes por pixel (8 bits/canal)
  const out = new Uint8ClampedArray(width * height * 4);
  let prevRow = Buffer.alloc(stride);
  let srcOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = raw[srcOffset];
    srcOffset += 1;
    const row = Buffer.from(raw.subarray(srcOffset, srcOffset + stride));
    srcOffset += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;
      let value = row[x];
      switch (filterType) {
        case 1: value = (value + a) & 0xff; break;
        case 2: value = (value + b) & 0xff; break;
        case 3: value = (value + ((a + b) >> 1)) & 0xff; break;
        case 4: value = (value + paeth(a, b, c)) & 0xff; break;
      }
      row[x] = value;
    }

    for (let x = 0; x < width; x++) {
      const srcPixel = x * channels;
      const dst = (y * width + x) * 4;
      if (colorType === 6) {
        out[dst] = row[srcPixel]; out[dst + 1] = row[srcPixel + 1];
        out[dst + 2] = row[srcPixel + 2]; out[dst + 3] = row[srcPixel + 3];
      } else if (colorType === 2) {
        out[dst] = row[srcPixel]; out[dst + 1] = row[srcPixel + 1];
        out[dst + 2] = row[srcPixel + 2]; out[dst + 3] = 255;
      } else if (colorType === 0) {
        out[dst] = out[dst + 1] = out[dst + 2] = row[srcPixel]; out[dst + 3] = 255;
      } else if (colorType === 4) {
        out[dst] = out[dst + 1] = out[dst + 2] = row[srcPixel]; out[dst + 3] = row[srcPixel + 1];
      } else if (colorType === 3) {
        const index = row[srcPixel];
        out[dst] = palette[index * 3]; out[dst + 1] = palette[index * 3 + 1]; out[dst + 2] = palette[index * 3 + 2];
        out[dst + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
      }
    }
    prevRow = row;
  }
  return { width, height, rgba: out };
}
