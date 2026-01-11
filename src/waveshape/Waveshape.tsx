import { FC, useEffect, useMemo, useRef } from "react";

// NOTE:
// This visualization uses a peak-based envelope follower.
// Real-world compressors may use RMS or program-dependent detection.
// This is an educational model for understanding compression concepts.

interface IWaveshape {
  audioBuffer: AudioBuffer | null;
  originalBuffer: AudioBuffer | null;
  thresholdDb?: number;
  kneeDb?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  width?: number;
  height?: number;
  showWaveform?: boolean;
  showEnvelope?: boolean;
  showGainReduction?: boolean;
  showThresholdKnee?: boolean;
}

const SCALE_WIDTH = 50;
const DB_MARKS = [0, -3, -6, -12, -18, -24];
const MAX_GAIN_REDUCTION_DB = 24;

// Get envelope color based on signal level relative to threshold/knee
const getEnvelopeColor = (
  envValue: number,
  thresholdAmp: number,
  kneeStartAmp: number,
  kneeEndAmp: number,
  ratioInfluence: number
): string => {
  let baseAlpha: number;
  let saturation: number;

  if (envValue < kneeStartAmp) {
    // Below knee - neutral
    baseAlpha = 0.35;
    saturation = 0;
  } else if (envValue < thresholdAmp) {
    // Entering knee zone
    const t = (envValue - kneeStartAmp) / (thresholdAmp - kneeStartAmp);
    baseAlpha = 0.35 + t * 0.15;
    saturation = t * 0.3;
  } else if (envValue < kneeEndAmp) {
    // Inside knee, above threshold
    const t = (envValue - thresholdAmp) / (kneeEndAmp - thresholdAmp);
    baseAlpha = 0.5 + t * 0.2;
    saturation = 0.3 + t * 0.4;
  } else {
    // Above knee - full compression zone
    baseAlpha = 0.7;
    saturation = 0.7;
  }

  // Ratio boost for signals above threshold
  const ratioBoost = envValue > thresholdAmp ? ratioInfluence * 0.3 : 0;
  const finalAlpha = Math.min(baseAlpha + ratioBoost, 0.85);
  const finalSaturation = Math.min(saturation + ratioBoost, 1);

  const r = Math.round(80 + finalSaturation * 50);
  const g = Math.round(200 + finalSaturation * 55);
  const b = Math.round(80 + finalSaturation * 50);

  return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
};

// Calculate envelope with attack/release smoothing (peak detector style)
const calculateEnvelope = (
  data: Float32Array,
  sampleRate: number,
  attack: number,
  release: number,
  outputLength: number
): Float32Array => {
  const envelope = new Float32Array(outputLength);
  const step = Math.ceil(data.length / outputLength);

  // Protect against zero values
  const safeAttack = Math.max(attack, 0.00001);
  const safeRelease = Math.max(release, 0.00001);

  // Time constants for envelope follower
  const attackCoeff = Math.exp(-1 / (sampleRate * safeAttack));
  const releaseCoeff = Math.exp(-1 / (sampleRate * safeRelease));

  let envValue = 0;

  for (let i = 0; i < outputLength; i++) {
    // Get peak for this segment
    let peak = 0;
    const startIdx = i * step;
    const endIdx = Math.min(startIdx + step, data.length);

    for (let j = startIdx; j < endIdx; j++) {
      const absVal = Math.abs(data[j]);
      if (absVal > peak) peak = absVal;
    }

    // Apply single-step attack/release smoothing per segment
    // (one smoothing step per aggregated peak, not pseudo-time simulation)
    if (peak > envValue) {
      envValue += (peak - envValue) * (1 - attackCoeff);
    } else {
      envValue += (peak - envValue) * (1 - releaseCoeff);
    }

    envelope[i] = Math.min(envValue, 1);
  }

  return envelope;
};

