export interface GenerateReferenceInput {
  front: Buffer;
  left?: Buffer;
  right?: Buffer;
  characterPrompt?: string;
}

export interface GeneratePageIllustrationInput {
  referenceImage: Buffer;
  baseImage?: Buffer;
  prompt: string;
  characterPrompt?: string;
  style?: string;
  aspectRatio?: string;
}

export interface ImageGenerationPort {
  /**
   * 얼굴 사진들(최소 정면 1장, 선택 좌/우)로부터 동화 주인공 캐릭터 레퍼런스 1장을 생성한다.
   * 반환된 버퍼는 S3에 저장되며, 원본 사진 버퍼는 호출 측에서 즉시 폐기된다.
   */
  generateReference(input: GenerateReferenceInput): Promise<Buffer>;

  /**
   * 캐릭터 레퍼런스와 장면 프롬프트를 합성하여 동화 본문 1장의 삽화를 생성한다.
   */
  generatePageIllustration(input: GeneratePageIllustrationInput): Promise<Buffer>;
}

export const IMAGE_GENERATION_PORT = Symbol('IMAGE_GENERATION_PORT');
