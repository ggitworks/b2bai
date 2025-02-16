import { GoogleGenerativeAI } from '@google/generative-ai';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 10000; // 10 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds
const MAX_CONCURRENT_REQUESTS = 1;
let activeRequests = 0;

// Rate limiting
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests
const QUOTA_RESET_DELAY = 60000; // 1 minute pause after quota exceeded

const processQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await sleep(1000); // Wait and check again
      continue;
    }

    const request = requestQueue.shift();
    if (request) {
      activeRequests++;
      try {
      await request();
      } finally {
        activeRequests--;
      }
      await sleep(RATE_LIMIT_DELAY);
    }
  }

  isProcessingQueue = false;
};

const enqueueRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        // If quota exceeded, pause the queue
        if (error instanceof Error && 
            (error.message.includes('quota') || 
             error.message.includes('429') || 
             error.message.includes('rate limit'))) {
          console.log('⏳ API quota exceeded, pausing queue for 1 minute...');
          await sleep(QUOTA_RESET_DELAY);
        }
        reject(error);
      }
    });
    processQueue();
  });
};

let genAI: GoogleGenerativeAI | null = null;
let translationAI: GoogleGenerativeAI | null = null;

export const initializeGemini = (apiKey: string) => {
  try {
    console.log('🤖 Initializing Gemini API...');
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini API initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Gemini API:', error);
    throw error;
  }
};

export const initializeTranslationAPI = (apiKey: string) => {
  try {
    console.log('🤖 Initializing Translation API...');
    translationAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Translation API initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Translation API:', error);
    throw error;
  }
};

export const translateToTurkish = async (text: string, targetLang: string = 'tr'): Promise<string> => {
  if (!translationAI) {
    console.error('❌ Translation API not initialized');
    return 'Translation temporarily unavailable';
  }

  const languageMap: Record<string, string> = {
    tr: 'Turkish',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese'
  };

  const translate = async (targetLang: string, retryCount = 0): Promise<string> => {
    try {
      const targetLanguage = languageMap[targetLang] || 'Turkish';
      
      console.log(`🌍 Requesting ${targetLanguage} translation from Gemini...`);
      const model = translationAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        }
      });
      
      const prompt = `You are a professional English to ${targetLanguage} translator.

Input text to translate:
"${text}"

Rules:
- Return ONLY the ${targetLanguage} translation
- No explanations or notes
- No quotes or formatting
- Do not include the brackets in translation
- Maintain the original tone and meaning
- Keep punctuation natural for ${targetLanguage}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      if (!response.text()) {
        throw new Error('Empty response from translation API');
      }

      console.log('✅ Received translation from Gemini');
      let translation = response.text().trim();

      // Clean up the response
      translation = translation
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^(Translation:|Çeviri:)\s*/i, '') // Remove prefixes
        .replace(/^(Turkish:|Türkçe:)\s*/i, '') // Remove language prefixes
        .replace(/\n/g, ' ') // Remove line breaks
        .replace(/^[-*•]/g, '') // Remove list markers
        .trim();

      // Validate translation
      if (translation.length < 1 || translation === text) {
        throw new Error('Invalid translation received');
      }

      return translation;

    } catch (error) {
      const attempt = retryCount + 1;
      console.error(`❌ Translation error (attempt ${attempt}/${MAX_RETRIES}):`, error);
      
      // Enhanced error handling
      if (error instanceof Error) {
        const isQuotaError = error.message.includes('quota') || 
                            error.message.includes('429') ||
                            error.message.includes('rate limit');

        if (isQuotaError) {
          console.log('⏳ API quota reached, retrying with backoff...');
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(
              INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
              MAX_RETRY_DELAY
            );
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await sleep(delay);
            return translate(targetLang, retryCount + 1);
          }
          return 'Translation temporarily unavailable (API limit reached)';
        } else if (error.message.includes('Invalid translation')) {
          return 'Translation temporarily unavailable';
        } else if (error.message.includes('network')) {
          return 'Translation temporarily unavailable';
        }
      }
      
      return 'Translation temporarily unavailable';
    }
  };

  // Enqueue the translation request with validation
  return enqueueRequest(async () => {
    if (!text || text.trim().length === 0) {
      return 'No text to translate';
    }
    return translate(targetLang);
  });
};
export const summarizeTranscripts = async (texts: string[]): Promise<string> => {
  if (!genAI) {
    console.error('❌ Gemini API not initialized');
    return 'Key points will appear here once API is configured.';
  }

  try {
    console.log('🤖 Requesting transcript summary from Gemini...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Ensure we have valid text content
    const validTexts = texts.filter(text => text.trim().length > 0);
    if (validTexts.length === 0) {
      return 'Waiting for more content to analyze.';
    }

    const prompt = `Summarize the main point of these transcribed segments in a short headline (5-10 words):