// Calculate gain reduction based on envelope and compressor settings
const calculateGainReduction = (
  envelope: Float32Array,
  sampleRate: number,
  thresholdDb: number,
  kneeDb: number,
  ratio: number,
  attack: number,
  release: number,
  outputLength: number
): Float32Array => {
  const gainReduction = new Float32Array(outputLength);

  // If ratio is 1, no compression
  if (ratio <= 1) {
    return gainReduction; // All zeros
  }

  const step = Math.ceil(envelope.length / outputLength) || 1;

  // Protect against zero values
  const safeAttack = Math.max(attack, 0.00001);
  const safeRelease = Math.max(release, 0.00001);

  // GR reacts ~1000x faster than envelope for clearer visualization
  // attack/release are in seconds, we scale them down for snappier GR response
  const grAttackTime = safeAttack * 0.001;
  const grReleaseTime = safeRelease * 0.001;

  const attackCoeff = Math.exp(-1 / (sampleRate * grAttackTime));
  const releaseCoeff = Math.exp(-1 / (sampleRate * grReleaseTime));

  let grSmoothed = 0;

  for (let i = 0; i < outputLength; i++) {
    // Get envelope value at this position
    const envIdx = Math.min(i * step, envelope.length - 1);
    const envValue = envelope[envIdx];

    // Convert to dB
    const inputDb = envValue > 0 ? 20 * Math.log10(envValue) : -100;

    // Calculate instantaneous gain reduction
    let gr = 0;
    const kneeStart = thresholdDb - kneeDb / 2;
    const kneeEnd = thresholdDb + kneeDb / 2;
    const kneeRange = kneeEnd - kneeStart;

    if (inputDb > kneeEnd) {
      // Above knee - full compression
      gr = (inputDb - thresholdDb) * (1 - 1 / ratio);
    } else if (inputDb > kneeStart && kneeDb > 0 && kneeRange > 0) {
      // Inside knee - soft knee interpolation (with division-by-zero protection)
      const x = inputDb - kneeStart;
      // Quadratic interpolation for smooth knee
      gr = ((1 - 1 / ratio) * (x * x)) / (2 * kneeRange);
    }
    // Below knee: gr = 0

    // Apply attack/release smoothing to GR
    if (gr > grSmoothed) {
      grSmoothed = gr + (grSmoothed - gr) * attackCoeff;
    } else {
      grSmoothed = gr + (grSmoothed - gr) * releaseCoeff;
    }

    gainReduction[i] = grSmoothed;
  }

  return gainReduction;
};

