import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { convertImageToWebp } from '../modules/story-session/convertImageToWebp';
import { OFFICIAL_STORIES } from './official-stories';

/**
 * 템플릿 기본 삽화를 PNG → WebP 로 변환해 **새 키로** 올린다.
 *
 *   pnpm templates:webp -- --dry-run
 *   pnpm templates:webp -- --slug jack-and-beanstalk
 *
 * ⚠️ `tsx` 는 이 저장소에 없다. 다른 스크립트와 같이 **빌드 후 `dist` 를 실행**한다.
 * ⚠️ `pnpm back dev` 가 떠 있으면 `dist` 를 서로 덮어쓴다 — 먼저 끄고 돌린다 (`docs/lessons.md`).
 *
 * ## 왜 하는가
 * 템플릿 삽화는 **페이지를 만들 때마다 매번 다운로드**되고(캐시 없음), 그대로 base64 로
 * 모델 요청 본문에 실린다. 스토리지 용량보다 **요청 크기와 생성 시간**에 효과가 크다.
 *
 * ⭐ **무손실로 변환한다.** 손실(q85)이면 87% 까지 줄지만 최대 픽셀차가 64 라 결과 삽화에
 * 영향을 줄 수 있다. 무손실은 31% 감소에 그치지만 **픽셀이 원본과 완전히 같다**(실측).
 * 모델 입력에서 크기보다 동일성이 우선이다.
 *
 * ## 🚫 이 스크립트가 하지 않는 것
 * - **기존 PNG 를 지우지 않는다.** 되돌릴 길을 남긴다 — DB 키를 옛 값으로 되돌리면 즉시 복구된다.
 * - **DB 를 건드리지 않는다.** `story_pages.base_image_key` 갱신은 사람이 SQL 로 한다
 *   (이 저장소는 전 환경이 같은 DB 를 공유하므로 쓰기는 사람이 실행한다 — `apps/back/CLAUDE.md`).
 *   스크립트는 실행 후 **그 UPDATE 문을 출력**한다.
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

function toWebpKey(pngKey: string): string {
  return pngKey.replace(/\.png$/i, '.webp');
}

/**
 * 시드 키에서 **원본 PNG 키**를 얻는다.
 *
 * ⚠️ 시드는 전환이 끝나면 `.webp` 를 가리킨다. 그때 `.png` 로 끝나는 키만 대상으로 잡으면
 * **대상 0장**이 되어 스크립트를 다시 돌릴 수 없다(2026-09-18 실제로 그랬다). 어느 쪽 확장자든
 * PNG 원본으로 정규화해, 이 스크립트가 **몇 번을 돌려도 같은 결과**를 내게 한다.
 */
function toPngKey(key: string): string {
  return key.replace(/\.webp$/i, '.png');
}

