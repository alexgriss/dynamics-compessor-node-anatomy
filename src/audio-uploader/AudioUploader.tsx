import { FC, useRef } from "react";

interface IAudioUploader {
  onBufferReady: (buffer: AudioBuffer) => void;
  audioContext: AudioContext;
}

export const AudioUploader: FC<IAudioUploader> = ({
  onBufferReady,
  audioContext,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    onBufferReady(audioBuffer);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          cursor: "pointer",
          borderRadius: 8,
          border: "none",
          background: "#00d9ff",
          color: "#1a1a2e",
          fontWeight: 600,
        }}
      >
        Загрузить аудио
      </button>
    </div>
  );
};
