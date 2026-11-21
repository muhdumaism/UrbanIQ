/** One-time-code delivery. MSG91 (India, DLT template) or Twilio; "console" sends nothing. */
import { env, isDemoMode } from "./env";

export class SmsError extends Error {}

export function smsReady() {
  const e = env();
  if (e.SMS_PROVIDER === "msg91") return Boolean(e.MSG91_AUTH_KEY && e.MSG91_TEMPLATE_ID);
  if (e.SMS_PROVIDER === "twilio") return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM);
  return isDemoMode(); // console delivery is only acceptable for demos
}

/** Sends the code. Returns the code only when it must be shown on screen (demo + console). */
export async function sendOtp(phone: string, code: string): Promise<{ devCode?: string }> {
  const e = env();
  if (e.SMS_PROVIDER === "console") {
    if (!isDemoMode()) throw new SmsError("Mobile sign-in isn't set up yet (no SMS provider configured).");
    console.log(`[urbaniq] demo OTP for ${phone.slice(0, 5)}*****${phone.slice(-2)}: ${code}`);
    return { devCode: code };
  }
  const ctrl = AbortSignal.timeout(10_000);
  try {
    if (e.SMS_PROVIDER === "msg91") {
      if (!e.MSG91_AUTH_KEY || !e.MSG91_TEMPLATE_ID) throw new SmsError("SMS is not configured.");
      const url = new URL("https://control.msg91.com/api/v5/otp");
      url.searchParams.set("template_id", e.MSG91_TEMPLATE_ID);
      url.searchParams.set("mobile", phone.replace(/^\+/, ""));
      url.searchParams.set("otp", code);
      const res = await fetch(url, { method: "POST", headers: { authkey: e.MSG91_AUTH_KEY, "Content-Type": "application/json" }, body: "{}", signal: ctrl });
      const body = (await res.json().catch(() => ({}))) as { type?: string };
      if (!res.ok || body.type === "error") throw new SmsError("We couldn't send the SMS. Please try again.");
      return {};
    }
    if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_FROM) throw new SmsError("SMS is not configured.");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, From: e.TWILIO_FROM, Body: `${code} is your UrbanIQ sign-in code. It expires in 5 minutes. Do not share it.` }),
      signal: ctrl,
    });
    if (!res.ok) throw new SmsError("We couldn't send the SMS. Please try again.");
    return {};
  } catch (err) {
    if (err instanceof SmsError) throw err;
    throw new SmsError("We couldn't reach the SMS service. Please try again.");
  }
}
