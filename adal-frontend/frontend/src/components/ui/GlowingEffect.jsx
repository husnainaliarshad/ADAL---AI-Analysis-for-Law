import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import "./glowingEffect.css";

const joinClassNames = (...classes) => classes.filter(Boolean).join(" ");

const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.06,
    proximity = 64,
    spread = 28,
    variant = "default",
    glow = true,
    className,
    disabled,
    borderWidth = 1.5,
  }) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const isDisabled = Boolean(disabled);

    const containerRef = useRef(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef(0);

    const colorTokens = useMemo(() => {
      if (variant === "white") {
        return {
          spotColor: alpha("#ffffff", 0.92),
          spotColorMid: alpha("#ffffff", 0.42),
        };
      }

      return {
        spotColor: alpha(theme.palette.primary.light || theme.palette.primary.main, isDarkMode ? 0.88 : 0.8),
        spotColorMid: alpha(theme.palette.primary.main, isDarkMode ? 0.42 : 0.34),
      };
    }, [isDarkMode, theme, variant]);

    const handleMove = useCallback(
      (eventLike) => {
        if (isDisabled || !containerRef.current) {
          return;
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) {
            return;
          }

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = eventLike?.x ?? lastPosition.current.x;
          const mouseY = eventLike?.y ?? lastPosition.current.y;

          if (eventLike) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          const centerX = left + width * 0.5;
          const centerY = top + height * 0.5;
          const distanceFromCenter = Math.hypot(mouseX - centerX, mouseY - centerY);
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "1" : "0");
          if (!isActive) {
            return;
          }

          const normalizedX = ((mouseX - left) / width) * 100;
          const normalizedY = ((mouseY - top) / height) * 100;
          element.style.setProperty("--x", `${Math.max(0, Math.min(100, normalizedX))}%`);
          element.style.setProperty("--y", `${Math.max(0, Math.min(100, normalizedY))}%`);
        });
      },
      [inactiveZone, isDisabled, proximity]
    );

    useEffect(() => {
      if (isDisabled) {
        return undefined;
      }

      const onScroll = () => handleMove();
      const onPointerMove = (event) => handleMove(event);

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointerMove);
      };
    }, [handleMove, isDisabled]);

    const rootStyle = useMemo(
      () => ({
        "--blur": `${blur}px`,
        "--spot-size": `${Math.max(180, spread * 10)}px`,
        "--active": "0",
        "--x": "50%",
        "--y": "50%",
        "--glowingeffect-border-width": `${borderWidth}px`,
        "--spot-color": colorTokens.spotColor,
        "--spot-color-mid": colorTokens.spotColorMid,
      }),
      [blur, borderWidth, colorTokens, spread]
    );

    return (
      <>
        <div
          className={joinClassNames(
            "adal-glowing-border-fallback",
            glow && "is-visible",
            variant === "white" ? "is-white" : "is-default",
            !isDisabled && "is-hidden"
          )}
        />
        <div
          ref={containerRef}
          style={rootStyle}
          className={joinClassNames(
            "adal-glowing-effect",
            blur > 0 && "is-blurred",
            isDisabled && "is-hidden",
            className
          )}
        >
          <div className="adal-glow-core" />
        </div>
      </>
    );
  }
);

GlowingEffect.displayName = "GlowingEffect";

export default GlowingEffect;
export { GlowingEffect };
