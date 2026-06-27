export default function Spinner({ dark = false, size = 20 }) {
  return (
    <span
      className={`spinner ${dark ? 'spinner-dark' : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
