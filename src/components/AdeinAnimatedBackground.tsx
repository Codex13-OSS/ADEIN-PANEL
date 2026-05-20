type Props = {
  variant?: 'login' | 'panel';
};

const measurementLinesX = ['18%', '42%', '66%', '84%'];
const measurementLinesY = ['14%', '38%', '62%', '86%'];
const lotShapes = [
  { top: '20%', left: '12%', width: '18%', height: '12%', rotate: '-4deg' },
  { top: '54%', left: '24%', width: '22%', height: '15%', rotate: '3deg' },
  { top: '30%', left: '61%', width: '20%', height: '13%', rotate: '-2deg' },
  { top: '68%', left: '70%', width: '15%', height: '11%', rotate: '5deg' },
];
const referencePoints = [
  { top: '24%', left: '28%' },
  { top: '44%', left: '58%' },
  { top: '70%', left: '36%' },
  { top: '62%', left: '78%' },
];
const locationPulses = [
  { top: '34%', left: '18%' },
  { top: '58%', left: '67%' },
  { top: '78%', left: '52%' },
];

function AdeinAnimatedBackground({ variant = 'login' }: Props) {
  return (
    <div className={`adein-bg adein-bg-${variant}`} aria-hidden="true">
      <div className="adein-bg-grid adein-bg-major" />
      <div className="adein-bg-grid adein-bg-minor" />

      {measurementLinesX.map((top) => (
        <span key={`x-${top}`} className="adein-measure-line is-horizontal" style={{ top }} />
      ))}
      {measurementLinesY.map((left) => (
        <span key={`y-${left}`} className="adein-measure-line is-vertical" style={{ left }} />
      ))}

      {lotShapes.map((shape) => (
        <span
          key={`${shape.top}-${shape.left}`}
          className="adein-lot-shape"
          style={{ top: shape.top, left: shape.left, width: shape.width, height: shape.height, transform: `rotate(${shape.rotate})` }}
        />
      ))}

      {referencePoints.map((point) => (
        <span key={`${point.top}-${point.left}`} className="adein-ref-point" style={{ top: point.top, left: point.left }} />
      ))}

      {locationPulses.map((pulse) => (
        <span key={`${pulse.top}-${pulse.left}`} className="adein-location-pulse" style={{ top: pulse.top, left: pulse.left }} />
      ))}
    </div>
  );
}

export default AdeinAnimatedBackground;
