import { Plus } from "lucide-react";

type MissionPanelProps = {
  mission: string;
  capture: string;
  nowTitle?: string;
  onMissionChange: (mission: string) => void;
  onCaptureChange: (capture: string) => void;
  onAddCaptureTasks: () => void;
};

export function MissionPanel({
  mission,
  capture,
  nowTitle,
  onMissionChange,
  onCaptureChange,
  onAddCaptureTasks,
}: MissionPanelProps) {
  return (
    <section className="mission-grid" aria-label="Session setup">
      <div className="mission-block">
        <label htmlFor="mission">Mission</label>
        <textarea
          id="mission"
          value={mission}
          onChange={(event) => onMissionChange(event.target.value)}
          placeholder="By the end, I want..."
          rows={4}
        />
      </div>

      <div className="capture-block">
        <label htmlFor="capture">Today</label>
        <textarea
          id="capture"
          value={capture}
          onChange={(event) => onCaptureChange(event.target.value)}
          placeholder="Read PR #83&#10;Ask agent to review D3 evidence&#10;Park homepage copy"
          rows={4}
        />
        <button className="primary-button" type="button" onClick={onAddCaptureTasks} disabled={!capture.trim()}>
          <Plus size={16} />
          Add lines
        </button>
      </div>

      <aside className="now-strip" aria-label="Active thread">
        <span>Active Thread</span>
        <strong>{nowTitle ?? "Nothing selected"}</strong>
      </aside>
    </section>
  );
}
