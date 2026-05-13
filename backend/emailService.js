const nodemailer = require('nodemailer');
const Imap       = require('imap');
const { simpleParser } = require('mailparser');
const Pop3Command      = require('node-pop3');

// Конфигурация из переменных окружения
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// ─────────────────────────────────────────
//  SMTP — отправка письма через Nodemailer
// ─────────────────────────────────────────
async function sendEmail({ to, subject, text, html }) {
  const transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,              // STARTTLS
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from:    `"ToDo App" <${EMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  });

  return { messageId: info.messageId, response: info.response };
}

// ─────────────────────────────────────────
//  IMAP — чтение писем из INBOX
// ─────────────────────────────────────────
function readEmailsIMAP(limit = 5) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user:     EMAIL_USER,
      password: EMAIL_PASS,
      host:     'imap.gmail.com',
      port:     993,
      tls:      true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        // Берём последние N писем
        const total = box.messages.total;
        if (total === 0) { imap.end(); return resolve([]); }

        const start = Math.max(1, total - limit + 1);
        const fetchRange = `${start}:${total}`;

        const f = imap.seq.fetch(fetchRange, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
          struct: true,
        });

        f.on('message', (msg) => {
          let header = '', body = '';
          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', chunk => { buffer += chunk.toString('utf8'); });
            stream.once('end', () => {
              if (info.which.startsWith('HEADER')) header = buffer;
              else body = buffer;
            });
          });
          msg.once('end', () => {
            const parsedHeader = Imap.parseHeader(header);
            emails.push({
              from:    parsedHeader.from?.[0]    || '—',
              to:      parsedHeader.to?.[0]      || '—',
              subject: parsedHeader.subject?.[0] || '(без темы)',
              date:    parsedHeader.date?.[0]    || '—',
              body:    body.substring(0, 300),   // ограничиваем длину
            });
          });
        });

        f.once('error', err => { imap.end(); reject(err); });
        f.once('end',   ()  => { imap.end(); });
      });
    });

    imap.once('error', err => reject(err));
    imap.once('end',   ()  => resolve(emails));
    imap.connect();
  });
}

// ─────────────────────────────────────────
//  POP3 — получение количества писем и первого письма
// ─────────────────────────────────────────
async function readEmailsPOP3() {
  const tls = require('tls');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('POP3 timeout'));
    }, 20000);

    const socket = tls.connect({
      host: 'pop.gmail.com',
      port: 995,
      rejectUnauthorized: false,
    });

    let buffer = '';
    let step = 0;
    let totalCount = 0;
    let retrBuffer = '';
    let readingRetr = false;

    const send = (cmd) => socket.write(cmd + '\r\n');

    socket.on('data', (data) => {
      const chunk = data.toString();

      // Если читаем тело письма — собираем отдельно
      if (readingRetr) {
        retrBuffer += chunk;
        // Конец письма — строка с одной точкой
        if (retrBuffer.includes('\r\n.\r\n')) {
          readingRetr = false;
          step = 5;
          send('QUIT');

          // Парсим заголовки вручную
          const lines = retrBuffer.split('\r\n');
          let from = '—', subject = '—', date = '—';
          for (const line of lines) {
            if (line.startsWith('From:'))    from    = line.replace('From:', '').trim();
            if (line.startsWith('Subject:')) subject = line.replace('Subject:', '').trim();
            if (line.startsWith('Date:'))    date    = line.replace('Date:', '').trim();
            if (line === '') break; // конец заголовков
          }

          clearTimeout(timeout);
          socket.destroy();
          resolve({
            totalCount,
            emails: [{ from, subject, date, preview: '(загружено через POP3)' }]
          });
        }
        return;
      }

      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      lines.forEach(line => {
        if (!line) return;

        if (step === 0 && line.startsWith('+OK')) {
          step = 1;
          send(`USER ${EMAIL_USER}`);
        } else if (step === 1 && line.startsWith('+OK')) {
          step = 2;
          send(`PASS ${EMAIL_PASS}`);
        } else if (step === 2 && line.startsWith('-ERR')) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error('Неверный логин или пароль POP3'));
        } else if (step === 2 && line.startsWith('+OK')) {
          step = 3;
          send('STAT');
        } else if (step === 3 && line.startsWith('+OK')) {
          const parts = line.split(' ');
          totalCount = parseInt(parts[1]) || 0;
          step = 4;
          if (totalCount > 0) {
            // Запрашиваем последнее письмо
            readingRetr = true;
            send(`RETR ${totalCount}`);
          } else {
            send('QUIT');
          }
        } else if (step === 5 && line.startsWith('+OK')) {
          clearTimeout(timeout);
          socket.destroy();
          resolve({ totalCount, emails: [] });
        }
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error('POP3 connect error: ' + err.message));
    });
  });
}

module.exports = { sendEmail, readEmailsIMAP, readEmailsPOP3 };
