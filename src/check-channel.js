require('dotenv').config();

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

(async () => {
  if (!token) {
    console.error('❌ LINE_CHANNEL_ACCESS_TOKEN не найден в .env');
    return;
  }

  // 1. Информация о канале (bot)
  const botInfo = await fetch('https://api.line.me/v2/bot/info', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('🤖 BOT INFO:');
  console.log(JSON.stringify(botInfo, null, 2));

  // 2. Проверить, валиден ли токен и какому каналу он принадлежит
  const verify = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${token}`
  ).then(r => r.json());

  console.log('\n🔑 TOKEN VERIFY:');
  console.log(JSON.stringify(verify, null, 2));

  // 3. Webhook endpoint, который сейчас зарегистрирован у канала
  const webhook = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('\n🌐 WEBHOOK ENDPOINT:');
  console.log(JSON.stringify(webhook, null, 2));
})();