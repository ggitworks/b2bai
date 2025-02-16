export class SpeechRecognitionService {
  private audioContext: AudioContext;
  private source: MediaStreamAudioSourceNode;
  private audioBuffer: Float32Array[] = [];
  private analyser: AnalyserNode;
  private processor: ScriptProcessorNode;
  private BUFFER_SIZE = 16384;
  private isRecording: boolean = false;
  private isProcessing: boolean = false;
  private silenceCounter: number = 0;
  private MAX_SILENCE_BUFFERS = 3; // Number of silent buffers to keep before trimming
  private lastSpacePress: number = 0;
  private audioPlayer: HTMLAudioElement | null = null;
  private DEBOUNCE_TIME = 300;
  private MIN_AUDIO_DURATION = 0.5; // Minimum audio duration in seconds
  private recordingStartTime: number = 0;
  private overlapBuffer: Float32Array | null = null;
  private OVERLAP_DURATION = 0.1; // 100ms overlap between chunks
  private lastBuffer: Float32Array | null = null;

  constructor(private options: {
    onTranscript: (text: string, isFinal: boolean) => void;
    onError: (error: Error) => void;
    onAudioLevel: (level: number) => void;
    onAudioChunk?: (text: string, audioUrl: string) => void;
    onAudioChunk?: (url: string) => void;
    stream: MediaStream;
  }) {
    // Initialize audio context and nodes
    this.audioContext = new AudioContext();
    
    // Ensure we have an audio track
    const audioTrack = options.stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track found in stream');
    }
    
    // Create a new stream with only the audio track
    const audioStream = new MediaStream([audioTrack]);
    this.source = this.audioContext.createMediaStreamSource(audioStream);
    this.analyser = this.audioContext.createAnalyser();
    this.source.connect(this.analyser);

    // Configure analyzer for better audio quality
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Create script processor for continuous audio processing
    this.processor = this.audioContext.createScriptProcessor(this.BUFFER_SIZE, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    
    // Add keyboard event listener for spacebar
    document.addEventListener('keydown', this.handleKeyPress.bind(this));

    this.setupAudioProcessing();
  }

  private handleKeyPress = async (event: KeyboardEvent) => {
    if (event.code === 'Space' && this.isRecording && !this.isProcessing) {
      event.preventDefault();
      const now = Date.now();

      // Validate audio buffer
      if (!this.audioBuffer || this.audioBuffer.length === 0) {
        console.warn('⚠️ No audio data captured');
        this.options.onError(new Error('No audio detected. Please ensure audio is playing.'));
        return;
      }
      
      const recordingDuration = (now - this.recordingStartTime) / 1000; // Convert to seconds

      // Debounce spacebar presses
      if (now - this.lastSpacePress < this.DEBOUNCE_TIME) {
        return;
      }
      this.lastSpacePress = now;
      
      // Check recording duration
      if (recordingDuration < this.MIN_AUDIO_DURATION) {
        console.log('⚠️ Audio chunk too short or empty');
        this.options.onError(new Error(`Please record for at least ${this.MIN_AUDIO_DURATION} seconds`));
        return;
      }

      // Reset recording start time for next chunk
      this.recordingStartTime = now;

      this.isProcessing = true;
      console.log('🎵 Processing audio chunk on spacebar press...');

      try {
        // Combine all buffers into one continuous stream
        const combinedLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        
        if (combinedLength === 0) {
          throw new Error('No audio data to process');
        }
        
        const combinedBuffer = new Float32Array(combinedLength);
        const overlapSamples = Math.floor(48000 * this.OVERLAP_DURATION); // 48kHz sample rate
        let offset = 0;

        for (const buffer of this.audioBuffer) {
          combinedBuffer.set(buffer, offset);
          offset += buffer.length;
        }

        // Create WAV file for playback
        // Save the last portion for overlap with next chunk
        if (combinedBuffer.length > overlapSamples) {
          this.overlapBuffer = combinedBuffer.slice(-overlapSamples);
        }

        // Create WAV file for playback
        const wavBlob = this.createWavBlob(combinedBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        // Use the same exact audio data for both playback and transcription
        const transcriptionBuffer = combinedBuffer.slice();
        
        // Import and call transcribeAudio with the combined buffer
        const { transcribeAudio } = await import('./gemini');
        try {
          const text = await transcribeAudio(transcriptionBuffer);

          console.log('🎤 Manual transcription received:', text);
          this.options.onTranscript(text, true);
          
          // Notify about the new audio chunk with its transcription
          if (this.options.onAudioChunk) {
            this.options.onAudioChunk(text, audioUrl);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('No clear speech')) {
            this.options.onError(new Error('No clear speech detected. Try speaking more clearly or adjusting your volume.'));
          } else {
            throw error;
          }
        }

        // Clear buffer for next chunk
        this.audioBuffer = this.overlapBuffer ? [this.overlapBuffer] : [];
      } catch (error) {
        console.error('Manual transcription error:', error);
        this.options.onError(error instanceof Error ? error : new Error('Transcription failed'));
      } finally {
        this.isProcessing = false;
      }
    }
  }

  private isAudioSignificant(buffer: Float32Array): boolean {
    // Enhanced audio significance detection
    let sumSquares = 0;
    let peakAmplitude = 0;
    let zeroCrossings = 0;
    let prevSample = 0;
    let silentSamples = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i];
      sumSquares += sample * sample;
      const abs = Math.abs(sample);
      peakAmplitude = Math.max(peakAmplitude, abs);
      
      // Count silent samples
      if (abs < 0.001) {
        silentSamples++;
      }
      
      // Count zero crossings for frequency estimation
      if (i > 0 && ((prevSample < 0 && sample >= 0) || (prevSample >= 0 && sample < 0))) {
        zeroCrossings++;
      }
      prevSample = sample;
    }
    
    const rms = Math.sqrt(sumSquares / buffer.length);
    const silenceRatio = silentSamples / buffer.length;
    const zeroCrossingRate = zeroCrossings / buffer.length;
    
    // Even more lenient thresholds to maintain continuity
    const hasSignificantLevel = rms > 0.003;
    const hasDynamicRange = peakAmplitude > 0.003;
    const hasFrequencyContent = zeroCrossingRate > 0.003;
    const hasLowSilence = silenceRatio < 0.98;
    
    const isSignificant = hasSignificantLevel && hasDynamicRange && 
                         hasFrequencyContent && hasLowSilence;

    if (!isSignificant) {
      console.log('📊 Audio metrics:', {
        rms: rms.toFixed(4),
        peak: peakAmplitude.toFixed(4),
        zeroCrossings: zeroCrossingRate.toFixed(4),
        silenceRatio: silenceRatio.toFixed(4)
      });
    }

    return isSignificant;
  }

  private setupAudioProcessing() {
    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      
      // Get input data and validate
      const inputData = e.inputBuffer.getChannelData(0);
      if (!inputData || inputData.length === 0) {
        console.warn('⚠️ Empty input buffer received');
        return;
      }

      const normalizedData = new Float32Array(inputData.length);

      // Find peak amplitude for normalization
      let maxAmplitude = 0;
      let rms = 0;

      // Calculate RMS and find peak amplitude
      for (let i = 0; i < inputData.length; i++) {
        const abs = Math.abs(inputData[i]);
        maxAmplitude = Math.max(maxAmplitude, abs);
        rms += abs * abs;
      }
      
      rms = Math.sqrt(rms / inputData.length);

      // Skip processing if the audio is too quiet
      if (rms < 0.0003) {
        // Instead of skipping, increment silence counter
        this.silenceCounter++;
        if (this.silenceCounter <= this.MAX_SILENCE_BUFFERS) {
          // Keep a few silent buffers to maintain continuity
          normalizedData.fill(0);
          this.audioBuffer.push(normalizedData);
        }
        return;
      } else {
        // Reset silence counter when we get significant audio
        this.silenceCounter = 0;
      }

      // Adaptive noise gate based on RMS
      const noiseGate = Math.max(0.0003, rms * 0.03);
      
      // Soft knee compressor/limiter parameters
      const threshold = 0.7;
      const ratio = 4;
      const knee = 0.2;
      const makeupGain = 1.0;

      for (let i = 0; i < inputData.length; i++) {
        const sample = inputData[i];
        
        // Apply noise gate
        if (Math.abs(sample) < noiseGate) {
          normalizedData[i] = 0;
          continue;
        }
        
        // Normalize
        const normalizedSample = sample / (maxAmplitude || 1);
        
        // Apply soft knee compression
        const inputLevel = Math.abs(normalizedSample);
        let outputLevel;
        
        if (inputLevel < threshold - knee / 2) {
          // Below threshold
          outputLevel = inputLevel;
        } else if (inputLevel > threshold + knee / 2) {
          // Above threshold
          outputLevel = threshold + (inputLevel - threshold) / ratio;
        } else {
          // In knee region
          const t = (inputLevel - (threshold - knee / 2)) / knee;
          outputLevel = inputLevel + ((1 / ratio - 1) * Math.pow(t, 2) * knee / 2);
        }
        
        // Apply makeup gain and maintain sign
        normalizedData[i] = (normalizedSample > 0 ? 1 : -1) * 
                           outputLevel * makeupGain * 0.95; // 0.95 for headroom
      }
      
      // Only store if there's significant audio
      const audioSignificance = this.isAudioSignificant(normalizedData);
      if (audioSignificance) {
        console.log('🎵 Significant audio detected, buffer length:', this.audioBuffer.length);
        this.audioBuffer.push(normalizedData);
      } else if (this.audioBuffer.length > 0 && this.silenceCounter <= this.MAX_SILENCE_BUFFERS) {
        // Keep a few silent buffers for smoother transitions
        this.audioBuffer.push(normalizedData);
      }

      // Keep only the last 5 seconds of audio (assuming 48kHz sample rate)
      // Removed 5-second limit to allow unlimited recording
    };
  }

  public async start() {
    try {
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.silenceCounter = 0;
      this.lastBuffer = null;
      this.audioBuffer = [];
      this.overlapBuffer = null;
      console.log('✅ Streaming audio capture started');

      // Start audio level monitoring
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if (!this.isRecording) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / dataArray.length;
        const level = (average / 255) * 100;
        
        this.options.onAudioLevel(level);
        requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.options.onError(error instanceof Error ? error : new Error('Failed to start audio capture'));
    }
  }

  public stop() {
    this.isRecording = false;
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', this.handleKeyPress);

    try {
      this.source.disconnect();
      this.processor.disconnect();
      this.analyser.disconnect();
      this.audioContext.close();
      this.audioBuffer = [];
      this.overlapBuffer = null;
    } catch (error) {
      console.error('Error stopping audio capture:', error);
    }
  }

  private createWavBlob(audioData: Float32Array): Blob {
    // Convert Float32Array to Int16Array for WAV format
    const pcmData = new Int16Array(audioData.map(sample => {
      // Soft clipping using tanh for smoother limiting
      const s = Math.tanh(sample);
      return s < 0 ? s * 0x8000 : s * 0x7FFF;
    }));

    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const bytesPerSample = 2; // 16-bit audio
    
    // "RIFF" chunk descriptor
    view.setUint32(0, 0x46464952, true);  // "RIFF"
    view.setUint32(4, 36 + pcmData.length * bytesPerSample, true);  // File size
    view.setUint32(8, 0x45564157, true);  // "WAVE"
    
    // "fmt " sub-chunk
    view.setUint32(12, 0x20746D66, true);  // "fmt "
    view.setUint32(16, 16, true);  // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true);  // NumChannels (1 for mono)
    view.setUint32(24, 48000, true);  // SampleRate (48kHz for high quality)
    view.setUint32(28, 48000 * 2, true);  // ByteRate
    view.setUint16(32, bytesPerSample, true);  // BlockAlign
    view.setUint16(34, 16, true);  // BitsPerSample
    
    // "data" sub-chunk
    view.setUint32(36, 0x61746164, true);  // "data"
    view.setUint32(40, pcmData.length * bytesPerSample, true);  // Subchunk2Size

    return new Blob([wavHeader, pcmData.buffer], { type: 'audio/wav' });
  }
}