export const Waveshape: FC<IWaveshape> = ({
  audioBuffer,
  originalBuffer,
  thresholdDb = 0,
  kneeDb = 0,
  ratio = 1,
  attack = 0.003,
  release = 0.01,
  width = 800,
  height = 600,
  showWaveform = true,
  showEnvelope = true,
  showGainReduction = false,
  showThresholdKnee = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalWidth = width + SCALE_WIDTH;

  // Memoize envelope calculation from ORIGINAL buffer (input level envelope)
  const envelope = useMemo(() => {
    if (!originalBuffer) return null;
    const data = originalBuffer.getChannelData(0);
    return calculateEnvelope(
      data,
      originalBuffer.sampleRate,
      attack,
      release,
      width
    );
  }, [originalBuffer, attack, release, width]);

  // Memoize gain reduction calculation
  const gainReduction = useMemo(() => {
    if (!envelope || !originalBuffer) return null;
    return calculateGainReduction(
      envelope,
      originalBuffer.sampleRate,
      thresholdDb,
      kneeDb,
      ratio,
      attack,
      release,
      width
    );
  }, [
    envelope,
    originalBuffer,
    thresholdDb,
    kneeDb,
    ratio,
    attack,
    release,
    width,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalWidth * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const amp = height / 2;
    const waveAreaX = SCALE_WIDTH;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, totalWidth, height);

    // Draw dB scale on the left
    ctx.fillStyle = "#0d0d14";
    ctx.fillRect(0, 0, SCALE_WIDTH, height);

    ctx.font = "bold 12px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (const db of DB_MARKS) {
      const amplitude = Math.pow(10, db / 20);
      const upperY = amp - amplitude * amp;
      const lowerY = amp + amplitude * amp;

      // Draw grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (db !== 0) {
        ctx.beginPath();
        ctx.moveTo(waveAreaX, upperY);
        ctx.lineTo(totalWidth, upperY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(waveAreaX, lowerY);
        ctx.lineTo(totalWidth, lowerY);
        ctx.stroke();
      }

      // Draw tick marks and labels
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      const label = db === 0 ? "0 dB" : `${db}`;

      ctx.beginPath();
      ctx.moveTo(SCALE_WIDTH - 4, upperY);
      ctx.lineTo(SCALE_WIDTH, upperY);
      ctx.stroke();
      const upperLabelY = Math.max(upperY, 8);
      ctx.fillText(label, SCALE_WIDTH - 6, upperLabelY);

      ctx.beginPath();
      ctx.moveTo(SCALE_WIDTH - 4, lowerY);
      ctx.lineTo(SCALE_WIDTH, lowerY);
      ctx.stroke();
      const lowerLabelY = Math.min(lowerY, height - 8);
      ctx.fillText(label, SCALE_WIDTH - 6, lowerLabelY);
    }

    // Draw center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(waveAreaX, amp);
    ctx.lineTo(totalWidth, amp);
    ctx.stroke();

    // Draw knee zone (only above threshold, sharper gradient)
    if (showThresholdKnee && thresholdDb < 0 && kneeDb > 0) {
      const thresholdAmp = Math.pow(10, thresholdDb / 20);
      const kneeEndDb = Math.min(thresholdDb + kneeDb, 0);
      const kneeEndAmp = Math.pow(10, kneeEndDb / 20);

      const upperThresholdY = amp - thresholdAmp * amp;
      const upperKneeTopY = amp - kneeEndAmp * amp;

      // Ratio affects knee intensity: higher ratio = more visible knee
      const getIntensityFromRatio = (r: number): number => {
        if (r <= 1) return 0.15;
        if (r <= 2) return 0.25;
        if (r <= 4) return 0.35;
        if (r <= 10) return 0.45;
        return 0.55;
      };
      const maxAlpha = getIntensityFromRatio(ratio);

      // Upper knee: gradient from threshold to knee top (sharper)
      const upperGradient = ctx.createLinearGradient(
        0,
        upperThresholdY,
        0,
        upperKneeTopY
      );
      upperGradient.addColorStop(0, `rgba(255, 159, 67, ${maxAlpha})`);
      upperGradient.addColorStop(0.7, `rgba(255, 159, 67, ${maxAlpha * 0.5})`);
      upperGradient.addColorStop(1, `rgba(255, 159, 67, 0.05)`);

      ctx.fillStyle = upperGradient;
      ctx.fillRect(
        waveAreaX,
        upperKneeTopY,
        width,
        upperThresholdY - upperKneeTopY
      );

      // Lower knee (mirrored - only below threshold toward center)
      const lowerThresholdY = amp + thresholdAmp * amp;
      const lowerKneeBottomY = amp + kneeEndAmp * amp;

      const lowerGradient = ctx.createLinearGradient(
        0,
        lowerThresholdY,
        0,
        lowerKneeBottomY
      );
      lowerGradient.addColorStop(0, `rgba(255, 159, 67, ${maxAlpha})`);
      lowerGradient.addColorStop(0.7, `rgba(255, 159, 67, ${maxAlpha * 0.5})`);
      lowerGradient.addColorStop(1, `rgba(255, 159, 67, 0.05)`);

      ctx.fillStyle = lowerGradient;
      ctx.fillRect(
        waveAreaX,
        lowerThresholdY,
        width,
        lowerKneeBottomY - lowerThresholdY
      );

      // Draw ratio hatching lines (slope depends on ratio)
      if (ratio >= 1) {
        const lineSpacing = 20;

        // Upper knee hatching
        const upperKneeHeight = upperThresholdY - upperKneeTopY;
        const upperHorizontalOffset = upperKneeHeight * (1 - 1 / ratio);

        ctx.save();
        ctx.beginPath();
        ctx.rect(waveAreaX, upperKneeTopY, width, upperKneeHeight);
        ctx.clip();

        ctx.strokeStyle = `rgba(255, 159, 67, 0.35)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        for (
          let x = waveAreaX - upperHorizontalOffset;
          x < totalWidth + upperHorizontalOffset;
          x += lineSpacing
        ) {
          ctx.beginPath();
          ctx.moveTo(x, upperThresholdY);
          ctx.lineTo(x + upperHorizontalOffset, upperKneeTopY);
          ctx.stroke();
        }

        ctx.restore();

        // Lower knee hatching (mirrored)
        const lowerKneeHeight = lowerKneeBottomY - lowerThresholdY;
        const lowerHorizontalOffset = lowerKneeHeight * (1 - 1 / ratio);

        ctx.save();
        ctx.beginPath();
        ctx.rect(waveAreaX, lowerThresholdY, width, lowerKneeHeight);
        ctx.clip();

        ctx.strokeStyle = `rgba(255, 159, 67, 0.35)`;
        ctx.lineWidth = 1;

        for (
          let x = waveAreaX - lowerHorizontalOffset;
          x < totalWidth + lowerHorizontalOffset;
          x += lineSpacing
        ) {
          ctx.beginPath();
          ctx.moveTo(x, lowerThresholdY);
          ctx.lineTo(x + lowerHorizontalOffset, lowerKneeBottomY);
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    // Draw waveform
    if (showWaveform && audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / width);

      ctx.beginPath();
      ctx.moveTo(waveAreaX, amp);
      ctx.strokeStyle = "rgba(0, 217, 255, 0.8)";
      ctx.lineWidth = 1;

      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;

        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }

        ctx.lineTo(waveAreaX + i, (1 + min) * amp);
        ctx.lineTo(waveAreaX + i, (1 + max) * amp);
      }

      ctx.stroke();
    }

    // Draw envelope overlay (input level envelope - what compressor sees)
    if (showEnvelope && envelope && originalBuffer) {
      const thresholdAmp = thresholdDb < 0 ? Math.pow(10, thresholdDb / 20) : 1;
      const kneeStartDb = thresholdDb - kneeDb / 2;
      const kneeEndDb = Math.min(thresholdDb + kneeDb / 2, 0);
      const kneeStartAmp = Math.pow(10, kneeStartDb / 20);
      const kneeEndAmp = Math.pow(10, kneeEndDb / 20);

      // Calculate ratio influence (how much ratio affects visual intensity)
      const ratioInfluence = ratio <= 1 ? 0 : Math.min((ratio - 1) / 19, 1);

      // Draw envelope line segment by segment with color based on level
      for (let i = 0; i < width - 1; i++) {
        const envValue = envelope[i];
        const nextEnvValue = envelope[i + 1];

        const color = getEnvelopeColor(
          envValue,
          thresholdAmp,
          kneeStartAmp,
          kneeEndAmp,
          ratioInfluence
        );

        // Upper envelope
        ctx.beginPath();
        ctx.moveTo(waveAreaX + i, amp - envValue * amp);
        ctx.lineTo(waveAreaX + i + 1, amp - nextEnvValue * amp);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Lower envelope (mirrored)
        ctx.beginPath();
        ctx.moveTo(waveAreaX + i, amp + envValue * amp);
        ctx.lineTo(waveAreaX + i + 1, amp + nextEnvValue * amp);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw Gain Reduction Overlay (red line from 0 dB downward)
    if (showGainReduction && gainReduction && ratio > 1) {
      // Draw GR as a filled area from 0 dB down to GR level
      ctx.beginPath();
      ctx.moveTo(waveAreaX, 0);

      for (let i = 0; i < width; i++) {
        const gr = gainReduction[i];
        const grY = Math.min((gr / MAX_GAIN_REDUCTION_DB) * amp, amp);
        ctx.lineTo(waveAreaX + i, grY);
      }

      ctx.lineTo(waveAreaX + width, 0);
      ctx.closePath();

      const grGradient = ctx.createLinearGradient(0, 0, 0, amp);
      grGradient.addColorStop(0, "rgba(255, 80, 80, 0.1)");
      grGradient.addColorStop(1, "rgba(255, 50, 50, 0.4)");
      ctx.fillStyle = grGradient;
      ctx.fill();

      // Draw GR line
      ctx.beginPath();
      ctx.moveTo(waveAreaX, (gainReduction[0] / MAX_GAIN_REDUCTION_DB) * amp);

      for (let i = 1; i < width; i++) {
        const gr = gainReduction[i];
        const grY = Math.min((gr / MAX_GAIN_REDUCTION_DB) * amp, amp);
        ctx.lineTo(waveAreaX + i, grY);
      }

      ctx.strokeStyle = "rgba(255, 80, 80, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw threshold line (on top)
    if (showThresholdKnee && thresholdDb < 0) {
      const thresholdAmp = Math.pow(10, thresholdDb / 20);
      const upperY = amp - thresholdAmp * amp;
      const lowerY = amp + thresholdAmp * amp;

      ctx.strokeStyle = "#ff9f43";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      ctx.beginPath();
      ctx.moveTo(waveAreaX, upperY);
      ctx.lineTo(totalWidth, upperY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(waveAreaX, lowerY);
      ctx.lineTo(totalWidth, lowerY);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }, [
    audioBuffer,
    originalBuffer,
    envelope,
    gainReduction,
    thresholdDb,
    kneeDb,
    ratio,
    width,
    height,
    totalWidth,
    showWaveform,
    showEnvelope,
    showGainReduction,
    showThresholdKnee,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: totalWidth,
        height: height,
        borderRadius: 8,
        display: "block",
      }}
    />
  );
};
