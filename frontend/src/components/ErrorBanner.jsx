const styles = {
  banner: {
    background: 'var(--color-error-light)',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-3) var(--space-4)',
    marginBottom: 'var(--space-4)',
    fontSize: 'var(--font-size-sm)',
  },
};

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div style={styles.banner} role="alert">{error}</div>;
}
