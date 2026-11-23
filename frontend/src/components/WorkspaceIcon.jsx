export default function WorkspaceIcon({ name, tone = 'green' }) {
  return (
    <span className={`workspace-icon workspace-icon--${tone}`} aria-hidden="true">
      <span className={`workspace-icon-mark workspace-icon-mark--${name}`} />
    </span>
  )
}