const kb = (bytes: number): string => `${Math.round(bytes / 1024)}KB`;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const slugIndex = process.argv.indexOf('--slug');
  const onlySlug = slugIndex >= 0 ? process.argv[slugIndex + 1] : undefined;

  const bucket = requireEnv('S3_BUCKET_NAME');
  // 🚫 **`STORAGE_KEY_PREFIX` 를 붙이지 않는다.** 붙였다가 실제로 깨졌다(2026-09-18).
  //    `S3StorageAdapter` 는 **`upload()` 에서만** 접두사를 붙이고 `download()`·`getPresignedUrl()`
  //    은 키를 **그대로** 쓴다. 그래서 DB·시드에 적힌 템플릿 키(`templates/...`)가 곧 객체 키다.
  //    여기서 접두사를 붙이면 읽기는 `prod/` 사본이 있어 우연히 통과하고, 쓰기만 `prod/` 로 가서
  //    **앱이 영원히 찾지 못하는 자리에 webp 가 쌓인다.** 출력되는 SQL 과도 어긋난다.
  const s3 = new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });

  // 시드 데이터가 키의 정본이다 — DB 를 읽지 않아도 대상을 알 수 있다.
  //
  // ⚠️ **본편 `pages` 만 보면 안 된다.** 6쪽 비하인드는 `afterStory.choices[].page` 안에 따로 있고,
  //    표지는 `coverImageKey` 다. 처음에 `pages` 만 훑어 5장만 잡혔다 — 비하인드 2장이 PNG 로
  //    남으면 그 분기를 고른 사용자만 옛 경로를 타서 **한쪽에서만 느린** 상태가 된다.
  const targets = [
    ...new Set(
      OFFICIAL_STORIES.filter((story) => !onlySlug || story.slug === onlySlug)
        .flatMap((story) => [
          story.coverImageKey,
          ...story.pages.map((page) => page.baseImageKey),
          ...story.afterStory.choices.map((choice) => choice.page.baseImageKey),
        ])
        .filter((key): key is string => typeof key === 'string')
        .map(toPngKey),
    ),
  ].filter((key) => key.toLowerCase().endsWith('.png'));

  if (targets.length === 0) {
    console.log('대상이 없다. --slug 값을 확인하라.');
    return;
  }

  console.log(`대상 ${targets.length}장${dryRun ? ' (드라이런 — 업로드하지 않는다)' : ''}\n`);

  const results: ConversionResult[] = [];
  for (const pngKey of targets) {
    const webpKey = toWebpKey(pngKey);
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: pngKey }));
      if (!res.Body) throw new Error('본문 없음');
      const png = Buffer.concat(await res.Body.transformToByteArray().then((a) => [Buffer.from(a)]));
      // ⭐ **무손실이다.** 템플릿은 모델 입력이라 손실 압축이 결과 삽화에 영향을 줄 수 있다.
      //    무손실이면 디코딩 후 픽셀이 원본과 완전히 같아 영향이 원리적으로 0 이다.
      const webp = await convertImageToWebp(png, { lossless: true });

      if (!dryRun) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: webpKey,
            Body: webp,
            ContentType: 'image/webp',
          }),
        );
      }

      results.push({ pngKey, webpKey, pngBytes: png.length, webpBytes: webp.length });
      const saved = (100 - (webp.length / png.length) * 100).toFixed(0);
      console.log(`✓ ${pngKey}\n  ${kb(png.length)} → ${kb(webp.length)} (${saved}% 감소)`);
    } catch (error: unknown) {
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

  // 🚫 여기서 DB 를 고치지 않는다. 사람이 확인하고 실행할 SQL 을 출력만 한다.
  //
  // ⚠️ **표지는 다른 테이블이다** — `story_templates.cover_image_key`. 처음에는 `story_pages` 만
  //    출력해서, 표지가 `page-1` 과 같은 키라 변환은 됐는데 **갱신 SQL 이 빠졌다.** 그러면
  //    시드 파일은 webp 를 가리키는데 DB 의 표지만 png 로 남아 둘이 어긋난다.
  //
  // ⚠️ **표지 UPDATE 는 0건일 수 있고 그게 정상이다.** 운영 DB 의 표지는 시드가 아니라 별도
  //    업로드 경로로 들어가 `prod/templates/<slug>/cover-<hash>.webp` 같은 키를 갖는다(실측).
  //    시드 키와 겹치지 않으므로 WHERE 가 매칭되지 않는다 — 실패가 아니라 "바꿀 것이 없음"이다.
  const coverKeys = new Set(
    OFFICIAL_STORIES.filter((story) => !onlySlug || story.slug === onlySlug)
      .map((story) => story.coverImageKey)
      .filter((key): key is string => typeof key === 'string')
      .map(toPngKey)
      .filter((key) => key.toLowerCase().endsWith('.png')),
  );

  const statements = (reverse: boolean): string[] => {
    const lines = results.map((r) => {
      const [from, to] = reverse ? [r.webpKey, r.pngKey] : [r.pngKey, r.webpKey];
      return `UPDATE story_pages SET base_image_key = '${to}' WHERE base_image_key = '${from}';`;
    });
    for (const pngKey of coverKeys) {
      const webpKey = toWebpKey(pngKey);
      const [from, to] = reverse ? [webpKey, pngKey] : [pngKey, webpKey];
      lines.push(
        `UPDATE story_templates SET cover_image_key = '${to}' WHERE cover_image_key = '${from}';`,
      );
    }
    return lines;
  };

  console.log('\n--- 아래 SQL 을 확인 후 사람이 실행한다 ---');
  console.log(statements(false).join('\n'));
  console.log('\n--- 되돌리려면 ---');
  console.log(statements(true).join('\n'));
}

main().catch((error: unknown) => {
  console.error('변환 실패:', error instanceof Error ? error.message : error);
  process.exit(1);
});