${validTexts.map((text, i) => `${i + 1}. ${text}`).join('\n')}

Requirements:
- Single sentence only
- Between 5 and 10 words
- Focus on the main topic or key point
- Use active voice
- Be specific and clear
- End with a period
- No colons, semicolons, or other complex punctuation
- If content is unclear, focus on the most prominent theme`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Check if we have a valid response with candidates
    if (!response.text()) {
      throw new Error('Empty response from API');
    }
    
    console.log('✅ Received summary from Gemini');
    // Clean up the response to ensure it's a single sentence
    let summary = response.text().trim();
    // Remove any line breaks
    summary = summary.replace(/\n/g, ' ');
    // Ensure it ends with a period
    if (!summary.endsWith('.')) {
      summary += '.';
    }
    return summary;
  } catch (error) {
    console.error('❌ Error getting summary from Gemini:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        return 'API limit reached. Summaries will resume shortly.';
      } else if (error.message.includes('network')) {
        return 'Network issue. Retrying...';
      } else if (error.message.includes('permission') || error.message.includes('credential')) {
        return 'API access needs to be configured.';
      }
    }
    
    // Generic fallback that doesn't expose error details to UI
    return 'Analyzing content...';
  }
};
export const transcribeAudio = async (audioChunk: Float32Array): Promise<string> => {
  if (!genAI) {
    console.error('❌ Gemini API not initialized');
    return '';
  }

  let retries = 0;
  let lastError: Error | null = null;

  // Enhanced audio validation
  const validateAudio = (data: Float32Array): { isValid: boolean; reason?: string } => {
    if (data.length === 0) {
      return { isValid: false, reason: 'Empty audio data' };
    }

    // Calculate RMS and peak values
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      sumSquares += abs * abs;
      peak = Math.max(peak, abs);
    }
    const rms = Math.sqrt(sumSquares / data.length);

    // Check for too quiet audio
    if (rms < 0.005) {
      return { isValid: false, reason: 'No significant audio detected' };
    }

    // Check for severe clipping (if more than 1% of samples are at max amplitude)
    const clippedSamples = data.reduce((count, sample) => 
      count + (Math.abs(sample) >= 0.99 ? 1 : 0), 0);
    const clippingRatio = clippedSamples / data.length;
    
    if (clippingRatio > 0.05) {
      return { isValid: false, reason: 'Audio contains clipping' };
    }

    // Check for good dynamic range
    const crestFactor = peak / rms;
    if (crestFactor < 1.2) {
      return { isValid: false, reason: 'Poor dynamic range' };
    }

    return { isValid: true };
  };

  // Validate audio data
  const validation = validateAudio(audioChunk);
  if (!validation.isValid) {
    console.warn(`⚠️ Audio validation failed: ${validation.reason}`);
    throw new Error(`Invalid audio: ${validation.reason}`);
  }

  while (retries < MAX_RETRIES) {
    try {
      if (retries > 0) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retries - 1);
        console.log(`⏳ Retry ${retries}/${MAX_RETRIES}: Waiting ${delay}ms...`);
        await sleep(delay);
      }

      console.log(`🎵 Processing real audio chunk of length: ${audioChunk.length}`);
      
      // Normalize audio before conversion
      const pcmData = new Int16Array(audioChunk.map(sample => {
        // Increase gain to improve speech recognition
        const gain = 1.5;
        const amplified = sample * gain;
        // Apply soft clipping
        const limited = Math.tanh(amplified);
        return limited < 0 ? limited * 0x8000 : limited * 0x7FFF;
      }));

      // Create WAV file structure
      const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // "RIFF" chunk descriptor
    view.setUint32(0, 0x46464952, true);  // "RIFF"
    view.setUint32(4, 36 + pcmData.length * 1, true);  // File size
    view.setUint32(8, 0x45564157, true);  // "WAVE"
    
    // "fmt " sub-chunk
    view.setUint32(12, 0x20746D66, true);  // "fmt "
    view.setUint32(16, 16, true);  // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true);  // NumChannels (1 for mono)
    view.setUint32(24, 48000, true);  // SampleRate (48kHz to match playback)
    view.setUint32(28, 48000 * 2, true);  // ByteRate
    view.setUint16(32, 2, true);  // BlockAlign
    view.setUint16(34, 16, true);  // BitsPerSample
    
    // "data" sub-chunk
    view.setUint32(36, 0x61746164, true);  // "data"
    view.setUint32(40, pcmData.length * 2, true);  // Subchunk2Size
    
    // Create WAV blob with proper MIME type
    const wavBlob = new Blob(
      [wavHeader, pcmData.buffer],
      { type: 'audio/wav' }
    );
    
    // Convert to base64
    const base64Audio = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(wavBlob);
    });

    console.log('🚀 Sending real audio request to Gemini API...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ 
          text: `Transcribe this audio EXACTLY as spoken with these requirements:
1. Transcribe EVERY WORD from start to finish
2. Do not summarize or skip any part
3. Preserve natural speech patterns
4. Include all spoken content, even if it seems repetitive
5. Maintain exact wording without paraphrasing
6. Format as plain text only, no timestamps or speaker labels
7. Do not add any extra formatting or punctuation
8. Do not add any commentary or descriptions
9. If there is background noise or music, ignore it and focus only on speech

CRITICAL: You must transcribe the COMPLETE audio from beginning to end.` },
          { inline_data: { mime_type: 'audio/wav', data: base64Audio } }
        ] }
      ]
    });

    const response = await result.response;
    let transcription = response.text().trim();
    
    // Clean up any markdown or special formatting that might have been added
    transcription = transcription.replace(/^[#\-*>]+\s*/gm, ''); // Remove markdown markers
    transcription = transcription.replace(/\n+/g, ' ').trim(); // Convert newlines to spaces
    
    // Validate transcription quality
    if (
      transcription.toLowerCase().includes('beep') ||
      transcription.length < 1 || 
      /^\s*[\d\W]+\s*$/.test(transcription) ||
      transcription.toLowerCase().includes('no clear speech') ||
      transcription.toLowerCase().includes('no discernible speech') ||
      transcription.toLowerCase().includes('unintelligible') ||
      transcription.toLowerCase().includes('transcription:') ||
      transcription.toLowerCase().includes('audio contains')
    ) {
      console.warn('⚠️ Invalid or unclear transcription detected:', transcription);
      throw new Error('No clear speech detected in audio');
    }
    
    console.log('✅ Received real audio response from Gemini API');
    return transcription;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (error instanceof Error && error.message.includes('quota')) {
        console.warn(`⚠️ API quota exceeded, attempt ${retries + 1} of ${MAX_RETRIES}`);
        retries++;
        continue;
      }
      
      // For non-quota errors, throw immediately
      console.error('❌ Error transcribing with Gemini 1.5 Pro:', error);
      throw error;
    }
  }
  
  // If we've exhausted all retries
  throw new Error(`Transcription failed after ${MAX_RETRIES} retries. Please try again later.`);
};