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
let lastDisplayedMessageId = null;

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

function displayIncomingMessage(message) {
  if (!message?.messageId || message.messageId === lastDisplayedMessageId) {
    return false;
  }

  lastDisplayedMessageId = message.messageId;
  const formattedFrom = formatPhoneNumber(message.from);
  latestFrom.textContent = formattedFrom;
  latestText.textContent = message.text;
  latestReceived.textContent = formatReceivedTime(message);
  latestMessageId.textContent = message.messageId;
  latestWaiting.hidden = true;
  latestMessage.hidden = false;

  incomingFrom.textContent = formattedFrom;
  incomingText.textContent = message.text;
  incomingNotification.hidden = false;
  return true;
}

async function pollLatestMessage() {
  try {
    const response = await fetch("/api/messages/latest", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Latest message request failed");
    }

    if (result.message) {
      displayIncomingMessage(result.message);
    }
  } catch (error) {
    console.error("Incoming message polling failed:", error);
  }
}

dismissNotification.addEventListener("click", () => {
  incomingNotification.hidden = true;
});

pollLatestMessage();
setInterval(pollLatestMessage, 2000);
