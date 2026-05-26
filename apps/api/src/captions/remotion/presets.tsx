import React from "react";
import type { CaptionEffect, CaptionPosition } from "../../types";
import type { CaptionPage, CaptionToken } from "./types";

type PresetProps = {
  page: CaptionPage;
  activeToken: CaptionToken | undefined;
  position: CaptionPosition;
  effect: CaptionEffect;
};

const positionToFlex: Record<CaptionPosition, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const positionToMargin: Record<CaptionPosition, number> = {
  top: 60,
  center: 0,
  bottom: 60,
};

function Wrapper({
  children,
  position,
}: {
  children: React.ReactNode;
  position: CaptionPosition;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: positionToFlex[position],
        justifyContent: "center",
        paddingTop: position === "top" ? positionToMargin.top : undefined,
        paddingBottom: position === "bottom" ? positionToMargin.bottom : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  gap = 4,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap,
        padding: "8px 16px",
        maxWidth: "90%",
      }}
    >
      {children}
    </div>
  );
}

function WordPill(
  props: {
    text: string;
    isActive: boolean;
    activeColor?: string;
    bgColor?: string;
    textColor?: string;
    fontSize?: number;
    fontWeight?: number;
    fontFamily?: string;
    padding?: string;
    borderRadius?: number;
    activeScale?: number;
    activeBgColor?: string;
  } & { key?: string | number },
) {
  const {
    text,
    isActive,
    activeColor = "#FCD34D",
    bgColor = "rgba(0,0,0,0.75)",
    textColor = "#FFFFFF",
    fontSize = 28,
    fontWeight = 700,
    fontFamily = "system-ui, sans-serif",
    padding = "6px 10px",
    borderRadius = 6,
    activeScale = 1.08,
    activeBgColor,
  } = props;
  return (
    <span
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight,
        fontFamily,
        lineHeight: 1.3,
        color: isActive ? activeColor : textColor,
        backgroundColor: isActive ? activeBgColor || bgColor : bgColor,
        borderRadius,
        transform: isActive ? `scale(${activeScale})` : "scale(1)",
        transition: "transform 0.05s ease-out",
      }}
    >
      {text}
    </span>
  );
}

export function BasicPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <WordPill
            key={token.index}
            text={token.text}
            isActive={token.index === activeToken?.index}
            bgColor="transparent"
            textColor="#FFFFFF"
            activeColor="#FFFFFF"
            fontSize={32}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
            padding="2px 4px"
            borderRadius={0}
            activeScale={1}
            activeBgColor="rgba(0,0,0,0.6)"
          />
        ))}
      </Row>
    </Wrapper>
  );
}

export function ModernPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <WordPill
            key={token.index}
            text={token.text}
            isActive={token.index === activeToken?.index}
            bgColor="rgba(0,0,0,0.7)"
            textColor="#E2E8F0"
            activeColor="#60A5FA"
            fontSize={28}
            fontWeight={600}
            fontFamily="system-ui, sans-serif"
            padding="4px 8px"
            borderRadius={8}
          />
        ))}
      </Row>
    </Wrapper>
  );
}

export function ScribblePreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 6,
          padding: "12px 20px",
          maxWidth: "90%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "3px dashed #FCD34D",
            borderRadius: 16,
            transform: "rotate(-1deg)",
            opacity: 0.7,
          }}
        />
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "4px 6px",
              fontSize: 30,
              fontWeight: 800,
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif",
              lineHeight: 1.3,
              color: token.index === activeToken?.index ? "#FCD34D" : "#FFFFFF",
              backgroundColor:
                token.index === activeToken?.index ? "rgba(0,0,0,0.5)" : "transparent",
              borderRadius: 4,
              transform: token.index === activeToken?.index ? "rotate(1deg)" : "rotate(0deg)",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </Wrapper>
  );
}

