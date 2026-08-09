const form = document.querySelector("#send-form");
const statusElement = document.querySelector("#status");
const button = form.querySelector("button");
const incomingNotification = document.querySelector("#incoming-notification");
const incomingFrom = document.querySelector("#incoming-from");
const incomingText = document.querySelector("#incoming-text");
const dismissNotification = document.querySelector("#dismiss-notification");
const latestWaiting = document.querySelector("#latest-waiting");
const latestMessage = document.querySelector("#latest-message");
const latestFrom = document.querySelector("#latest-from");
const latestText = document.querySelector("#latest-text");
const latestReceived = document.querySelector("#latest-received");
const latestMessageId = document.querySelector("#latest-message-id");
const POLL_INTERVAL_MS = 5000;
let lastMessageId = null;
let initialPollComplete = false;
let pollInProgress = false;
let pollTimer = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  statusElement.className = "status sending";
  statusElement.textContent = "Sending...";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/whatsapp/send-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("WhatsApp send failed:", result);
      throw new Error(result.error || "Request failed");
    }

    statusElement.className = "status success";
    statusElement.textContent = "WhatsApp sent successfully";
    console.log("WhatsApp message ID:", result.messageId);
  } catch (error) {
    console.error("WhatsApp send error:", error);
    statusElement.className = "status error";
    statusElement.textContent = "Failed to send message";
  } finally {
    button.disabled = false;
  }
});

function formatPhoneNumber(phoneNumber) {
  return phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
}

function formatReceivedTime(message) {
  const value = message.receivedAt || (message.timestamp ? Number(message.timestamp) * 1000 : null);
  if (!value) return "Unknown";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleTimeString();
}

function updateLatestMessageSection(message) {
  const formattedFrom = formatPhoneNumber(message.from);
  latestFrom.textContent = formattedFrom;
  latestText.textContent = message.text;
  latestReceived.textContent = formatReceivedTime(message);
  latestMessageId.textContent = message.messageId;
  latestWaiting.hidden = true;
  latestMessage.hidden = false;
}

function showIncomingNotification(message) {
  const formattedFrom = formatPhoneNumber(message.from);

  incomingFrom.textContent = formattedFrom;
  incomingText.textContent = message.text;
  incomingNotification.hidden = false;
}

function processLatestMessage(message) {
  if (!message?.messageId) {
    return false;
  }

  updateLatestMessageSection(message);

  if (!initialPollComplete) {
    lastMessageId = message.messageId;
    initialPollComplete = true;
    return false;
  }

  if (message.messageId === lastMessageId) {
    return false;
  }

  lastMessageId = message.messageId;
  showIncomingNotification(message);
  return true;
}

async function pollLatestMessage() {
  if (pollInProgress || document.visibilityState === "hidden") {
    return;
  }

  pollInProgress = true;

  try {
    const response = await fetch("/api/messages/latest", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Latest message request failed");
    }

    if (document.visibilityState === "hidden") {
      return;
    }

    if (result.message) {
      processLatestMessage(result.message);
    } else if (!initialPollComplete) {
      initialPollComplete = true;
    }
  } catch (error) {
    console.error("Incoming message polling failed:", error);
  } finally {
    pollInProgress = false;
  }
}

function startPolling() {
  if (pollTimer !== null || document.visibilityState === "hidden") {
    return;
  }

  pollTimer = setInterval(pollLatestMessage, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer === null) {
    return;
  }

  clearInterval(pollTimer);
  pollTimer = null;
}

dismissNotification.addEventListener("click", () => {
  incomingNotification.hidden = true;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopPolling();
    return;
  }

  void pollLatestMessage();
  startPolling();
});

void pollLatestMessage();
startPolling();
