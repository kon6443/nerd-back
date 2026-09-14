import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TextToSpeechPort } from '../port/textToSpeechPort';

export const OPENROUTER_TTS_TIMEOUT_MS = 30_000;
export const OPENROUTER_TTS_MAX_INPUT_LENGTH = 2_000;
const OPENROUTER_TTS_ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';
const AUDIO_TAG_PATTERN = /^\[[a-z-]+\]$/i;

export function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

function parsePcmParams(contentType: string): { sampleRate: number; channels: number } {
  const rateMatch = contentType.match(/rate=(\d+)/);
  const channelsMatch = contentType.match(/channels=(\d+)/);
  return {
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: channelsMatch ? Number(channelsMatch[1]) : 1,
  };
}

@Injectable()
export class OpenRouterTextToSpeechAdapter implements TextToSpeechPort {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENROUTER_API_KEY');
    this.model =
      config.get<string>('OPENROUTER_TTS_MODEL') || 'google/gemini-3.1-flash-tts-preview';
  }

  isAvailable(): boolean {
    return this.apiKey !== undefined && this.apiKey.length > 0;
  }

  async synthesize(input: {
    text: string;
    voiceId: string;
    settings: Record<string, string | number | boolean> | null;
  }): Promise<{ audio: Buffer; mimeType: 'audio/mpeg' | 'audio/wav'; usage?: unknown }> {
    if (!this.apiKey) throw new Error('OpenRouter TTS가 설정되지 않았습니다.');
    if (input.text.length === 0 || input.text.length > OPENROUTER_TTS_MAX_INPUT_LENGTH) {
      throw new Error('TTS 입력 길이가 허용 범위를 벗어났습니다.');
    }

    const isPcmModel = this.model.includes('gemini');
    const responseFormat = isPcmModel ? 'pcm' : 'mp3';

    const response = await fetch(OPENROUTER_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: this.withAudioTag(input.text, input.settings),
        voice: input.voiceId,
        response_format: responseFormat,
      }),
      signal: AbortSignal.timeout(OPENROUTER_TTS_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter TTS 요청 실패 (${response.status})`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    if (rawBuffer.length === 0) throw new Error('OpenRouter TTS가 빈 오디오를 반환했습니다.');

    const generationId = response.headers.get('x-generation-id');
    const usage = generationId === null ? undefined : { generationId };

    if (contentType.startsWith('audio/mpeg')) {
      return { audio: rawBuffer, mimeType: 'audio/mpeg', ...(usage ? { usage } : {}) };
    }

    if (contentType.startsWith('audio/pcm') || isPcmModel) {
      const { sampleRate, channels } = parsePcmParams(contentType);
      const audio = pcmToWav(rawBuffer, sampleRate, channels);
      return { audio, mimeType: 'audio/wav', ...(usage ? { usage } : {}) };
    }

    throw new Error(`지원하지 않는 OpenRouter TTS 응답 형식입니다 (${contentType})`);
  }

  private withAudioTag(
    text: string,
    settings: Record<string, string | number | boolean> | null,
  ): string {
    const audioTag = settings?.audioTag;
    return typeof audioTag === 'string' && AUDIO_TAG_PATTERN.test(audioTag)
      ? `${audioTag} ${text}`
      : text;
  }
}
