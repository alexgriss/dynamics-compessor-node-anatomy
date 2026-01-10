import { FC } from "react";

interface ILayerToggle {
  label: string;
  color: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface ILayerToggles {
  showWaveform: boolean;
  showEnvelope: boolean;
  showGainReduction: boolean;
  showThresholdKnee: boolean;
  onWaveformChange: (v: boolean) => void;
  onEnvelopeChange: (v: boolean) => void;
  onGainReductionChange: (v: boolean) => void;
  onThresholdKneeChange: (v: boolean) => void;
}

const LayerToggle: FC<ILayerToggle> = ({ label, color, checked, onChange }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      cursor: "pointer",
      userSelect: "none",
      fontSize: 13,
      color: "rgba(255, 255, 255, 0.8)",
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{
        width: 14,
        height: 14,
        cursor: "pointer",
        accentColor: color,
      }}
    />
    <span>{label}</span>
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        opacity: checked ? 1 : 0.3,
      }}
    />
  </label>
);

export const LayerToggles: FC<ILayerToggles> = ({
  showWaveform,
  showEnvelope,
  showGainReduction,
  showThresholdKnee,
  onWaveformChange,
  onEnvelopeChange,
  onGainReductionChange,
  onThresholdKneeChange,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "10px 16px",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: 8,
        marginTop: 8,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "rgba(255, 255, 255, 0.5)",
          userSelect: "none",
        }}
      >
        Layers:
      </span>
      <LayerToggle
        label="Waveform"
        color="#00d9ff"
        checked={showWaveform}
        onChange={onWaveformChange}
      />
      <LayerToggle
        label="Envelope"
        color="#64dc64"
        checked={showEnvelope}
        onChange={onEnvelopeChange}
      />
      <LayerToggle
        label="Gain Reduction"
        color="#ff5050"
        checked={showGainReduction}
        onChange={onGainReductionChange}
      />
      <LayerToggle
        label="Threshold / Knee"
        color="#ff9f43"
        checked={showThresholdKnee}
        onChange={onThresholdKneeChange}
      />
    </div>
  );
};
