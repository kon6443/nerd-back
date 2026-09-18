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

  // ⭐ 템플릿은 **모델 입력**이다. 손실 압축은 결과 삽화에 영향을 줄 수 있고 그 영향은
  //    눈으로 보기 전에는 알 수 없다. 무손실이면 디코딩 후 픽셀이 원본과 같아 영향이 0 이다.
  //    이 옵션이 조용히 손실로 바뀌면 그 사실이 화면에서만 드러나므로 여기서 고정한다.
  describe('무손실 옵션 ⭐', () => {
    /** 그라데이션 — 단색은 손실 압축에서도 그대로라 차이를 못 잡는다. */
    const makeGradient = async () => {
      const width = 64;
      const height = 48;
      const pixels = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 3;
          pixels[i] = (x * 4) % 256;
          pixels[i + 1] = (y * 5) % 256;
          pixels[i + 2] = (x * y) % 256;
        }
      }
      return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
    };

    const maxChannelDiff = (a: Buffer, b: Buffer): number => {
      if (a.length !== b.length) return Number.POSITIVE_INFINITY;
      let max = 0;
      for (let i = 0; i < a.length; i++) {
        const diff = Math.abs(a[i] - b[i]);
        if (diff > max) max = diff;
      }
      return max;
    };

    it('lossless 면 원본과 픽셀이 완전히 같다', async () => {
      const png = await makeGradient();

      const webp = await convertImageToWebp(png, { lossless: true });

      const original = await sharp(png).raw().toBuffer();
      const converted = await sharp(webp).raw().toBuffer();
      expect(maxChannelDiff(original, converted)).toBe(0);
    });

    it('기본(손실)은 픽셀이 달라진다 — 두 모드가 실제로 다름을 고정한다', async () => {
      const png = await makeGradient();

      const lossy = await convertImageToWebp(png);

      const original = await sharp(png).raw().toBuffer();
      const converted = await sharp(lossy).raw().toBuffer();
      expect(maxChannelDiff(original, converted)).toBeGreaterThan(0);
    });

    it('lossless 여도 webp 포맷이다', async () => {
      const png = await makeGradient();

      const webp = await convertImageToWebp(png, { lossless: true });

      expect((await sharp(webp).metadata()).format).toBe('webp');
    });
  });
});
