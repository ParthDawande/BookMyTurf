export default function TurfCard({ turf, onClick }) {
  // API returns snake_case field names
  const { name, city, sports, cover_photo_url, min_hourly_price } = turf;
  const avg_rating  = turf.avg_rating;
  const review_count = turf.review_count;

  const ratingDisplay = review_count > 0
    ? `${Number(avg_rating).toFixed(1)} ★ (${review_count} review${review_count !== 1 ? 's' : ''})`
    : 'No ratings yet';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#fff',
        transition: 'box-shadow 0.2s, transform 0.15s',
        outline: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Cover photo — null-safe: SVG placeholder when cover_photo_url is null */}
      {cover_photo_url ? (
        <img
          src={cover_photo_url}
          alt={name}
          style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          aria-label={`${name} — no cover photo`}
          style={{
            width: '100%',
            height: '160px',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2e86de 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ marginRight: '0.5rem', flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.3 }}>{name}</span>
        </div>
      )}

      <div style={{ padding: '0.85rem' }}>
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1rem', color: '#1e3a5f', fontWeight: 600 }}>{name}</h3>
        <p style={{ margin: '0 0 0.5rem', color: '#777', fontSize: '0.83rem' }}>{city}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.6rem' }}>
          {sports?.map(s => (
            <span key={s} style={{
              background: '#e8f0fe',
              color: '#1e3a5f',
              fontSize: '0.72rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '999px',
              fontWeight: 500,
            }}>
              {s}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.83rem' }}>
          <span style={{ color: review_count > 0 ? '#d97706' : '#9ca3af' }}>{ratingDisplay}</span>
          {min_hourly_price && (
            <span style={{ color: '#2e86de', fontWeight: 600 }}>
              ₹{Number(min_hourly_price).toLocaleString()}/hr
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
