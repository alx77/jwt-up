const cfg = require("../common/config");
const nodemailer = require("nodemailer");

const auth = cfg.get("EMAIL_USE_AUTH")
  ? {
      user: cfg.get("EMAIL_SMTP_USER"),
      pass: cfg.get("EMAIL_SMTP_PASS"),
    }
  : undefined;

const transporter = nodemailer.createTransport({
  host: cfg.get("EMAIL_SMTP_HOST"),
  port: cfg.get("EMAIL_SMTP_PORT"),
  secure: cfg.get("EMAIL_USE_SSL") || false,
  auth,
});

module.exports = { transporter };
