type Props = {
  variant?: 'login' | 'panel';
};

function AdeinAnimatedBackground({ variant = 'login' }: Props) {
  return (
    <div className={`crm-animated-background ${variant}-variant`} aria-hidden="true">
      <div className="login-background">
        <div className="arch-grid">
          <div className="grid-major" />
          <div className="grid-minor" />
        </div>
        <div className="measuring-lines">
          <div className="m-line m-h1" />
          <div className="m-line m-h2" />
          <div className="m-line m-h3" />
          <div className="m-line m-v1" />
          <div className="m-line m-v2" />
          <div className="m-line m-v3" />
        </div>
        <div className="terrain-shapes">
          <div className="lot lot-1" />
          <div className="lot lot-2" />
          <div className="lot lot-3" />
          <div className="lot lot-4" />
        </div>
        <div className="reference-points">
          <div className="ref-point rp-1" />
          <div className="ref-point rp-2" />
          <div className="ref-point rp-3" />
          <div className="ref-point rp-4" />
          <div className="ref-point rp-5" />
        </div>
        <div className="location-rings">
          <div className="loc-ring lr-1" />
          <div className="loc-ring lr-2" />
          <div className="loc-ring lr-3" />
        </div>
      </div>
    </div>
  );
}

export default AdeinAnimatedBackground;
