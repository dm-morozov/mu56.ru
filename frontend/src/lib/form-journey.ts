import type { AnalyticsParams, Goal } from "./analytics";

// One opening of the form, with no customer values or persistent identifiers.
export class FormJourney {
  private opened = false;
  private started = false;
  private saved = false;
  private phoneReady = false;
  private lastField = "unknown";
  private openedAt = 0;
  private attempts = 0;
  private context: AnalyticsParams = {};
  private fields = new Set<string>();
  constructor(private emit: (goal: Goal, params: AnalyticsParams) => unknown, private now = Date.now) {}
  open(context: AnalyticsParams) {
    this.opened = true; this.started = false; this.saved = false; this.phoneReady = false;
    this.lastField = "unknown"; this.attempts = 0; this.openedAt = this.now(); this.context = context; this.fields.clear();
    this.emit("form_open", context);
  }
  update(context: AnalyticsParams) { this.context = { ...this.context, ...context }; }
  private params(extra: AnalyticsParams = {}) { return { ...this.context, started: this.started, phone_ready: this.phoneReady, field: this.lastField, seconds: Math.floor((this.now() - this.openedAt) / 1000), attempt: this.attempts, ...extra }; }
  focus(field: string) { if (this.opened && !this.saved) this.lastField = field; }
  change(field: string, phoneReady = false) {
    if (!this.opened || this.saved) return;
    this.lastField = field;
    if (!this.started) { this.started = true; this.emit("form_start", this.params()); }
    if (!this.fields.has(field)) { this.fields.add(field); this.emit("form_progress", this.params()); }
    if (phoneReady && !this.phoneReady) { this.phoneReady = true; this.emit("contact_ready", this.params()); }
  }
  invalid(field: string) { this.focus(field); this.emit("validation_error", this.params({ reason: "validation" })); }
  submit() { this.attempts++; this.emit("form_submit", this.params()); }
  error(reason: string, status = 0) { this.emit("submit_error", this.params({ reason, status })); }
  success() { if (this.saved) return; this.saved = true; this.emit("lead_success", this.params()); }
  close(reason: "close" | "pagehide") {
    if (!this.opened) return;
    this.opened = false;
    if (!this.saved) this.emit("form_abandon", this.params({ reason }));
  }
  resume() { if (!this.opened && !this.saved) { this.opened = true; this.emit("form_open", this.params({ resumed: true })); } }
}
