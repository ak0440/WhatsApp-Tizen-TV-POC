const form = document.querySelector("#send-form");
const statusElement = document.querySelector("#status");
const button = form.querySelector("button");
const incomingNotification = document.querySelector("#incoming-notification");
const incomingFrom = document.querySelector("#incoming-from");
const incomingText = document.querySelector("#incoming-text");
const dismissNotification = document.querySelector("#dismiss-notification");
let lastDisplayedMessageId = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  statusElement.className = "status sending";
  statusElement.textContent = "Sending...";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/whatsapp/send-template", {
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
    statusElement.textContent = "✓ WhatsApp message sent";
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

function displayIncomingMessage(message) {
  if (!message?.messageId || message.messageId === lastDisplayedMessageId) {
    return false;
  }

  lastDisplayedMessageId = message.messageId;
  incomingFrom.textContent = formatPhoneNumber(message.from);
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
