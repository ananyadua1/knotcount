// Sends KnotCount's emails (password reset codes, RSVP reminders) from the Gmail account that owns this script.
// 1. Go to script.google.com while signed in to that Gmail, choose New project, paste this file over the default code.
// 2. Change SECRET below to a long random string of your own.
// 3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy and allow access when asked.
// 4. Copy the Web app URL. On Render set MAIL_WEBHOOK_URL to that URL and MAIL_WEBHOOK_SECRET to the same SECRET.
const SECRET = 'change-me-to-a-long-random-string';

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput('forbidden');
  MailApp.sendEmail({ to: d.to, subject: d.subject, body: d.text, name: 'KnotCount' });
  return ContentService.createTextOutput('ok');
}
