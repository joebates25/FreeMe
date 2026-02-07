export interface Env {
  CALL_SCHEDULER: DurableObjectNamespace;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  TWILIO_TO_NUMBER: string;
}

interface ScheduledCall {
  scheduledTime: number;
  toNumber: string;
  fromNumber: string;
  status: "pending" | "completed" | "failed";
}

export class CallScheduler implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/schedule") {
      return this.scheduleCall(request);
    }

    if (request.method === "GET" && url.pathname === "/status") {
      return this.getStatus();
    }

    return new Response("Not Found", { status: 404 });
  }

  private async scheduleCall(request: Request): Promise<Response> {
    const formData = await request.formData();
    const delayMinutes = parseInt(formData.get("delay") as string, 10);

    if (isNaN(delayMinutes) || delayMinutes < 1 || delayMinutes > 60) {
      return new Response("Invalid delay. Must be 1-60 minutes.", {
        status: 400,
      });
    }

    const scheduledTime = Date.now() + delayMinutes * 60 * 1000;

    const callData: ScheduledCall = {
      scheduledTime,
      toNumber: this.env.TWILIO_TO_NUMBER,
      fromNumber: this.env.TWILIO_FROM_NUMBER,
      status: "pending",
    };

    await this.state.storage.put("scheduledCall", callData);
    await this.state.storage.setAlarm(scheduledTime);

    const formattedTime = new Date(scheduledTime).toLocaleTimeString();
    return new Response(
      JSON.stringify({
        success: true,
        message: `Call scheduled for ${formattedTime}. You can close this page.`,
        delayMinutes,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async getStatus(): Promise<Response> {
    const callData =
      await this.state.storage.get<ScheduledCall>("scheduledCall");

    if (!callData) {
      return new Response(JSON.stringify({ status: "no_call_scheduled" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: callData.status,
        scheduledTime: callData.scheduledTime,
        remainingMs: Math.max(0, callData.scheduledTime - Date.now()),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  async alarm(): Promise<void> {
    console.log("Alarm fired! Initiating Twilio call...");

    const callData =
      await this.state.storage.get<ScheduledCall>("scheduledCall");

    if (!callData || callData.status !== "pending") {
      console.log("No pending call found");
      return;
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.env.TWILIO_ACCOUNT_SID}/Calls.json`;
      const credentials = btoa(
        `${this.env.TWILIO_ACCOUNT_SID}:${this.env.TWILIO_AUTH_TOKEN}`
      );

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: callData.toNumber,
          From: callData.fromNumber,
          Url: "http://demo.twilio.com/docs/voice.xml",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twilio API error:", errorText);
        callData.status = "failed";
      } else {
        const result = (await response.json()) as { sid: string };
        console.log("Call initiated successfully, SID:", result.sid);
        callData.status = "completed";
      }

      await this.state.storage.put("scheduledCall", callData);
    } catch (error) {
      console.error("Error making Twilio call:", error);
      callData.status = "failed";
      await this.state.storage.put("scheduledCall", callData);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(getHtmlForm(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (request.method === "POST" && url.pathname === "/schedule") {
      const id = env.CALL_SCHEDULER.idFromName("global-scheduler");
      const stub = env.CALL_SCHEDULER.get(id);
      return stub.fetch(request);
    }

    if (request.method === "GET" && url.pathname === "/status") {
      const id = env.CALL_SCHEDULER.idFromName("global-scheduler");
      const stub = env.CALL_SCHEDULER.get(id);
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

function getHtmlForm(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule a Call</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 1.5em;
      margin-bottom: 20px;
      color: #333;
      text-align: center;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    select, button {
      width: 100%;
      padding: 15px;
      font-size: 16px;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    select {
      margin-bottom: 20px;
      background: white;
    }
    button {
      background: #0066ff;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #0052cc; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .message {
      margin-top: 20px;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      display: none;
    }
    .message.success {
      background: #d4edda;
      color: #155724;
      display: block;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Schedule a Call</h1>
    <form id="scheduleForm">
      <label for="delay">Call me in:</label>
      <select name="delay" id="delay" required>
        <option value="1">1 minute</option>
        <option value="2">2 minutes</option>
        <option value="5">5 minutes</option>
        <option value="10">10 minutes</option>
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">60 minutes</option>
      </select>
      <button type="submit" id="submitBtn">Schedule Call</button>
    </form>
    <div id="message" class="message"></div>
  </div>

  <script>
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('message');
      const form = e.target;

      btn.disabled = true;
      btn.textContent = 'Scheduling...';
      msg.className = 'message';

      try {
        const formData = new FormData(form);
        const response = await fetch('/schedule', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          msg.className = 'message success';
          msg.textContent = data.message;
          btn.textContent = 'Scheduled!';
        } else {
          msg.className = 'message error';
          msg.textContent = data.message || 'Failed to schedule call';
          btn.disabled = false;
          btn.textContent = 'Schedule Call';
        }
      } catch (error) {
        msg.className = 'message error';
        msg.textContent = 'Network error. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Schedule Call';
      }
    });
  </script>
</body>
</html>`;
}
