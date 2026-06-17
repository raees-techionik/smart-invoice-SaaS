import "server-only";

import { randomUUID } from "node:crypto";
import net from "node:net";
import os from "node:os";
import tls from "node:tls";

type SmtpSettings = {
  host: string;
  password?: string | null;
  port: number;
  secure: boolean;
  username?: string | null;
};

type EmailAddress = {
  email: string;
  name?: string | null;
};

type MailAttachment = {
  content: Buffer;
  contentType: string;
  filename: string;
};

type SmtpMail = {
  attachments?: MailAttachment[];
  body: string;
  cc?: string[];
  from: EmailAddress;
  replyTo?: string | null;
  subject: string;
  to: string[];
};

type SmtpResponse = {
  code: number;
  lines: string[];
};

type SmtpSocket = net.Socket | tls.TLSSocket;

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string) {
  const sanitized = sanitizeHeader(value);

  if (/^[\x20-\x7e]*$/.test(sanitized)) {
    return sanitized;
  }

  return `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function addressHeader(address: EmailAddress) {
  if (!address.name) {
    return sanitizeHeader(address.email);
  }

  return `"${encodeHeader(address.name).replace(/"/g, '\\"')}" <${sanitizeHeader(
    address.email,
  )}>`;
}

function wrapBase64(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trimEnd();
}

function textPart(body: string) {
  return [
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(body, "utf8")),
  ].join("\r\n");
}

function attachmentPart(attachment: MailAttachment) {
  return [
    `Content-Type: ${attachment.contentType}; name="${sanitizeHeader(
      attachment.filename,
    )}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${sanitizeHeader(
      attachment.filename,
    )}"`,
    "",
    wrapBase64(attachment.content),
  ].join("\r\n");
}

function messageDomain(fromEmail: string, fallbackHost: string) {
  return fromEmail.split("@")[1] || fallbackHost;
}

