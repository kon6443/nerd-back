import { Injectable } from '@nestjs/common';
import type { GenerateReferenceInput, ImageGenerationPort } from '../port/image-generation.port';

// 개발·테스트용 귀여운 동화 주인공 캐릭터 SVG 일러스트
const MOCK_REFERENCE_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#BFDBFE"/>
        <stop offset="100%" stop-color="#E0E7FF"/>
      </linearGradient>
      <radialGradient id="face" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF5EB"/>
        <stop offset="100%" stop-color="#FED7AA"/>
      </radialGradient>
      <linearGradient id="hair" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#78350F"/>
        <stop offset="100%" stop-color="#451A03"/>
      </linearGradient>
    </defs>
    <!-- 배경 카드 -->
    <rect width="400" height="400" rx="32" fill="url(#bg)"/>
    <!-- 반짝이 별 -->
    <circle cx="80" cy="80" r="10" fill="#FBBF24" opacity="0.9"/>
    <circle cx="320" cy="100" r="12" fill="#FBBF24" opacity="0.9"/>
    <circle cx="90" cy="310" r="8" fill="#FBBF24" opacity="0.9"/>
    <!-- 머리카락 뒤쪽 -->
    <circle cx="200" cy="180" r="115" fill="url(#hair)"/>
    <!-- 귀 -->
    <circle cx="100" cy="200" r="24" fill="#FED7AA"/>
    <circle cx="300" cy="200" r="24" fill="#FED7AA"/>
    <!-- 얼굴 -->
    <circle cx="200" cy="200" r="95" fill="url(#face)"/>
    <!-- 앞머리 -->
    <path d="M 105 160 Q 150 110 200 120 Q 250 110 295 160 Q 260 140 200 140 Q 140 140 105 160 Z" fill="url(#hair)"/>
    <!-- 왕관/모자 -->
    <path d="M 140 120 L 170 80 L 200 105 L 230 80 L 260 120 Z" fill="#F59E0B" stroke="#D97706" stroke-width="4"/>
    <circle cx="200" cy="70" r="10" fill="#EF4444"/>
    <!-- 볼터치 -->
    <ellipse cx="140" cy="225" rx="16" ry="10" fill="#F43F5E" opacity="0.4"/>
    <ellipse cx="260" cy="225" rx="16" ry="10" fill="#F43F5E" opacity="0.4"/>
    <!-- 눈 -->
    <ellipse cx="155" cy="190" rx="10" ry="14" fill="#1E293B"/>
    <circle cx="158" cy="185" r="4" fill="#FFFFFF"/>
    <ellipse cx="245" cy="190" rx="10" ry="14" fill="#1E293B"/>
    <circle cx="248" cy="185" r="4" fill="#FFFFFF"/>
    <!-- 미소 -->
    <path d="M 175 225 Q 200 255 225 225" fill="none" stroke="#E11D48" stroke-width="6" stroke-linecap="round"/>
    <!-- 주인공 라벨 뱃지 -->
    <rect x="90" y="325" width="220" height="42" rx="21" fill="#1E293B" opacity="0.85"/>
    <text x="200" y="352" font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle" font-family="sans-serif">✨ 주인공 캐릭터</text>
  </svg>`,
  'utf-8',
);

/**
 * 개발·테스트 전용 Mock 이미지 어댑터.
 * 외부 AI API 호출 비용(0원) 및 네트워크 지연 없이 사랑스러운 주인공 캐릭터 레퍼런스 일러스트를 반환한다.
 */
@Injectable()
export class MockImageAdapter implements ImageGenerationPort {
  async generateReference(_input: GenerateReferenceInput): Promise<Buffer> {
    return Buffer.from(MOCK_REFERENCE_SVG);
  }
}
