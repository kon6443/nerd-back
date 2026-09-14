export interface TextToSpeechPort {
  isAvailable(): boolean;
  synthesize(input: {
    text: string;
    voiceId: string;
    settings: Record<string, string | number | boolean> | null;
  }): Promise<{ audio: Buffer; mimeType: 'audio/mpeg' | 'audio/wav'; usage?: unknown }>;
}

export const TEXT_TO_SPEECH_PORT = Symbol('TEXT_TO_SPEECH_PORT');
