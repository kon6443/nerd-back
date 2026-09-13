import sharp from 'sharp';

const WEBP_QUALITY = 85;

export async function convertImageToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer();
}
