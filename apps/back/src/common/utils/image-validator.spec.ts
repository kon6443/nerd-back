import { validateImageBuffer, MAX_IMAGE_SIZE_BYTES } from './image-validator';
import {
  ImageTooLargeErrorResponseDto,
  InvalidImageFormatErrorResponseDto,
} from '../../modules/story-session/dto/story-session-error.dto';

describe('image-validator', () => {
  it('정상 JPEG 매직바이트를 감지한다', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(validateImageBuffer(jpegBuffer)).toBe('image/jpeg');
  });

  it('정상 PNG 매직바이트를 감지한다', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(validateImageBuffer(pngBuffer)).toBe('image/png');
  });

  it('정상 WEBP 매직바이트를 감지한다', () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20, // VP8
    ]);
    expect(validateImageBuffer(webpBuffer)).toBe('image/webp');
  });

  it('확장자가 위조된 텍스트/실행파일은 InvalidImageFormatErrorResponseDto 를 던진다', () => {
    const fakeBuffer = Buffer.from('this is just a text file masked as image.jpg');
    expect(() => validateImageBuffer(fakeBuffer)).toThrow(InvalidImageFormatErrorResponseDto);
  });

  it('길이가 12바이트 미만인 파일은 거부한다', () => {
    const shortBuffer = Buffer.from([0xff, 0xd8, 0xff]);
    expect(() => validateImageBuffer(shortBuffer)).toThrow(InvalidImageFormatErrorResponseDto);
  });

  it('5MB 를 초과하는 버퍼는 ImageTooLargeErrorResponseDto 를 던진다', () => {
    const largeBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
    expect(() => validateImageBuffer(largeBuffer)).toThrow(ImageTooLargeErrorResponseDto);
  });
});
