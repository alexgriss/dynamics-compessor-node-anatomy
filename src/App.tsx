import { FC, useCallback, useRef, useState } from "react";
import { HelpIcon, Knob, LayerToggles, Tooltip } from "./ui";
import { Waveshape } from "./waveshape";

// Tooltip texts
const TOOLTIPS = {
  threshold: `<strong>Threshold sets the signal level where compression begins.</strong>

It is measured in decibels (dB), <strong>from 0 to −100.</strong>

<em>When the signal level goes above the threshold, the compressor starts reducing it.</em>`,

  ratio: `<strong>Ratio sets how much the signal is reduced above the threshold.</strong>

A higher ratio means stronger compression.

<em>For example, at 3:1, every 3 dB above the threshold becomes 1 dB at the output.</em>`,

  knee: `<strong>Knee controls how smoothly compression starts around the threshold.</strong>

It is measured in decibels (dB), <strong>from 0 to 40.</strong>

<em>Lower values create a sharp, noticeable compression.</em>
<em>Higher values create a smoother, more transparent compression.</em>`,

  attack: `<strong>Attack controls how quickly the compressor reacts when the signal becomes loud.</strong>

It is measured in milliseconds <strong>(0 to 1000 ms)</strong>.

<em>Lower values make the compressor react faster and reduce transients more.</em>
<em>Higher values let the initial hit pass through before compression starts.</em>`,

  release: `<strong>Release controls how quickly the compressor stops reducing the signal after it becomes quiet again.</strong>

It is measured in milliseconds <strong>(0 to 1000 ms)</strong>.

<em>Lower values release compression faster.</em>
<em>Higher values hold compression longer, creating a smoother sound.</em>`,

  makeupGain: `<strong>Makeup Gain controls the output level after compression.</strong>

Compression reduces the signal level, so makeup gain is used to restore loudness and better match the input level.

<em>Note: Web Audio's <code>DynamicsCompressorNode</code> applies makeup gain automatically by default.</em>`,
};

// Icons
const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v12" />
    <path d="m17 8-5-5-5 5" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
);

const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </svg>
);

const StopIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </svg>
);

const ClearIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

interface ICompressorParams {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

const DEFAULT_PARAMS: ICompressorParams = {
  threshold: 0,
  knee: 0,
  ratio: 1,
  attack: 0.003,
  release: 0.01,
};

export const App: FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paramsRef = useRef<ICompressorParams>(DEFAULT_PARAMS);

  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(
    null
  );
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [params, setParams] = useState<ICompressorParams>(DEFAULT_PARAMS);

  // Layer visibility states
  const [showWaveform, setShowWaveform] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [showGainReduction, setShowGainReduction] = useState(true);
  const [showThresholdKnee, setShowThresholdKnee] = useState(true);

