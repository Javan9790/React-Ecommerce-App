
import "dotenv/config";

const key = globalThis.process.env.MPESA_CONSUMER_KEY;
const secret = globalThis.process.env.MPESA_CONSUMER_SECRET;

if (!key || !secret) {
  console.error("M-Pesa credentials are missing from server/.env");
  globalThis.process.exitCode = 1;
} else {
  const credentials = globalThis.Buffer.from(`${key}:${secret}`).toString("base64");

  try {
    const response = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok && data.access_token) {
      console.log("M-Pesa authentication successful.");
      console.log("Access token received: yes (value hidden).");
    } else {
      console.error("M-Pesa authentication failed.");
      console.error("HTTP status:", response.status);
      console.error("Check the sandbox app credentials and API access.");
      globalThis.process.exitCode = 1;
    }
  } catch {
    console.error("Could not reach M-Pesa. Check your internet connection.");
    globalThis.process.exitCode = 1;
  }
}
