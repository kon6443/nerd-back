import sharp from 'sharp';
import { convertImageToWebp } from './convertImageToWebp';

describe('convertImageToWebp', () => {
  it('래스터 이미지를 quality 85 WebP로 변환한다', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 4,
        background: { r: 80, g: 120, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const webpBuffer = await convertImageToWebp(pngBuffer);
    const metadata = await sharp(webpBuffer).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(64);
    expect(metadata.height).toBe(48);
  });

  it('지원하지 않는 입력은 변환 오류를 반환한다', async () => {
    await expect(convertImageToWebp(Buffer.from('not-an-image'))).rejects.toThrow();
  });
});
