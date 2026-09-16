export const getPinchPreviewTranslation = ({
  anchorX,
  anchorY,
  startCenterX,
  startCenterY,
  centerX,
  centerY,
  visualScale,
}) => ({
  x: centerX - startCenterX + ((1 - visualScale) * anchorX),
  y: centerY - startCenterY + ((1 - visualScale) * anchorY),
});

export const getAnchoredScrollPosition = ({
  pagesOffset,
  contentPoint,
  scale,
  center,
}) => Math.max(0, pagesOffset + (contentPoint * scale) - center);