  // Makeup gain toggle
  const [makeupGain, setMakeupGain] = useState(false);
  const makeupGainRef = useRef(false);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  const stopPlayback = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopPlayback();
    // Reset params and makeup gain
    paramsRef.current = DEFAULT_PARAMS;
    setParams(DEFAULT_PARAMS);
    makeupGainRef.current = false;
    setMakeupGain(false);

    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    setOriginalBuffer(buffer);
    setAudioBuffer(buffer);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!audioBuffer) return;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
    };
    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
  };

  const updateParam = (key: keyof ICompressorParams, value: number) => {
    const newParams = { ...paramsRef.current, [key]: value };
    paramsRef.current = newParams;
    setParams(newParams);
  };

  // Custom compressor without makeup gain
  const applyCustomCompression = useCallback(
    async (buffer: AudioBuffer): Promise<AudioBuffer> => {
      const { threshold, knee, ratio, attack, release } = paramsRef.current;
      const sampleRate = buffer.sampleRate;
      const numChannels = buffer.numberOfChannels;
      const length = buffer.length;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const outputBuffer = audioContextRef.current.createBuffer(
        numChannels,
        length,
        sampleRate
      );

      const attackCoeff = Math.exp(-1 / (sampleRate * attack));
      const releaseCoeff = Math.exp(-1 / (sampleRate * release));

      const kneeStart = threshold - knee / 2;
      const kneeEnd = threshold + knee / 2;

      for (let ch = 0; ch < numChannels; ch++) {
        const input = buffer.getChannelData(ch);
        const output = outputBuffer.getChannelData(ch);

        let envFollower = 0;

        for (let i = 0; i < length; i++) {
          const sample = input[i];
          const absSample = Math.abs(sample);

          if (absSample > envFollower) {
            envFollower = absSample + (envFollower - absSample) * attackCoeff;
          } else {
            envFollower = absSample + (envFollower - absSample) * releaseCoeff;
          }

          const envDb = envFollower > 0 ? 20 * Math.log10(envFollower) : -100;

          let gainReductionDb = 0;

          if (envDb > kneeEnd) {
            gainReductionDb = (envDb - threshold) * (1 - 1 / ratio);
          } else if (envDb > kneeStart && knee > 0) {
            const kneeRange = kneeEnd - kneeStart;
            const x = envDb - kneeStart;
            gainReductionDb = ((1 - 1 / ratio) * (x * x)) / (2 * kneeRange);
          }

          const gainLin = Math.pow(10, -gainReductionDb / 20);
          output[i] = sample * gainLin;
        }
      }

      return outputBuffer;
    },
    []
  );

  // Standard DynamicsCompressorNode (with auto makeup gain)
  const applyStandardCompression = useCallback(
    async (buffer: AudioBuffer): Promise<AudioBuffer> => {
      const offlineCtx = new OfflineAudioContext(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.value = paramsRef.current.threshold;
      compressor.knee.value = paramsRef.current.knee;
      compressor.ratio.value = paramsRef.current.ratio;
      compressor.attack.value = paramsRef.current.attack;
      compressor.release.value = paramsRef.current.release;

      source.connect(compressor);
      compressor.connect(offlineCtx.destination);
      source.start(0);

      return offlineCtx.startRendering();
    },
    []
  );

  const applyCompression = useCallback(async () => {
    if (!originalBuffer) return;

    setIsProcessing(true);

    const outputBuffer = makeupGainRef.current
      ? await applyStandardCompression(originalBuffer)
      : await applyCustomCompression(originalBuffer);

    setAudioBuffer(outputBuffer);
    setIsProcessing(false);
  }, [originalBuffer, applyCustomCompression, applyStandardCompression]);

  const handleMakeupGainToggle = (checked: boolean) => {
    makeupGainRef.current = checked;
    setMakeupGain(checked);
    if (originalBuffer) {
      applyCompression();
    }
  };

  const resetToDefault = () => {
    paramsRef.current = DEFAULT_PARAMS;
    setParams(DEFAULT_PARAMS);
    setAudioBuffer(originalBuffer);
  };

  const clearFile = () => {
    stopPlayback();
    setOriginalBuffer(null);
    setAudioBuffer(null);
    paramsRef.current = DEFAULT_PARAMS;
    setParams(DEFAULT_PARAMS);
    makeupGainRef.current = false;
    setMakeupGain(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 20px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.15)",
    fontWeight: 500,
    transition: "all 0.2s ease",
    background: "rgba(20, 20, 30, 0.95)",
    color: "rgba(255, 255, 255, 0.9)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0d0d14 0%, #1a1a2e 100%)",
        padding: 32,
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.9)",
          marginBottom: 24,
          letterSpacing: "-0.3px",
        }}
      >
        DynamicsCompressorNode Anatomy
      </h1>
      <a
        href="https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "rgba(0, 217, 255, 0.8)",
          textDecoration: "none",
          marginBottom: 24,
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#00d9ff")}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "rgba(0, 217, 255, 0.8)")
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Web Audio API Documentation
      </a>

      {/* Main Layout: Two Columns */}
      <div style={{ display: "flex", gap: 24 }}>
        {/* Left Column: Waveform + Legend */}
        <div style={{ flex: 1 }}>
          <Waveshape
            audioBuffer={audioBuffer}
            originalBuffer={originalBuffer}
            thresholdDb={params.threshold}
            kneeDb={params.knee}
            ratio={params.ratio}
            attack={params.attack}
            release={params.release}
            showWaveform={showWaveform}
            showEnvelope={showEnvelope}
            showGainReduction={showGainReduction}
            showThresholdKnee={showThresholdKnee}
          />

          <LayerToggles
            showWaveform={showWaveform}
            showEnvelope={showEnvelope}
            showGainReduction={showGainReduction}
            showThresholdKnee={showThresholdKnee}
            onWaveformChange={setShowWaveform}
            onEnvelopeChange={setShowEnvelope}
            onGainReductionChange={setShowGainReduction}
            onThresholdKneeChange={setShowThresholdKnee}
          />
        </div>

        {/* Right Column: Controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#12121a",
            borderRadius: 12,
            padding: 16,
          }}
        >
          {/* File Input (hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {/* Upload + Clear Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...buttonStyle,
                flex: 1,
                borderColor: "rgba(0, 217, 255, 0.4)",
                color: "#00d9ff",
              }}
            >
              <UploadIcon />
              Upload
            </button>
            {originalBuffer && (
              <button
                onClick={clearFile}
                style={{
                  ...buttonStyle,
                  padding: "12px",
                  borderColor: "rgba(255, 71, 87, 0.4)",
                  color: "#ff4757",
                }}
              >
                <ClearIcon />
              </button>
            )}
          </div>

          {/* Play/Stop Button */}
          <button
            onClick={togglePlayback}
            disabled={!audioBuffer}
            style={{
              ...buttonStyle,
              borderColor: isPlaying
                ? "rgba(255, 71, 87, 0.4)"
                : "rgba(46, 213, 115, 0.4)",
              color: isPlaying ? "#ff4757" : "#2ed573",
              opacity: audioBuffer ? 1 : 0.4,
              cursor: audioBuffer ? "pointer" : "not-allowed",
            }}
          >
            {isPlaying ? <StopIcon /> : <PlayIcon />}
            {isPlaying ? "Stop" : "Play"}
          </button>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(255, 255, 255, 0.1)",
              margin: "4px 0",
            }}
          />

          {/* Knobs - Pyramid Layout */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              userSelect: "none",
            }}
          >
            {/* Top Row: Threshold, Knee, Ratio */}
            <div style={{ display: "flex", gap: 10 }}>
              <Knob
                label="Threshold"
                value={params.threshold}
                min={-100}
                max={0}
                step={1}
                unit=" dB"
                tooltip={TOOLTIPS.threshold}
                onChange={(v) => updateParam("threshold", v)}
                onChangeEnd={applyCompression}
              />
              <Knob
                label="Knee"
                value={params.knee}
                min={0}
                max={40}
                step={1}
                unit=" dB"
                tooltip={TOOLTIPS.knee}
                onChange={(v) => updateParam("knee", v)}
                onChangeEnd={applyCompression}
              />
              <Knob
                label="Ratio"
                value={params.ratio}
                min={1}
                max={20}
                step={0.5}
                unit=":1"
                tooltip={TOOLTIPS.ratio}
                onChange={(v) => updateParam("ratio", v)}
                onChangeEnd={applyCompression}
              />
            </div>

            {/* Bottom Row: Attack, Release (centered) */}
            <div style={{ display: "flex", gap: 10 }}>
              <Knob
                label="Attack"
                value={params.attack}
                min={0}
                max={1}
                step={0.001}
                unit=" s"
                tooltip={TOOLTIPS.attack}
                onChange={(v) => updateParam("attack", v)}
                onChangeEnd={applyCompression}
              />
              <Knob
                label="Release"
                value={params.release}
                min={0}
                max={1}
                step={0.01}
                unit=" s"
                tooltip={TOOLTIPS.release}
                onChange={(v) => updateParam("release", v)}
                onChangeEnd={applyCompression}
              />
            </div>

            {/* Makeup Gain Checkbox */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={makeupGain}
                  onChange={(e) => handleMakeupGainToggle(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "#00d9ff",
                    cursor: "pointer",
                  }}
                />
                Makeup Gain
              </label>
              <Tooltip content={TOOLTIPS.makeupGain}>
                <HelpIcon />
              </Tooltip>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(255, 255, 255, 0.1)",
              margin: "4px 0",
            }}
          />

          {/* Reset Button */}
          <button
            onClick={resetToDefault}
            style={{
              ...buttonStyle,
            }}
          >
            {isProcessing ? "..." : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};
