export function CalaLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`cala-logo${inverse ? " cala-logo-inverse" : ""}`}
      aria-label="CALA"
    >
      <span className="cala-isotype" aria-hidden="true" />
      <span>CALA</span>
    </span>
  );
}
