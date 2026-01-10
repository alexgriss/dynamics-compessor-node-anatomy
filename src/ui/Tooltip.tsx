import { FC, ReactNode, useState } from "react";

interface ITooltip {
  content: ReactNode;
  children: ReactNode;
}

export const Tooltip: FC<ITooltip> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(20, 20, 30, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 8,
            padding: "12px 14px",
            minWidth: 260,
            maxWidth: 320,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {typeof content === "string" ? (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.9)",
                whiteSpace: "pre-line",
                textAlign: "left",
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.9)",
                whiteSpace: "pre-line",
                textAlign: "left",
              }}
            >
              {content}
            </div>
          )}
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "rgba(20, 20, 30, 0.95)",
              borderRight: "1px solid rgba(255, 255, 255, 0.15)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          />
        </div>
      )}
    </div>
  );
};

export const HelpIcon: FC = () => (
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
    style={{ opacity: 0.4, cursor: "help" }}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);
