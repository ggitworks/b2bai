import { Voice } from 'elevenlabs-node';

const ELEVENLABS_API_KEY = 'sk_40f393a4644e85fcad240dc9237ddbb337cdf4db2a131d99';

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    console.log('🎙️ Generating speech from translated text...');
    
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    console.log('✅ Speech generated successfully');
    return audioUrl;
  } catch (error) {
    console.error('❌ Error generating speech:', error);
    throw error;
  }
};