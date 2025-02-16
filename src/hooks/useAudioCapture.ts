import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { SpeechRecognitionService } from '../services/speechRecognition';

export const useAudioCapture = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcriptionServiceRef = useRef<SpeechRecognitionService | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { isRecording, activeStream, addTranscription, setAudioLevel, addErrorLog } = useStore();
  const { updateTranscriptionAudio } = useStore();

  useEffect(() => {
    if (isRecording && activeStream) {
      const initializeAudioCapture = async () => {
        try {
          const audioTrack = activeStream.getAudioTracks()[0];
          if (!audioTrack) {
            const error = 'No real audio track found in screen share stream';
            console.error('❌', error);
            addErrorLog(error);
            return;
          }

          // Create new audio context and nodes for real audio monitoring
          audioContextRef.current = new AudioContext();
          sourceRef.current = audioContextRef.current.createMediaStreamSource(activeStream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          
          // Configure analyser for real audio
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;

          // Connect nodes for real audio monitoring
          sourceRef.current.connect(analyserRef.current);

          // Initialize transcription service
          transcriptionServiceRef.current = new SpeechRecognitionService({
            onTranscript: (text, isFinal) => {
              console.log(`🎤 Transcription ${isFinal ? '(final)' : '(interim)'}:`, text);
              if (isFinal && text.trim()) {
                addTranscription(text);
              }
            },
            onAudioChunk: (text, audioUrl) => {
              if (text.trim()) {
                updateTranscriptionAudio(text, audioUrl);
              }
            },
            onError: (error) => {
              console.error('Transcription error:', error);
              addErrorLog(error.message, 'warning');
            },
            onAudioLevel: setAudioLevel,
            stream: activeStream
          });

          await transcriptionServiceRef.current.start();

          // Monitor real audio levels for visualization
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          
          const updateAudioLevel = () => {
            if (!analyserRef.current || !isRecording) return;
            
            analyserRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const average = sum / dataArray.length;
            const normalizedLevel = (average / 255) * 100;
            
            setAudioLevel(normalizedLevel);
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };

          updateAudioLevel();
          console.log('✅ Real audio capture and transcription started');
        } catch (error) {
          console.error('❌ Error starting real audio capture:', error);
          addErrorLog(
            error instanceof Error ? error.message : 'Failed to start audio capture',
            'error'
          );
        }
      };

      initializeAudioCapture();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (transcriptionServiceRef.current) {
        transcriptionServiceRef.current.stop();
        transcriptionServiceRef.current = null;
      }
      
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (error) {
          console.error('Error disconnecting analyser:', error);
        }
        analyserRef.current = null;
      }
      
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (error) {
          console.error('Error disconnecting source:', error);
        }
        sourceRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      
      setAudioLevel(0);
    };
  }, [isRecording, activeStream, setAudioLevel, addTranscription]);
};