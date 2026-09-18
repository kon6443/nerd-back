import sharp from 'sharp';

const WEBP_QUALITY = 85;

export interface WebpOptions {
  /**
   * 무손실로 변환한다. 디코딩하면 **원본과 픽셀이 완전히 같다**(실측 확인).
   *
   * ⚠️ **모델에 입력으로 들어가는 이미지는 무손실이어야 한다.** 손실 압축은 결과 삽화에
   * 영향을 줄 수 있고, 그 영향은 눈으로 확인하기 전까지 알 수 없다. 반대로 **사용자에게
   * 보여주기만 하는 결과물**은 손실이어도 무방하다 — 그쪽은 용량이 더 중요하다.
   *
   * 실측(템플릿 1024x1536 일러스트 기준):
   * - 무손실: 3220KB → 2215KB (31% 감소), 최대 픽셀차 **0**
   * - q85:    3220KB → 404KB (87% 감소), 최대 픽셀차 **64**
   */
  lossless?: boolean;
}

/**
 * WebP 로 변환한다.
 *
 * 🚫 PNG 재압축으로 대신하지 않는다 — 원본이 이미 잘 압축돼 있어 **오히려 커진다**
 *    (실측: 3220KB → 4301KB). `sharp` 의 `png({ effort })` 는 팔레트 양자화를 켜서
 *    71% 줄지만 그건 무손실이 아니다(최대 픽셀차 54).
 */
export async function convertImageToWebp(buffer: Buffer, options?: WebpOptions): Promise<Buffer> {
  const image = sharp(buffer);
  return options?.lossless
    ? image.webp({ lossless: true }).toBuffer()
    : image.webp({ quality: WEBP_QUALITY }).toBuffer();
}
