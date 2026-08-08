const listeners = {};
const errors = [];
const elements = new Map();
const makeElement = (extra = {}) => Object.assign({
  hidden: false,
  textContent: "",
  className: "",
  disabled: false,
  addEventListener(name, handler) { listeners[`${this.id}:${name}`] = handler; },
}, extra);

const button = makeElement({ id: "send-button" });
const form = makeElement({ id: "send-form", querySelector: () => button });
for (const id of [
  "status", "incoming-notification", "incoming-from", "incoming-text",
  "dismiss-notification", "latest-waiting", "latest-message", "latest-from",
  "latest-text", "latest-received", "latest-message-id",
]) elements.set(`#${id}`, makeElement({ id }));
elements.set("#send-form", form);
elements.get("#incoming-notification").hidden = true;
elements.get("#latest-message").hidden = true;

globalThis.document = { querySelector: (selector) => elements.get(selector) };
globalThis.FormData = class { entries() { return [["to", "919818999197"], ["customerName", "John Doe"], ["orderNumber", "123456"], ["date", "Aug 8, 2026"]]; } };
console.error = (...values) => errors.push(values.join(" "));

let latest = {
  messageId: "wamid.mock-1",
  from: "919811111111",
  text: "Hello TV",
  timestamp: "1786200000",
  receivedAt: "2026-08-08T10:12:10.000Z",
};
globalThis.fetch = async (url) => url === "/api/messages/latest"
  ? { ok: true, json: async () => ({ success: true, message: latest }) }
  : { ok: true, json: async () => ({ success: true, messageId: "wamid.outgoing" }) };

let poll;
globalThis.setInterval = (handler, milliseconds) => {
  if (milliseconds !== 2000) throw new Error("Polling interval changed");
  poll = handler;
  return 1;
};

await import("./public/tv.js");
await new Promise((resolve) => setTimeout(resolve, 0));

const initial = {
  waitingHidden: elements.get("#latest-waiting").hidden,
  detailsVisible: !elements.get("#latest-message").hidden,
  from: elements.get("#latest-from").textContent,
  text: elements.get("#latest-text").textContent,
  messageId: elements.get("#latest-message-id").textContent,
  overlayVisible: !elements.get("#incoming-notification").hidden,
};

listeners["dismiss-notification:click"]();
await poll();
const duplicateStayedHidden = elements.get("#incoming-notification").hidden;

await listeners["send-form:submit"]({ preventDefault() {} });
const sendStatus = elements.get("#status").textContent;

console.log(JSON.stringify({ initial, duplicateStayedHidden, sendStatus, errors }));
