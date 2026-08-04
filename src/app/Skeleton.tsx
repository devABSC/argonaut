/**
 * What the content area shows while the next page is being built.
 *
 * The rail and top bar belong to the layout and stay put, so this stands in
 * for the page body only — the click is acknowledged instantly and the chrome
 * never flickers.
 */
export default function Skeleton() {
  return (
    <div className="skel-main">
      <span className="skel-line skel-title" />
      <div className="skel-panel">
        {Array.from({ length: 6 }, (_, i) => <span key={i} className="skel-line" />)}
      </div>
    </div>
  );
}