function buildMimeMessage(mail: SmtpMail, settings: SmtpSettings) {
  const boundary = `smart-business-${randomUUID()}`;
  const messageId = `<${randomUUID()}@${messageDomain(
    mail.from.email,
    settings.host,
  )}>`;
  const recipients = [...mail.to, ...(mail.cc ?? [])];

  if (recipients.length === 0) {
    throw new Error("Add at least one recipient before sending.");
  }

  const headers = [
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `From: ${addressHeader(mail.from)}`,
    `To: ${mail.to.map((email) => sanitizeHeader(email)).join(", ")}`,
    mail.cc && mail.cc.length > 0
      ? `Cc: ${mail.cc.map((email) => sanitizeHeader(email)).join(", ")}`
      : null,
    mail.replyTo ? `Reply-To: ${sanitizeHeader(mail.replyTo)}` : null,
    `Subject: ${encodeHeader(mail.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);
  const parts = [
    textPart(mail.body),
    ...(mail.attachments ?? []).map(attachmentPart),
  ];

  return {
    message: [
      headers.join("\r\n"),
      "",
      ...parts.map((part) => `--${boundary}\r\n${part}`),
      `--${boundary}--`,
      "",
    ].join("\r\n"),
    messageId,
    recipients,
  };
}

function hasCapability(response: SmtpResponse, capability: string) {
  return response.lines.some((line) =>
    line.toUpperCase().includes(capability.toUpperCase()),
  );
}

export async function sendSmtpMail(settings: SmtpSettings, mail: SmtpMail) {
  const { message, messageId, recipients } = buildMimeMessage(mail, settings);
  let socket: SmtpSocket | null = null;
  let buffer = "";
  let closed = false;
  let usingTls = settings.secure;
  const lineQueue: string[] = [];
  const waiters: Array<{
    reject: (error: Error) => void;
    resolve: (line: string) => void;
    timer: NodeJS.Timeout;
  }> = [];

  function rejectWaiters(error: Error) {
    while (waiters.length > 0) {
      const waiter = waiters.shift();

      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    }
  }

  function enqueueLine(line: string) {
    const waiter = waiters.shift();

    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(line);
      return;
    }

    lineQueue.push(line);
  }

  function bindSocket(nextSocket: SmtpSocket) {
    socket = nextSocket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk.toString();

      while (true) {
        const lineBreak = buffer.indexOf("\n");

        if (lineBreak === -1) {
          break;
        }

        const line = buffer.slice(0, lineBreak).replace(/\r$/, "");
        buffer = buffer.slice(lineBreak + 1);
        enqueueLine(line);
      }
    });
    socket.on("error", (error) => rejectWaiters(error));
    socket.on("close", () => {
      closed = true;
      rejectWaiters(new Error("SMTP connection closed unexpectedly."));
    });
  }

  function activeSocket() {
    if (!socket) {
      throw new Error("SMTP connection is not open.");
    }

    return socket;
  }

  function nextLine() {
    if (lineQueue.length > 0) {
      return Promise.resolve(lineQueue.shift() ?? "");
    }

    if (closed) {
      return Promise.reject(new Error("SMTP connection is closed."));
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("SMTP server response timed out.")),
        30000,
      );

      waiters.push({ reject, resolve, timer });
    });
  }

  async function readResponse(): Promise<SmtpResponse> {
    const lines: string[] = [];

    while (true) {
      const line = await nextLine();
      lines.push(line);

      if (/^\d{3} /.test(line)) {
        return {
          code: Number(line.slice(0, 3)),
          lines,
        };
      }
    }
  }

  function writeLine(line: string) {
    activeSocket().write(`${line}\r\n`);
  }

  async function command(line: string, expectedCodes: number[]) {
    writeLine(line);
    const response = await readResponse();

    if (!expectedCodes.includes(response.code)) {
      throw new Error(
        `SMTP command failed (${response.code}): ${response.lines.join(" ")}`,
      );
    }

    return response;
  }

  function dotStuff(value: string) {
    return value
      .replace(/\r?\n/g, "\r\n")
      .replace(/^\./gm, "..");
  }

  const initialSocket = settings.secure
    ? tls.connect({
        host: settings.host,
        port: settings.port,
        servername: settings.host,
      })
    : net.createConnection({
        host: settings.host,
        port: settings.port,
      });

  bindSocket(initialSocket);

  await new Promise<void>((resolve, reject) => {
    const eventName = settings.secure ? "secureConnect" : "connect";
    initialSocket.once(eventName, () => resolve());
    initialSocket.once("error", reject);
  });

  try {
    const greeting = await readResponse();

    if (greeting.code !== 220) {
      throw new Error(`Unexpected SMTP greeting: ${greeting.lines.join(" ")}`);
    }

    let helloResponse = await command(`EHLO ${os.hostname()}`, [250]);

    if (!settings.secure && hasCapability(helloResponse, "STARTTLS")) {
      await command("STARTTLS", [220]);
      const currentSocket = activeSocket();
      currentSocket.removeAllListeners("data");
      currentSocket.removeAllListeners("error");
      currentSocket.removeAllListeners("close");
      buffer = "";

      const tlsSocket = tls.connect({
        socket: currentSocket as net.Socket,
        servername: settings.host,
      });

      bindSocket(tlsSocket);
      await new Promise<void>((resolve, reject) => {
        tlsSocket.once("secureConnect", () => resolve());
        tlsSocket.once("error", reject);
      });
      usingTls = true;
      helloResponse = await command(`EHLO ${os.hostname()}`, [250]);
    }

    if (settings.username || settings.password) {
      if (!usingTls) {
        throw new Error(
          "SMTP credentials require TLS. Enable SSL/TLS or use a server that supports STARTTLS.",
        );
      }

      const authPlain = Buffer.from(
        `\u0000${settings.username ?? ""}\u0000${settings.password ?? ""}`,
        "utf8",
      ).toString("base64");
      const authResponse = await command(`AUTH PLAIN ${authPlain}`, [
        235,
        503,
      ]);

      if (authResponse.code !== 235 && authResponse.code !== 503) {
        throw new Error(`SMTP authentication failed: ${authResponse.lines.join(" ")}`);
      }
    }

    await command(`MAIL FROM:<${mail.from.email}>`, [250]);

    for (const recipient of recipients) {
      await command(`RCPT TO:<${recipient}>`, [250, 251]);
    }

    await command("DATA", [354]);
    activeSocket().write(`${dotStuff(message)}\r\n.\r\n`);

    const dataResponse = await readResponse();

    if (dataResponse.code !== 250) {
      throw new Error(`SMTP message was rejected: ${dataResponse.lines.join(" ")}`);
    }

    await command("QUIT", [221]);
    activeSocket().end();

    return {
      messageId,
    };
  } catch (error) {
    activeSocket().destroy();
    throw error;
  }
}
