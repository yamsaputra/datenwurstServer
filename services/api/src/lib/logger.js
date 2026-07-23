// ISO 8601 timestamp for log lines, e.g. [api][2026-07-23T14:32:10.123Z]
// message. Deliberately minimal -- existing call sites interpolate this
// into their current message string rather than being restructured into a
// new logging framework, keeping this a low-risk mechanical change.
export const nowIso = () => new Date().toISOString();
