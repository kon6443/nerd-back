import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import { buildMysqlConnectionOptions } from '../common/database/typeorm.options';
import { validateDbEnv } from '../config/env.validation';
import { convertImageToWebp } from '../modules/story-session/convertImageToWebp';

/**
 * 사용자가 이미 만든 삽화(`session_page_images.image_key`)의 PNG 를 WebP 로 옮긴다.
 *
 *   pnpm sessions:webp -- --dry-run
 *   pnpm sessions:webp
 *
 * ## ⭐ 여기는 **손실(q85)** 이다 — 템플릿과 반대다
 *
 * 이 이미지들은 **표시 전용**이다. `storagePort.download()` 를 전수로 훑으면 모델 입력으로
 * 내려받는 것은 **얼굴 참조(`story_sessions.reference_image_key`)와 템플릿 기본 삽화
 * (`story_pages.base_image_key`) 둘뿐**이고, `session_page_images.image_key` 는 서명 URL 로
 * 화면에 보여줄 때만 쓰인다. 그래서 픽셀 동일성이 아니라 **용량**이 기준이다.
 *
 * 실측(13장): 원본 30665KB → 무손실 22744KB(26% 감소) / **q85 3807KB(88% 감소)**.
 *
 * 🚫 얼굴 참조 사진은 이 스크립트가 건드리지 않는다. 모델이 얼굴을 베끼는 원본이고 이미 JPEG
 *    (손실)이라, 다시 손실로 바꾸면 **가장 민감한 것 위에 열화를 덧씌운다.** 무손실은 18% 밖에
 *    못 줄여 대가에 비해 얻는 게 없다.
 *
 * ## 🚫 이 스크립트가 하지 않는 것
 * - **기존 PNG 를 지우지 않는다.** DB 키를 되돌리면 즉시 복구된다.
 * - **DB 를 건드리지 않는다.** `UPDATE` 는 `docs/sql/session-images-webp.up.sql` 로 사람이 실행한다.
 *
 * ⚠️ **`STORAGE_KEY_PREFIX` 를 붙이지 않는다.** 런타임이 저장한 키는 `upload()` 의 반환값이라
 *    이미 접두사를 포함한 **전체 키**다. 여기서 또 붙이면 아무도 찾지 못하는 자리에 쌓인다
 *    (2026-09-18 템플릿 전환에서 실제로 그랬다 — `docs/lessons.md`).
 */

interface ConversionResult {
  pngKey: string;
  webpKey: string;
  pngBytes: number;
  webpBytes: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 가 설정되지 않았다`);
  return value;
}

const kb = (bytes: number): string => `${Math.round(bytes / 1024)}KB`;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const bucket = requireEnv('S3_BUCKET_NAME');
  const s3 = new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });

  // 🚫 엔티티를 등록하지 않는다. `SessionPageImage` 는 `StorySession` 을 참조하고 그쪽은 또
  //    다른 엔티티를 참조해, 한 컬럼을 읽자고 관계 그래프 전체를 끌고 와야 한다
  //    (실측: `Entity metadata for SessionPageImage#session was not found`). 원시 SELECT 로 족하다.
  const dataSource = new DataSource({
    ...buildMysqlConnectionOptions(validateDbEnv(process.env)),
    entities: [],
  });
  await dataSource.initialize();

  let targets: string[];
  try {
    const rows = (await dataSource.query(
      `SELECT image_key FROM session_page_images WHERE image_key LIKE '%.png' ORDER BY id`,
    )) as Array<{ image_key: string }>;
    targets = [...new Set(rows.map((row) => row.image_key))];
  } finally {
    await dataSource.destroy();
  }

  if (targets.length === 0) {
    console.log('PNG 인 삽화가 없다. 이미 전부 webp 다.');
    return;
  }

  console.log(`대상 ${targets.length}장${dryRun ? ' (드라이런 — 업로드하지 않는다)' : ''}\n`);

  const results: ConversionResult[] = [];
  for (const pngKey of targets) {
    const webpKey = pngKey.replace(/\.png$/i, '.webp');
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: pngKey }));
      if (!res.Body) throw new Error('본문 없음');
      const png = Buffer.from(await res.Body.transformToByteArray());
      // 표시 전용이라 기본값(q85)을 그대로 쓴다 — 위 주석의 근거 참조.
      const webp = await convertImageToWebp(png);

      if (!dryRun) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: webpKey,
            Body: webp,
            ContentType: 'image/webp',
            CacheControl: 'private, max-age=86400, no-transform',
          }),
        );
      }

      results.push({ pngKey, webpKey, pngBytes: png.length, webpBytes: webp.length });
      console.log(
        `✓ ${pngKey}\n  ${kb(png.length)} → ${kb(webp.length)} ` +
          `(${(100 - (webp.length / png.length) * 100).toFixed(0)}% 감소)`,
      );
    } catch (error: unknown) {
      // 🚫 조용히 넘기지 않는다. 객체가 없는 행이 실제로 있다(레거시 세션) — 그 사실이 보여야 한다.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${pngKey} — ${message}`);
    }
  }

  if (results.length === 0) return;

  const totalPng = results.reduce((sum, r) => sum + r.pngBytes, 0);
  const totalWebp = results.reduce((sum, r) => sum + r.webpBytes, 0);
  console.log(
    `\n합계 ${results.length}장: ${kb(totalPng)} → ${kb(totalWebp)} ` +
      `(${(100 - (totalWebp / totalPng) * 100).toFixed(0)}% 감소)`,
  );
  console.log(
    dryRun
      ? '\n드라이런이라 업로드하지 않았다. 실제로 올리려면 --dry-run 없이 다시 돌린다.'
      : '\n업로드 완료. DB 는 아래로 바꾼다 (사람이 실행):\n' +
          '  pnpm db:sql docs/sql/session-images-webp.up.sql',
  );
}

main().catch((error: unknown) => {
  console.error('변환 실패:', error instanceof Error ? error.message : error);
  process.exit(1);
});
