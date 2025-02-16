// Define the processor code as a string that will be loaded into a Blob
export const processorCode = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    this.port.postMessage({
      type: 'audioData',
      data: input[0]
    });

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
`;

// Helper function to create a Blob URL for the processor
export const createAudioWorkletBlob = () => {
  const blob = new Blob([processorCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};