export function FunkyPreset({ page, activeToken, position, effect }: PresetProps) {
  const colors = ["#FF6B6B", "#FFE66D", "#4ECDC4", "#A78BFA", "#FB923C"];
  return (
    <Wrapper position={position}>
      <Row gap={6}>
        {page.tokens.map((token, i) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "6px 12px",
              fontSize: 26,
              fontWeight: 900,
              fontFamily: "'Arial Black', Impact, sans-serif",
              color: token.index === activeToken?.index ? "#FFFFFF" : colors[i % colors.length],
              textShadow:
                token.index === activeToken?.index
                  ? "2px 2px 0 #000, -1px -1px 0 #000"
                  : "1px 1px 0 #000",
              transform: token.index === activeToken?.index ? "scale(1.15) rotate(-2deg)" : "scale(1)",
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function AliPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "16px 24px",
          maxWidth: "90%",
        }}
      >
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "2px 4px",
              fontSize: token.index === activeToken?.index ? 40 : 34,
              fontWeight: 900,
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              color: token.index === activeToken?.index ? "#FFFFFF" : "#CCCCCC",
              textTransform: "uppercase",
              letterSpacing: token.index === activeToken?.index ? 2 : 0,
              textShadow:
                token.index === activeToken?.index
                  ? "3px 3px 0 #E11D48, -1px -1px 0 #000"
                  : "1px 1px 0 #000",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </Wrapper>
  );
}

export function ClassicPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <WordPill
            key={token.index}
            text={token.text}
            isActive={token.index === activeToken?.index}
            bgColor="rgba(0,0,0,0.8)"
            textColor="#FFFFFF"
            activeColor="#FFFFFF"
            fontSize={30}
            fontWeight={700}
            fontFamily="Georgia, 'Times New Roman', serif"
            padding="4px 8px"
            borderRadius={4}
            activeBgColor="#1D4ED8"
          />
        ))}
      </Row>
    </Wrapper>
  );
}

export function HeatPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "4px 8px",
              fontSize: 32,
              fontWeight: 900,
              fontFamily: "'Arial Black', sans-serif",
              color: token.index === activeToken?.index ? "#F97316" : "#FEE2E2",
              textShadow:
                token.index === activeToken?.index
                  ? "0 0 20px rgba(249,115,22,0.8), 0 0 40px rgba(249,115,22,0.4)"
                  : "0 0 10px rgba(254,226,226,0.3)",
              backgroundColor:
                token.index === activeToken?.index ? "rgba(0,0,0,0.6)" : "transparent",
              borderRadius: 8,
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function IcyPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "4px 10px",
              fontSize: 28,
              fontWeight: 600,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              color: token.index === activeToken?.index ? "#22D3EE" : "#CFFAFE",
              textShadow:
                token.index === activeToken?.index
                  ? "0 0 15px rgba(34,211,238,0.7), 0 0 30px rgba(34,211,238,0.3)"
                  : "none",
              backgroundColor:
                token.index === activeToken?.index ? "rgba(0,30,50,0.7)" : "rgba(0,0,0,0.4)",
              borderRadius: 12,
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function GhostPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "3px 6px",
              fontSize: 34,
              fontWeight: 300,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              color: token.index === activeToken?.index ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              opacity: token.index === activeToken?.index ? 1 : 0.35,
              textShadow:
                token.index === activeToken?.index
                  ? "0 0 20px rgba(255,255,255,0.5)"
                  : "none",
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function EditorialPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "16px 24px",
          maxWidth: "85%",
          borderLeft: "3px solid #FCD34D",
        }}
      >
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline",
              padding: "1px 2px",
              fontSize: 26,
              fontWeight: token.index === activeToken?.index ? 700 : 400,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: "italic",
              color: token.index === activeToken?.index ? "#FCD34D" : "#E2E8F0",
              backgroundColor:
                token.index === activeToken?.index ? "rgba(0,0,0,0.3)" : "transparent",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </Wrapper>
  );
}

export function TallboyPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "12px 20px",
          maxWidth: "85%",
        }}
      >
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "block",
              padding: "2px 4px",
              fontSize: 38,
              fontWeight: 800,
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.1,
              color: token.index === activeToken?.index ? "#FFFFFF" : "rgba(255,255,255,0.7)",
              textShadow:
                token.index === activeToken?.index
                  ? "2px 2px 0 #000, 4px 4px 0 rgba(0,0,0,0.5)"
                  : "1px 1px 0 #000",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </Wrapper>
  );
}

