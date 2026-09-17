export interface StoragePort {
  /**
   * 객체를 업로드하고 식별 키(key)를 반환한다.
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * 클라이언트가 스토리지에서 직접 이미지를 안전하게 내려받을 수 있는 만료 서명 URL을 발급한다.
   * signingDate가 없으면 현재 시각을 쓴다. 지정 시 만료는 해당 시각부터 계산한다.
   */
  getPresignedUrl(key: string, expiresInSeconds?: number, signingDate?: Date): Promise<string>;

  /**
   * 객체를 다운로드하여 버퍼로 반환한다 (레퍼런스 이미지 참조용).
   */
  download(key: string): Promise<Buffer>;

  /**
   * 객체를 삭제한다.
   */
  delete(key: string): Promise<void>;
}

export const STORAGE_PORT = Symbol('STORAGE_PORT');
