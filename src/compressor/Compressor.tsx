import { FC, useCallback, useRef, useState } from "react";
import { Knob } from "../ui";

interface ICompressor {
  originalBuffer: AudioBuffer | null;
  onProcessed: (buffer: AudioBuffer) => void;
  onReset: () => void;
  onThresholdChange: (threshold: number) => void;
  onKneeChange: (knee: number) => void;
  onRatioChange: (ratio: number) => void;
  onAttackChange: (attack: number) => void;
  onReleaseChange: (release: number) => void;
}

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

export const Compressor: FC<ICompressor> = ({
  originalBuffer,
  onProcessed,
  onReset,
  onThresholdChange,
  onKneeChange,
  onRatioChange,
  onAttackChange,
  onReleaseChange,
}) => {
  const [params, setParams] = useState<ICompressorParams>(DEFAULT_PARAMS);
  const [isProcessing, setIsProcessing] = useState(false);
  const paramsRef = useRef(params);

  const updateParam = (key: keyof ICompressorParams, value: number) => {
    const newParams = { ...paramsRef.current, [key]: value };
    paramsRef.current = newParams;
    setParams(newParams);
  };

  const applyCompression = useCallback(async () => {
    if (!originalBuffer) return;

    setIsProcessing(true);

    const offlineCtx = new OfflineAudioContext(
      originalBuffer.numberOfChannels,
      originalBuffer.length,
      originalBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = paramsRef.current.threshold;
    compressor.knee.value = paramsRef.current.knee;
    compressor.ratio.value = paramsRef.current.ratio;
    compressor.attack.value = paramsRef.current.attack;
    compressor.release.value = paramsRef.current.release;

    source.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    // Normalize to prevent clipping from makeup gain
    let maxPeak = 0;
    for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
      const data = renderedBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }

    if (maxPeak > 1) {
      const gain = 1 / maxPeak;
      for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
        const data = renderedBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] *= gain;
        }
      }
    }

    onProcessed(renderedBuffer);
    setIsProcessing(false);
  }, [originalBuffer, onProcessed]);

  const resetToDefault = () => {
    paramsRef.current = DEFAULT_PARAMS;
    setParams(DEFAULT_PARAMS);
    onReset();
  };

  return (
    <div style={{ marginTop: 24, userSelect: "none" }}>
      <h2 style={{ marginBottom: 16 }}>DynamicsCompressorNode</h2>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          padding: 24,
          background: "#12121a",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Knob
          label="Threshold"
          value={params.threshold}
          min={-100}
          max={0}
          step={1}
          unit=" dB"
          onChange={(v) => {
            updateParam("threshold", v);
            onThresholdChange(v);
          }}
          onChangeEnd={applyCompression}
        />
        <Knob
          label="Knee"
          value={params.knee}
          min={0}
          max={40}
          step={1}
          unit=" dB"
          onChange={(v) => {
            updateParam("knee", v);
            onKneeChange(v);
          }}
          onChangeEnd={applyCompression}
        />
        <Knob
          label="Ratio"
          value={params.ratio}
          min={1}
          max={20}
          step={0.5}
          unit=":1"
          onChange={(v) => {
            updateParam("ratio", v);
            onRatioChange(v);
          }}
          onChangeEnd={applyCompression}
        />
        <Knob
          label="Attack"
          value={params.attack}
          min={0}
          max={1}
          step={0.001}
          unit=" s"
          onChange={(v) => {
            updateParam("attack", v);
            onAttackChange(v);
          }}
          onChangeEnd={applyCompression}
        />
        <Knob
          label="Release"
          value={params.release}
          min={0}
          max={1}
          step={0.01}
          unit=" s"
          onChange={(v) => {
            updateParam("release", v);
            onReleaseChange(v);
          }}
          onChangeEnd={applyCompression}
        />
      </div>

      <button
        onClick={resetToDefault}
        disabled={!originalBuffer || isProcessing}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          cursor: originalBuffer && !isProcessing ? "pointer" : "not-allowed",
          borderRadius: 8,
          border: "2px solid #00d9ff",
          background: "transparent",
          color: originalBuffer ? "#00d9ff" : "#444",
          fontWeight: 600,
        }}
      >
        {isProcessing ? "Обработка..." : "Сбросить к оригиналу"}
      </button>
    </div>
  );
};
