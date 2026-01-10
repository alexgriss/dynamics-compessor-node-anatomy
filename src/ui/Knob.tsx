import { FC, ReactNode, useCallback, useRef, useState } from "react";
import { HelpIcon, Tooltip } from "./Tooltip";

interface IKnob {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  tooltip?: ReactNode;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

export const Knob: FC<IKnob> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = "",
  tooltip,
  onChange,
  onChangeEnd,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const currentValue = useRef(value);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      startY.current = e.clientY;
      startValue.current = value;
      currentValue.current = value;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = startY.current - e.clientY;
        const range = max - min;
        const sensitivity = range / 150;
        let newValue = startValue.current + delta * sensitivity;
        newValue = Math.max(min, Math.min(max, newValue));
        newValue = Math.round(newValue / step) * step;
        currentValue.current = newValue;
        onChange(newValue);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        onChangeEnd?.(currentValue.current);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [value, min, max, step, onChange, onChangeEnd]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
        width: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <HelpIcon />
          </Tooltip>
        )}
      </div>
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `conic-gradient(from -135deg, #00d9ff ${
            ((value - min) / (max - min)) * 270
          }deg, #333 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          boxShadow: isDragging ? "0 0 16px #00d9ff55" : "0 2px 8px #0005",
          transition: "box-shadow 0.2s",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#1a1a2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 2,
              height: 10,
              background: "#00d9ff",
              borderRadius: 2,
              top: 4,
              transformOrigin: "center 14px",
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}
        {unit}
      </span>
    </div>
  );
};