export function ElegantPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "4px 8px",
              fontSize: 28,
              fontWeight: 500,
              fontFamily: "'Georgia', 'Times New Roman', serif",
              color: token.index === activeToken?.index ? "#C084FC" : "#E9D5FF",
              backgroundColor:
                token.index === activeToken?.index ? "rgba(0,0,0,0.5)" : "transparent",
              borderRadius: 4,
              borderBottom:
                token.index === activeToken?.index ? "2px solid #C084FC" : "none",
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function HormoziPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: token.index === activeToken?.index ? "6px 12px" : "6px 10px",
              fontSize: 30,
              fontWeight: 800,
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: token.index === activeToken?.index ? "#000000" : "#FFFFFF",
              backgroundColor:
                token.index === activeToken?.index ? "#FCD34D" : "rgba(0,0,0,0.85)",
              borderRadius: 4,
              transform: token.index === activeToken?.index ? "scale(1.05)" : "scale(1)",
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function CleanPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "4px 8px",
              fontSize: 28,
              fontWeight: 600,
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              color: token.index === activeToken?.index ? "#000000" : "#FFFFFF",
              backgroundColor:
                token.index === activeToken?.index ? "#FFFFFF" : "rgba(0,0,0,0.6)",
              borderRadius: 2,
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function RoundtablePreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "8px 16px",
              fontSize: 26,
              fontWeight: 700,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              color: token.index === activeToken?.index ? "#1E293B" : "#FFFFFF",
              backgroundColor:
                token.index === activeToken?.index ? "#FCD34D" : "rgba(30,41,59,0.85)",
              borderRadius: 999,
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function MatrixPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row gap={2}>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "3px 6px",
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "'Courier New', 'JetBrains Mono', monospace",
              color: token.index === activeToken?.index ? "#00FF41" : "#00CC33",
              textShadow:
                token.index === activeToken?.index
                  ? "0 0 10px #00FF41, 0 0 20px #00FF41"
                  : "0 0 5px #00CC33",
              backgroundColor: "rgba(0,0,0,0.7)",
              border: `1px solid ${token.index === activeToken?.index ? "#00FF41" : "transparent"}`,
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function BubblyPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <Row gap={6}>
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "8px 16px",
              fontSize: 26,
              fontWeight: 800,
              fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif",
              color: token.index === activeToken?.index ? "#FFFFFF" : "#1E293B",
              backgroundColor:
                token.index === activeToken?.index
                  ? "#8B5CF6"
                  : "rgba(255,255,255,0.9)",
              borderRadius: 999,
              transform:
                token.index === activeToken?.index
                  ? "scale(1.1) rotate(-2deg)"
                  : "scale(1)",
              boxShadow:
                token.index === activeToken?.index
                  ? "0 4px 15px rgba(139,92,246,0.6)"
                  : "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {token.text}
          </span>
        ))}
      </Row>
    </Wrapper>
  );
}

export function MinerPreset({ page, activeToken, position, effect }: PresetProps) {
  return (
    <Wrapper position={position}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 2,
          padding: "10px 16px",
          maxWidth: "90%",
          backgroundColor: "rgba(0,0,0,0.8)",
          border: "2px solid #F97316",
          borderRadius: 8,
        }}
      >
        {page.tokens.map((token) => (
          <span
            key={token.index}
            style={{
              display: "inline-block",
              padding: "2px 6px",
              fontSize: 28,
              fontWeight: 900,
              fontFamily: "'Arial Black', sans-serif",
              textTransform: "uppercase",
              color: token.index === activeToken?.index ? "#F97316" : "#FED7AA",
              textShadow:
                token.index === activeToken?.index
                  ? "0 0 8px rgba(249,115,22,0.6)"
                  : "none",
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </Wrapper>
  );
}

export const presetMap: Record<string, React.FC<PresetProps>> = {
  basic: BasicPreset,
  modern: ModernPreset,
  scribble: ScribblePreset,
  funky: FunkyPreset,
  ali: AliPreset,
  classic: ClassicPreset,
  heat: HeatPreset,
  icy: IcyPreset,
  ghost: GhostPreset,
  editorial: EditorialPreset,
  tallboy: TallboyPreset,
  elegant: ElegantPreset,
  hormozi: HormoziPreset,
  clean: CleanPreset,
  roundtable: RoundtablePreset,
  matrix: MatrixPreset,
  bubbly: BubblyPreset,
  miner: MinerPreset,
};
