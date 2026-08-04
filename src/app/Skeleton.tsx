/**
 * What the screen shows while the next page is being built.
 *
 * Without this a menu click does nothing visible until the server has finished
 * — the click looks ignored, however fast the page actually is. This appears
 * immediately and is replaced when the real page streams in.
 */
export default function Skeleton() {
  return (
    <div className="skel">
      <div className="skel-rail">
        {Array.from({ length: 9 }, (_, i) => <span key={i} className="skel-line" />)}
      </div>
      <div className="skel-main">
        <span className="skel-line skel-title" />
        <div className="skel-panel">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="skel-line" />)}
        </div>
      </div>
    </div>
  );
}
